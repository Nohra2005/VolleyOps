from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, jwt_required

from extensions import db
from model import User
from services.access_control import ROLE_MANAGER, ROLE_PLAYER, VALID_ROLES, current_user_or_error, normalize_role

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def serialize_user(user):
    role = normalize_role(user.role)
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": role,
        "teamId": user.team_id,
        "team": user.team.name if user.team else None,
    }


def create_token_for_user(user):
    role = normalize_role(user.role)
    return create_access_token(identity=str(user.id), additional_claims={"role": role})


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or user.password != password:
        return jsonify({"error": "Invalid email or password"}), 401

    user.role = normalize_role(user.role)
    access_token = create_token_for_user(user)
    return jsonify({"token": access_token, "user": serialize_user(user)})


@auth_bp.post("/signup")
def signup():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "A user with this email already exists"}), 409

    role = ROLE_MANAGER if User.query.count() == 0 else ROLE_PLAYER
    user = User(full_name=name, email=email, password=password, role=role, joined_at=date.today())
    db.session.add(user)
    db.session.commit()

    return jsonify({"token": create_token_for_user(user), "user": serialize_user(user)}), 201


@auth_bp.get("/me")
@jwt_required()
def me():
    user = User.query.get_or_404(get_jwt_identity())
    return jsonify(serialize_user(user))


@auth_bp.get("/users")
@jwt_required()
def list_users():
    _, error = current_user_or_error(ROLE_MANAGER)
    if error:
        return error

    users = User.query.order_by(User.full_name.asc()).all()
    return jsonify([serialize_user(user) for user in users])


@auth_bp.put("/users/<int:user_id>/role")
@jwt_required()
def update_user_role(user_id):
    _, error = current_user_or_error(ROLE_MANAGER)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    role = normalize_role(payload.get("role") or "")
    if role not in VALID_ROLES:
        return jsonify({"error": "Role must be MANAGER, COACH, or PLAYER"}), 400

    user = User.query.get_or_404(user_id)
    user.role = role
    db.session.commit()
    return jsonify(serialize_user(user))
