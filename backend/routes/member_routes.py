from datetime import date, datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from model import User
from services.access_control import ROLE_COACH, ROLE_MANAGER, ROLE_PLAYER, VALID_ROLES, current_user_or_error, normalize_role
from services.serialization import format_date, format_pretty_date, last_active_label

member_bp = Blueprint("member", __name__, url_prefix="/api/members")


def serialize_member(member):
    role = normalize_role(member.role)
    return {
        "id": member.id,
        "name": member.full_name,
        "email": member.email,
        "role": role,
        "phone": member.phone,
        "emergencyContact": member.emergency_contact,
        "dateOfBirth": format_date(member.date_of_birth),
        "team": member.team.name if member.team else "",
        "teamId": member.team_id,
        "position": member.position or "",
        "attendanceRate": member.attendance_rate,
        "payment": member.payment_status,
        "nextPayment": format_date(member.next_payment_date),
        "joined": format_pretty_date(member.joined_at),
        "joinedDate": format_date(member.joined_at),
        "lastActive": last_active_label(member.last_active_at),
        "lastActiveAt": format_date(member.last_active_at),
    }


def apply_member_updates(member, payload):
    member.full_name = payload.get("name", member.full_name).strip()
    member.email = payload.get("email", member.email).strip().lower()
    member.phone = payload.get("phone")
    member.emergency_contact = payload.get("emergencyContact")
    member.date_of_birth = None if not payload.get("dateOfBirth") else datetime.strptime(payload["dateOfBirth"], "%Y-%m-%d").date()
    member.team_id = payload.get("teamId") or member.team_id
    member.position = payload.get("position")
    member.attendance_rate = float(payload["attendanceRate"]) if payload.get("attendanceRate") not in (None, "") else None
    member.payment_status = payload.get("payment", member.payment_status)
    member.next_payment_date = None if not payload.get("nextPayment") else datetime.strptime(payload["nextPayment"], "%Y-%m-%d").date()
    member.last_active_at = datetime.utcnow()


@member_bp.get("")
@jwt_required()
def list_members():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    role = (request.args.get("role") or "").upper()
    query = User.query
    if role:
        query = query.filter(User.role == normalize_role(role))
    members = query.order_by(User.full_name.asc()).all()
    return jsonify([serialize_member(member) for member in members])


@member_bp.get("/<int:member_id>")
@jwt_required()
def get_member(member_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    member = User.query.get_or_404(member_id)
    return jsonify(serialize_member(member))


@member_bp.post("")
@jwt_required()
def create_member():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    role = normalize_role(payload.get("role") or ROLE_PLAYER)
    if role not in VALID_ROLES:
        return jsonify({"error": "Role must be MANAGER, COACH, or PLAYER"}), 400

    member = User(
        full_name=payload["name"].strip(),
        email=payload["email"].strip().lower(),
        password=payload.get("password", "demo123"),
        role=role,
        joined_at=date.today(),
    )
    apply_member_updates(member, payload)
    db.session.add(member)
    db.session.commit()
    return jsonify(serialize_member(member)), 201


@member_bp.put("/<int:member_id>")
@jwt_required()
def update_member(member_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    member = User.query.get_or_404(member_id)
    payload = request.get_json(silent=True) or {}
    if payload.get("role"):
        role = normalize_role(payload["role"])
        if role not in VALID_ROLES:
            return jsonify({"error": "Role must be MANAGER, COACH, or PLAYER"}), 400
        member.role = role
    apply_member_updates(member, payload)
    db.session.commit()
    return jsonify(serialize_member(member))


@member_bp.delete("/<int:member_id>")
@jwt_required()
def delete_member(member_id):
    # RBAC ENFORCEMENT: Only ROLE_MANAGER can access this route now
    _, error = current_user_or_error(ROLE_MANAGER)
    if error:
        return error

    member = User.query.get_or_404(member_id)
    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "Member deleted"})
