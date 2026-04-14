from datetime import date

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from extensions import db
from model import User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
VALID_ROLES = {"ADMIN", "MANAGER", "COACH", "ATHLETE"}


def serialize_user(user):
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
        "teamId": user.team_id,
        "team": user.team.name if user.team else None,
    }


def create_token_for_user(user):
    return create_access_token(identity=str(user.id), additional_claims={"role": user.role})


def current_admin_or_error():
    current_user = User.query.get(get_jwt_identity())
    if not current_user or current_user.role != "ADMIN":
        return None, (jsonify({"error": "Admin access required"}), 403)
    return current_user, None


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or user.password != password:
        return jsonify({"error": "Invalid email or password"}), 401

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

    role = "ADMIN" if User.query.count() == 0 else "ATHLETE"
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
    _, error = current_admin_or_error()
    if error:
        return error

    users = User.query.order_by(User.full_name.asc()).all()
    return jsonify([serialize_user(user) for user in users])


@auth_bp.put("/users/<int:user_id>/role")
@jwt_required()
def update_user_role(user_id):
    _, error = current_admin_or_error()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    role = (payload.get("role") or "").upper()
    if role not in VALID_ROLES:
        return jsonify({"error": "Role must be ADMIN, MANAGER, COACH, or ATHLETE"}), 400

    user = User.query.get_or_404(user_id)
    user.role = role
    db.session.commit()
    return jsonify(serialize_user(user))
