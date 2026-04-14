from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from extensions import db
from model import AIFeedback, Match, PlayerMatchStat, Team, User
from services.access_control import ROLE_COACH, ROLE_MANAGER, ROLE_PLAYER, current_user_or_error
from services.stats_service import calculate_hitting_percentage, calculate_performance_score, generate_feedback_text

stats_bp = Blueprint("stats", __name__, url_prefix="/api/stats")


def serialize_stat(stat):
    team_average_score = (
        db.session.query(func.avg(PlayerMatchStat.performance_score))
        .join(Match, Match.id == PlayerMatchStat.match_id)
        .filter(Match.team_id == stat.match.team_id)
        .scalar()
    ) or 0
    feedback = stat.feedback_items[0] if stat.feedback_items else None
    return {
        "id": stat.id,
        "playerId": stat.player_id,
        "playerName": stat.player.full_name,
        "position": stat.player.position,
        "matchId": stat.match_id,
        "teamId": stat.match.team_id,
        "team": stat.match.team.name,
        "opponent": stat.match.opponent,
        "playedOn": stat.match.played_on.isoformat(),
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
        "teamAverageScore": round(team_average_score, 2),
        "feedback": None if not feedback else {
            "id": feedback.id,
            "tone": feedback.tone,
            "generatedText": feedback.generated_text,
            "coachEditedText": feedback.coach_edited_text,
            "isApproved": feedback.is_approved,
        },
    }


@stats_bp.get("/matches")
@jwt_required()
def list_matches():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    matches = Match.query.order_by(Match.played_on.desc()).all()
    return jsonify(
        [
            {
                "id": match.id,
                "teamId": match.team_id,
                "team": match.team.name,
                "opponent": match.opponent,
                "playedOn": match.played_on.isoformat(),
                "venue": match.venue,
            }
            for match in matches
        ]
    )


@stats_bp.post("/matches")
@jwt_required()
def create_match_stat_bundle():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    match = Match(
        team_id=int(payload["teamId"]),
        opponent=payload["opponent"].strip(),
        played_on=datetime.strptime(payload["playedOn"], "%Y-%m-%d").date(),
        venue=payload.get("venue"),
        created_by_user_id=payload.get("createdByUserId"),
    )
    db.session.add(match)
    db.session.flush()

    stat_rows = []
    for row in payload.get("playerStats", []):
        hp = calculate_hitting_percentage(row.get("kills", 0), row.get("attackAttempts", 0), row.get("attackErrors", 0))
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
            player_id=int(row["playerId"]),
            kills=row.get("kills", 0),
            attack_attempts=row.get("attackAttempts", 0),
            attack_errors=row.get("attackErrors", 0),
            aces=row.get("aces", 0),
            blocks=row.get("blocks", 0),
            digs=row.get("digs", 0),
            assists=row.get("assists", 0),
            receive_rating=row.get("receiveRating"),
            hitting_percentage=hp,
            performance_score=score,
        )
        stat_rows.append(stat)
        db.session.add(stat)
    db.session.flush()

    avg_score = round(sum(stat.performance_score for stat in stat_rows) / max(len(stat_rows), 1), 2)
    tone = payload.get("tone", "standard")
    for stat in stat_rows:
        db.session.add(
            AIFeedback(
                player_stat_id=stat.id,
                tone=tone,
                generated_text=generate_feedback_text(
                    stat.player.full_name,
                    stat.player.position,
                    stat,
                    tone=tone,
                    team_average_score=avg_score,
                ),
                created_by_user_id=payload.get("createdByUserId"),
                is_approved=False,
            )
        )

    db.session.commit()
    return jsonify({"matchId": match.id, "createdStats": len(stat_rows)}), 201


@stats_bp.get("/players/<int:player_id>")
@jwt_required()
def player_stats(player_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    User.query.get_or_404(player_id)
    stats = (
        PlayerMatchStat.query.filter_by(player_id=player_id)
        .join(Match, Match.id == PlayerMatchStat.match_id)
        .order_by(Match.played_on.desc())
        .all()
    )
    return jsonify([serialize_stat(stat) for stat in stats])


@stats_bp.get("/teams/<int:team_id>/summary")
@jwt_required()
def team_summary(team_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    Team.query.get_or_404(team_id)
    stats = (
        db.session.query(
            func.avg(PlayerMatchStat.kills).label("avgKills"),
            func.avg(PlayerMatchStat.digs).label("avgDigs"),
            func.avg(PlayerMatchStat.blocks).label("avgBlocks"),
            func.avg(PlayerMatchStat.performance_score).label("avgPerformance"),
        )
        .join(Match, Match.id == PlayerMatchStat.match_id)
        .filter(Match.team_id == team_id)
        .one()
    )
    return jsonify(
        {
            "teamId": team_id,
            "averageKills": round(stats.avgKills or 0, 2),
            "averageDigs": round(stats.avgDigs or 0, 2),
            "averageBlocks": round(stats.avgBlocks or 0, 2),
            "averagePerformance": round(stats.avgPerformance or 0, 2),
        }
    )


@stats_bp.put("/feedback/<int:feedback_id>")
@jwt_required()
def update_feedback(feedback_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
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
    return jsonify(
        {
            "id": feedback.id,
            "coachEditedText": feedback.coach_edited_text,
            "isApproved": feedback.is_approved,
            "tone": feedback.tone,
        }
    )
