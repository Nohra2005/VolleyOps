from flask import Blueprint, jsonify, request
from extensions import db
from model import Facility, Team, User

reference_bp = Blueprint("reference", __name__, url_prefix="/api")


@reference_bp.get("/health")
def health():
    return jsonify({"status": "ok"})


@reference_bp.get("/bootstrap")
def bootstrap():
    facilities = Facility.query.order_by(Facility.id.asc()).all()
    teams = Team.query.order_by(Team.name.asc()).all()
    demo_users = User.query.order_by(User.full_name.asc()).limit(5).all()
    return jsonify(
        {
            "facilities": [{"id": facility.id, "name": facility.name} for facility in facilities],
            "teams": [{"id": team.id, "name": team.name, "division": team.division} for team in teams],
            "demoUsers": [{"id": user.id, "name": user.full_name, "role": user.role} for user in demo_users],
        }
    )


@reference_bp.get("/teams")
def list_teams():
    teams = Team.query.order_by(Team.name.asc()).all()
    return jsonify(
        [
            {"id": team.id, "name": team.name, "division": team.division, "ageGroup": team.age_group}
            for team in teams
        ]
    )


@reference_bp.get("/facilities")
def list_facilities():
    facilities = Facility.query.order_by(Facility.id.asc()).all()
    return jsonify(
        [
            {"id": facility.id, "name": facility.name, "startHour": facility.operating_start_hour, "endHour": facility.operating_end_hour}
            for facility in facilities
        ]
    )

@reference_bp.post("/teams")
def create_team():
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
