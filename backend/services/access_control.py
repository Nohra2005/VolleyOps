from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from model import User

ROLE_MANAGER = "MANAGER"
ROLE_COACH = "COACH"
ROLE_PLAYER = "PLAYER"

VALID_ROLES = {ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER}
LEGACY_ROLE_MAP = {
    "ADMIN": ROLE_MANAGER,
    "ATHLETE": ROLE_PLAYER,
}


def normalize_role(role):
    if not role:
        return role
    return LEGACY_ROLE_MAP.get(role.upper(), role.upper())


def current_user_or_error(*allowed_roles):
    current_user = User.query.get(get_jwt_identity())
    if not current_user:
        return None, (jsonify({"error": "Authentication required"}), 401)

    current_user.role = normalize_role(current_user.role)
    if allowed_roles and current_user.role not in allowed_roles:
        return None, (jsonify({"error": "You do not have access to this resource"}), 403)

    return current_user, None
