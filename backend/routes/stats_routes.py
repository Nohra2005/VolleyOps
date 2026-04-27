from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from extensions import db
from model import Team, User
from model.stats import AIFeedback, Match, PlayerMatchStat, TeamMatchSummary
from services.access_control import ROLE_COACH, ROLE_MANAGER, ROLE_PLAYER, current_user_or_error, normalize_role
from services.stats_service import (
    calculate_hitting_percentage,
    calculate_metric_delta,
    calculate_performance_score,
    calculate_season_averages,
    calculate_team_match_aggregate,
    generate_feedback_text,
    generate_team_summary_text,
)

stats_bp = Blueprint("stats", __name__, url_prefix="/api/stats")


def as_int(value, default=0):
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def as_float(value, default=0):
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def numeric_or_default(value, default=0.0):
    try:
        return float(value if value is not None else default)
    except (TypeError, ValueError):
        return float(default)


def serialize_feedback(feedback):
    if not feedback:
        return None

    return {
        "id": feedback.id,
        "tone": feedback.tone,
        "generatedText": feedback.generated_text,
        "coachEditedText": feedback.coach_edited_text,
        "displayText": feedback.coach_edited_text or feedback.generated_text,
        "isApproved": feedback.is_approved,
        "createdAt": feedback.created_at.isoformat() if feedback.created_at else None,
        "updatedAt": feedback.updated_at.isoformat() if feedback.updated_at else None,
    }


def team_average_for_match(match_id):
    value = (
        db.session.query(func.avg(PlayerMatchStat.performance_score))
        .filter(PlayerMatchStat.match_id == match_id)
        .scalar()
    )
    return round(value or 0, 2)


def team_average_for_team(team_id):
    value = (
        db.session.query(func.avg(PlayerMatchStat.performance_score))
        .join(Match, Match.id == PlayerMatchStat.match_id)
        .filter(Match.team_id == team_id)
        .scalar()
    )
    return round(value or 0, 2)


def serialize_stat(stat):
    match = stat.match
    player = stat.player
    team = match.team if match else None
    feedback = AIFeedback.query.filter_by(player_stat_id=stat.id).order_by(AIFeedback.created_at.desc()).first()

    match_team_average = team_average_for_match(stat.match_id)
    team_season_average = team_average_for_team(match.team_id) if match else 0

    return {
        "id": stat.id,
        "playerId": player.id if player else stat.player_id,
        "playerName": player.full_name if player else "",
        "position": player.position if player else "",
        "matchId": match.id if match else None,
        "teamId": team.id if team else None,
        "team": team.name if team else "",
        "opponent": match.opponent if match else "",
        "playedOn": match.played_on.isoformat() if match and match.played_on else None,
        "venue": match.venue if match else "",
        "kills": stat.kills,
        "attackAttempts": stat.attack_attempts,
        "attackErrors": stat.attack_errors,
        "aces": stat.aces,
        "blocks": stat.blocks,
        "digs": stat.digs,
        "assists": stat.assists,
        "receiveRating": stat.receive_rating,
        "hittingPercentage": stat.hitting_percentage,
        "performanceScore": stat.performance_score,
        "teamAverageScore": match_team_average,
        "teamSeasonAverageScore": team_season_average,
        "scoreVsTeamAverage": calculate_metric_delta(stat.performance_score, match_team_average),
        "coachNotes": stat.coach_notes or "",
        "feedback": serialize_feedback(feedback),
        "createdAt": stat.created_at.isoformat() if stat.created_at else None,
        "updatedAt": stat.updated_at.isoformat() if stat.updated_at else None,
    }


def serialize_match(match, include_summary=True):
    summary = None
    if include_summary:
        summary = TeamMatchSummary.query.filter_by(match_id=match.id).first()

    return {
        "id": match.id,
        "teamId": match.team_id,
        "team": match.team.name if match.team else "",
        "opponent": match.opponent,
        "playedOn": match.played_on.isoformat() if match.played_on else None,
        "venue": match.venue,
        "createdByUserId": match.created_by_user_id,
        "createdAt": match.created_at.isoformat() if match.created_at else None,
        "summary": serialize_team_match_summary(summary) if summary else None,
    }


def serialize_team_match_summary(summary):
    if not summary:
        return None

    match = summary.match

    return {
        "id": summary.id,
        "matchId": summary.match_id,
        "teamId": summary.team_id,
        "opponent": match.opponent if match else "",
        "playedOn": match.played_on.isoformat() if match and match.played_on else None,
        "averagePerformanceScore": summary.average_performance_score,
        "averageHittingPercentage": summary.average_hitting_percentage,
        "totalKills": summary.total_kills,
        "totalAttackAttempts": summary.total_attack_attempts,
        "totalAttackErrors": summary.total_attack_errors,
        "totalAces": summary.total_aces,
        "totalBlocks": summary.total_blocks,
        "totalDigs": summary.total_digs,
        "totalAssists": summary.total_assists,
        "strongestMetric": summary.strongest_metric,
        "weakestMetric": summary.weakest_metric,
        "generatedSummary": summary.generated_summary,
        "coachNotes": summary.coach_notes or "",
        "createdAt": summary.created_at.isoformat() if summary.created_at else None,
    }


def assert_player_can_access(current_user, player_id):
    if normalize_role(current_user.role) == ROLE_PLAYER and current_user.id != player_id:
        return jsonify({"error": "Players can only view their own stats"}), 403
    return None


def get_or_create_team_summary(match, current_user_id=None, coach_notes=""):
    stats = PlayerMatchStat.query.filter_by(match_id=match.id).all()
    aggregate = calculate_team_match_aggregate(stats)

    summary = TeamMatchSummary.query.filter_by(match_id=match.id).first()
    if not summary:
        summary = TeamMatchSummary(match_id=match.id, team_id=match.team_id)
        db.session.add(summary)

    summary.average_performance_score = aggregate["averagePerformanceScore"]
    summary.average_hitting_percentage = aggregate["averageHittingPercentage"]
    summary.total_kills = aggregate["totalKills"]
    summary.total_attack_attempts = aggregate["totalAttackAttempts"]
    summary.total_attack_errors = aggregate["totalAttackErrors"]
    summary.total_aces = aggregate["totalAces"]
    summary.total_blocks = aggregate["totalBlocks"]
    summary.total_digs = aggregate["totalDigs"]
    summary.total_assists = aggregate["totalAssists"]
    summary.strongest_metric = aggregate["strongestMetric"]
    summary.weakest_metric = aggregate["weakestMetric"]
    summary.coach_notes = coach_notes or summary.coach_notes
    summary.created_by_user_id = current_user_id or summary.created_by_user_id
    summary.generated_summary = generate_team_summary_text(
        team_name=match.team.name if match.team else "Team",
        match=match,
        aggregate=aggregate,
        coach_notes=summary.coach_notes or "",
    )

    return summary


@stats_bp.get("/matches")
@jwt_required()
def list_matches():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    query = Match.query

    if request.args.get("teamId"):
        try:
            team_id = int(request.args["teamId"])
        except (TypeError, ValueError):
            return jsonify({"error": "teamId must be an integer"}), 400
        query = query.filter(Match.team_id == team_id)

    matches = query.order_by(Match.played_on.desc()).all()
    return jsonify([serialize_match(match) for match in matches])


@stats_bp.post("/matches")
@jwt_required()
def create_match_stat_bundle():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}

    if not payload.get("teamId"):
        return jsonify({"error": "teamId is required"}), 400
    if not payload.get("opponent"):
        return jsonify({"error": "opponent is required"}), 400
    if not payload.get("playedOn"):
        return jsonify({"error": "playedOn is required"}), 400

    player_rows = payload.get("playerStats", [])
    if not player_rows:
        return jsonify({"error": "At least one player stat row is required"}), 400

    team = Team.query.get_or_404(int(payload["teamId"]))

    match = Match(
        team_id=team.id,
        opponent=payload["opponent"].strip(),
        played_on=datetime.strptime(payload["playedOn"], "%Y-%m-%d").date(),
        venue=payload.get("venue") or "",
        created_by_user_id=current_user.id,
    )
    db.session.add(match)
    db.session.flush()

    stat_rows = []

    for row in player_rows:
        player_id = int(row["playerId"])
        player = User.query.get_or_404(player_id)

        hp = calculate_hitting_percentage(
            row.get("kills", 0),
            row.get("attackAttempts", 0),
            row.get("attackErrors", 0),
        )

        score = calculate_performance_score(
            {
                "kills": row.get("kills", 0),
                "aces": row.get("aces", 0),
                "blocks": row.get("blocks", 0),
                "digs": row.get("digs", 0),
                "assists": row.get("assists", 0),
                "attack_errors": row.get("attackErrors", 0),
                "receive_rating": row.get("receiveRating", 0),
            }
        )

        stat = PlayerMatchStat(
            match_id=match.id,
            player_id=player.id,
            kills=as_int(row.get("kills")),
            attack_attempts=as_int(row.get("attackAttempts")),
            attack_errors=as_int(row.get("attackErrors")),
            aces=as_int(row.get("aces")),
            blocks=as_int(row.get("blocks")),
            digs=as_int(row.get("digs")),
            assists=as_int(row.get("assists")),
            receive_rating=as_float(row.get("receiveRating"), None),
            hitting_percentage=hp,
            performance_score=score,
            coach_notes=row.get("coachNotes") or payload.get("coachNotes") or "",
        )

        db.session.add(stat)
        stat_rows.append(stat)

    db.session.flush()

    match_average_score = round(
        sum(stat.performance_score for stat in stat_rows) / max(len(stat_rows), 1),
        2,
    )

    tone = payload.get("tone") or "analytical"

    for stat in stat_rows:
        db.session.add(
            AIFeedback(
                player_stat_id=stat.id,
                tone=tone,
                generated_text=generate_feedback_text(
                    player_name=stat.player.full_name,
                    position=stat.player.position,
                    stat=stat,
                    tone=tone,
                    team_average_score=match_average_score,
                    coach_notes=stat.coach_notes or "",
                ),
                created_by_user_id=current_user.id,
                is_approved=False,
            )
        )

    team_summary = get_or_create_team_summary(
        match=match,
        current_user_id=current_user.id,
        coach_notes=payload.get("coachNotes") or "",
    )

    db.session.commit()

    return jsonify(
        {
            "matchId": match.id,
            "createdStats": len(stat_rows),
            "teamSummary": serialize_team_match_summary(team_summary),
        }
    ), 201


@stats_bp.get("/players/<int:player_id>")
@jwt_required()
def player_stats(player_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    access_error = assert_player_can_access(current_user, player_id)
    if access_error:
        return access_error

    player = User.query.get_or_404(player_id)

    stats = (
        PlayerMatchStat.query.filter_by(player_id=player_id)
        .join(Match, Match.id == PlayerMatchStat.match_id)
        .order_by(Match.played_on.desc())
        .all()
    )

    serialized_stats = [serialize_stat(stat) for stat in stats]
    season_averages = calculate_season_averages(stats)

    latest = serialized_stats[0] if serialized_stats else None
    previous = serialized_stats[1] if len(serialized_stats) > 1 else None

    latest_score = numeric_or_default((latest or {}).get("performanceScore"), 0)
    previous_score = numeric_or_default((previous or {}).get("performanceScore"), 0)
    latest_hit = numeric_or_default((latest or {}).get("hittingPercentage"), 0)
    previous_hit = numeric_or_default((previous or {}).get("hittingPercentage"), 0)
    latest_kills = int(numeric_or_default((latest or {}).get("kills"), 0))
    previous_kills = int(numeric_or_default((previous or {}).get("kills"), 0))

    trend = {
        "performanceScoreDelta": 0 if not latest or not previous else round(latest_score - previous_score, 2),
        "hittingPercentageDelta": 0 if not latest or not previous else round(latest_hit - previous_hit, 3),
        "killsDelta": 0 if not latest or not previous else latest_kills - previous_kills,
    }

    team_average = team_average_for_team(player.team_id) if player.team_id else 0

    return jsonify(
        {
            "player": {
                "id": player.id,
                "name": player.full_name,
                "email": player.email,
                "role": player.role,
                "position": player.position,
                "teamId": player.team_id,
                "team": player.team.name if player.team else "",
            },
            "stats": serialized_stats,
            "latest": latest,
            "seasonAverages": season_averages,
            "teamComparison": {
                "teamAverageScore": team_average,
                "playerAverageScore": season_averages["performanceScore"],
                "delta": calculate_metric_delta(season_averages["performanceScore"], team_average),
            },
            "trend": trend,
        }
    )


@stats_bp.get("/teams/<int:team_id>/summary")
@jwt_required()
def team_summary(team_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    team = Team.query.get_or_404(team_id)

    stats = (
        PlayerMatchStat.query
        .join(Match, Match.id == PlayerMatchStat.match_id)
        .filter(Match.team_id == team_id)
        .all()
    )

    aggregate = calculate_team_match_aggregate(stats)

    recent_summaries = (
        TeamMatchSummary.query
        .filter_by(team_id=team_id)
        .order_by(TeamMatchSummary.created_at.desc())
        .limit(5)
        .all()
    )

    recent_matches = (
        Match.query
        .filter_by(team_id=team_id)
        .order_by(Match.played_on.desc())
        .limit(8)
        .all()
    )

    return jsonify(
        {
            "teamId": team_id,
            "team": team.name,
            "division": team.division,
            "averageKills": round((aggregate["totalKills"] / max(len(stats), 1)), 2),
            "averageDigs": round((aggregate["totalDigs"] / max(len(stats), 1)), 2),
            "averageBlocks": round((aggregate["totalBlocks"] / max(len(stats), 1)), 2),
            "averagePerformance": aggregate["averagePerformanceScore"],
            "averageHittingPercentage": aggregate["averageHittingPercentage"],
            "totals": aggregate,
            "recentSummaries": [serialize_team_match_summary(summary) for summary in recent_summaries],
            "recentMatches": [serialize_match(match) for match in recent_matches],
        }
    )


@stats_bp.get("/matches/<int:match_id>/summary")
@jwt_required()
def match_summary(match_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    match = Match.query.get_or_404(match_id)
    summary = get_or_create_team_summary(match, current_user_id=current_user.id)
    db.session.commit()

    return jsonify(serialize_team_match_summary(summary))


@stats_bp.post("/matches/<int:match_id>/regenerate-summary")
@jwt_required()
def regenerate_match_summary(match_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    match = Match.query.get_or_404(match_id)

    summary = get_or_create_team_summary(
        match=match,
        current_user_id=current_user.id,
        coach_notes=payload.get("coachNotes") or "",
    )

    db.session.commit()
    return jsonify(serialize_team_match_summary(summary))


@stats_bp.put("/feedback/<int:feedback_id>")
@jwt_required()
def update_feedback(feedback_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    feedback = AIFeedback.query.get_or_404(feedback_id)
    payload = request.get_json(silent=True) or {}

    feedback.coach_edited_text = payload.get("coachEditedText", feedback.coach_edited_text)

    if "isApproved" in payload:
        feedback.is_approved = bool(payload["isApproved"])

    if payload.get("tone"):
        feedback.tone = payload["tone"]

    db.session.commit()
    return jsonify(serialize_feedback(feedback))
