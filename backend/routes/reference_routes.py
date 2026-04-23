from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from extensions import db
from model import Facility, Team, User
from services.access_control import ROLE_COACH, ROLE_MANAGER, current_user_or_error, normalize_role

reference_bp = Blueprint("reference", __name__, url_prefix="/api")


@reference_bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@reference_bp.get("/bootstrap")
@jwt_required()
def bootstrap():
    facilities = Facility.query.order_by(Facility.id.asc()).all()
    teams = Team.query.order_by(Team.name.asc()).all()
    demo_users = User.query.order_by(User.full_name.asc()).limit(5).all()
    return jsonify(
        {
            "facilities": [{"id": facility.id, "name": facility.name} for facility in facilities],
            "teams": [{"id": team.id, "name": team.name, "division": team.division} for team in teams],
            "demoUsers": [{"id": user.id, "name": user.full_name, "role": normalize_role(user.role)} for user in demo_users],
        }
    )


@reference_bp.get("/teams")
@jwt_required()
def list_teams():
    teams = Team.query.order_by(Team.name.asc()).all()
    return jsonify(
        [
            {
                "id": team.id, 
                "name": team.name, 
                "division": team.division, 
                "ageGroup": team.age_group,
                "coachId": team.coach_id,
                "coachName": team.coach.full_name if team.coach else None
            }
            for team in teams
        ]
    )


@reference_bp.get("/facilities")
@jwt_required()
def list_facilities():
    facilities = Facility.query.order_by(Facility.id.asc()).all()
    return jsonify(
        [
            {"id": facility.id, "name": facility.name, "startHour": facility.operating_start_hour, "endHour": facility.operating_end_hour}
            for facility in facilities
        ]
    )

@reference_bp.post("/teams")
@jwt_required()
def create_team():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    division = payload.get("division")
    age_group = payload.get("ageGroup")

    if not name or not division:
        return jsonify({"error": "Team name and division are required"}), 400

    # Check if team already exists
    if Team.query.filter_by(name=name).first():
        return jsonify({"error": "A team with this name already exists"}), 409

    new_team = Team(
        name=name,
        division=division,
        age_group=age_group
    )
    
    db.session.add(new_team)
    db.session.commit()

    return jsonify({
        "id": new_team.id, 
        "name": new_team.name, 
        "division": new_team.division, 
        "ageGroup": new_team.age_group
    }), 201

@reference_bp.put("/teams/<int:team_id>")
@jwt_required()
def update_team(team_id):
    # STRICT RBAC: Only Managers can assign coaches
    _, error = current_user_or_error(ROLE_MANAGER)
    if error:
        return error

    team = Team.query.get_or_404(team_id)
    payload = request.get_json(silent=True) or {}

    if "coachId" in payload:
        coach_id = payload["coachId"]
        if coach_id:
            coach = User.query.get(coach_id)
            if not coach or normalize_role(coach.role) != ROLE_COACH:
                return jsonify({"error": "Invalid coach ID or user is not a coach"}), 400
            team.coach_id = coach.id
        else:
            team.coach_id = None  # Unassign coach

    db.session.commit()

    return jsonify({
        "id": team.id,
        "name": team.name,
        "coachId": team.coach_id,
        "coachName": team.coach.full_name if team.coach else None
    })
