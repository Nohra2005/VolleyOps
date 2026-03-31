from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token

from model import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def serialize_user(user):
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
        "teamId": user.team_id,
        "team": user.team.name if user.team else None,
    }


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or user.password != password:
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify({"token": access_token, "user": serialize_user(user)})
