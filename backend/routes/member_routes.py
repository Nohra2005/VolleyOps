from datetime import date, datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from model import User
from services.access_control import (
    ROLE_COACH,
    ROLE_MANAGER,
    ROLE_PLAYER,
    VALID_ROLES,
    current_user_or_error,
    normalize_role,
)
from services.serialization import format_date, format_pretty_date, last_active_label

member_bp = Blueprint("member", __name__, url_prefix="/api/members")


def parse_date(value, field_name):
    if value in (None, ""):
        return None

    if isinstance(value, date):
        return value

    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be formatted as YYYY-MM-DD")


def parse_optional_float(value, field_name, minimum=None, maximum=None):
    if value in (None, ""):
        return None

    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a number")

    if minimum is not None and number < minimum:
        raise ValueError(f"{field_name} must be at least {minimum}")

    if maximum is not None and number > maximum:
        raise ValueError(f"{field_name} must be at most {maximum}")

    return number


def serialize_member(member):
    role = normalize_role(member.role)
    return {
        "id": member.id,
        "name": member.full_name,
        "email": member.email,
        "role": role,
        "phone": member.phone or "",
        "emergencyContact": member.emergency_contact or "",
        "dateOfBirth": format_date(member.date_of_birth),
        "team": member.team.name if member.team else "",
        "teamId": member.team_id,
        "position": member.position or "",
        "attendanceRate": member.attendance_rate,
        "payment": member.payment_status or "Inactive",
        "nextPayment": format_date(member.next_payment_date),
        "joined": format_pretty_date(member.joined_at),
        "joinedDate": format_date(member.joined_at),
        "lastActive": last_active_label(member.last_active_at),
        "lastActiveAt": format_date(member.last_active_at),
        "profileCompleteness": calculate_profile_completeness(member),
        "paymentAlert": payment_alert(member),
    }


def calculate_profile_completeness(member):
    fields = [
        member.full_name,
        member.email,
        member.phone,
        member.emergency_contact,
        member.date_of_birth,
        member.team_id,
        member.position,
        member.attendance_rate,
        member.payment_status,
        member.next_payment_date,
    ]

    completed = len([field for field in fields if field not in (None, "")])
    return round((completed / len(fields)) * 100)


def payment_alert(member):
    status = (member.payment_status or "").lower()

    if status in ("overdue", "pending"):
        return True

    if member.next_payment_date and member.next_payment_date < date.today():
        return True

    return False


def validate_required_member_payload(payload, creating=True):
    if creating:
        if not payload.get("name") or not payload.get("email"):
            return "Name and email are required"

    if payload.get("email") and "@" not in payload["email"]:
        return "Email must be valid"

    return None


def apply_member_updates(member, payload):
    if "name" in payload and payload.get("name") is not None:
        member.full_name = payload.get("name", "").strip()

    if "email" in payload and payload.get("email") is not None:
        member.email = payload.get("email", "").strip().lower()

    if "phone" in payload:
        member.phone = payload.get("phone") or ""

    if "emergencyContact" in payload:
        member.emergency_contact = payload.get("emergencyContact") or ""

    if "dateOfBirth" in payload:
        member.date_of_birth = parse_date(payload.get("dateOfBirth"), "dateOfBirth")

    if "teamId" in payload:
        member.team_id = payload.get("teamId") or None

    if "position" in payload:
        member.position = payload.get("position") or ""

    if "attendanceRate" in payload:
        member.attendance_rate = parse_optional_float(
            payload.get("attendanceRate"),
            "attendanceRate",
            minimum=0,
            maximum=100,
        )

    if "payment" in payload:
        member.payment_status = payload.get("payment") or "Inactive"

    if "nextPayment" in payload:
        member.next_payment_date = parse_date(payload.get("nextPayment"), "nextPayment")

    member.last_active_at = datetime.utcnow()


@member_bp.get("")
@jwt_required()
def list_members():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    role = (request.args.get("role") or "").upper()
    team_id = request.args.get("teamId")
    payment = request.args.get("payment")
    search = (request.args.get("search") or "").strip().lower()

    query = User.query

    if role:
        normalized_role = normalize_role(role)
        if normalized_role not in VALID_ROLES:
            return jsonify({"error": "Role must be MANAGER, COACH, or PLAYER"}), 400
        query = query.filter(User.role == normalized_role)

    if team_id:
        query = query.filter(User.team_id == team_id)

    if payment:
        query = query.filter(User.payment_status == payment)

    if search:
        query = query.filter(
            db.or_(
                db.func.lower(User.full_name).contains(search),
                db.func.lower(User.email).contains(search),
                db.func.lower(User.position).contains(search),
            )
        )

    members = query.order_by(User.full_name.asc()).all()
    return jsonify([serialize_member(member) for member in members])


@member_bp.get("/<int:member_id>")
@jwt_required()
def get_member(member_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    member = User.query.get_or_404(member_id)
    return jsonify(serialize_member(member))


@member_bp.post("")
@jwt_required()
def create_member():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}

    validation_error = validate_required_member_payload(payload, creating=True)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    role = normalize_role(payload.get("role") or ROLE_PLAYER)
    if role not in VALID_ROLES:
        return jsonify({"error": "Role must be MANAGER, COACH, or PLAYER"}), 400

    existing_user = User.query.filter(
        db.func.lower(User.email) == payload["email"].strip().lower()
    ).first()

    if existing_user:
        return jsonify({"error": "A member with this email already exists"}), 409

    member = User(
        full_name=payload["name"].strip(),
        email=payload["email"].strip().lower(),
        password=payload.get("password") or "demo123",
        role=role,
        joined_at=date.today(),
        last_active_at=datetime.utcnow(),
    )

    try:
        apply_member_updates(member, payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    db.session.add(member)
    db.session.commit()

    return jsonify(serialize_member(member)), 201


@member_bp.put("/<int:member_id>")
@jwt_required()
def update_member(member_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    member = User.query.get_or_404(member_id)
    payload = request.get_json(silent=True) or {}

    validation_error = validate_required_member_payload(payload, creating=False)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    if payload.get("email"):
        normalized_email = payload["email"].strip().lower()
        existing_user = User.query.filter(
            db.func.lower(User.email) == normalized_email,
            User.id != member.id,
        ).first()

        if existing_user:
            return jsonify({"error": "A different member already uses this email"}), 409

    if payload.get("role"):
        role = normalize_role(payload["role"])
        if role not in VALID_ROLES:
            return jsonify({"error": "Role must be MANAGER, COACH, or PLAYER"}), 400
        member.role = role

    try:
        apply_member_updates(member, payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    db.session.commit()
    return jsonify(serialize_member(member))


@member_bp.delete("/<int:member_id>")
@jwt_required()
def delete_member(member_id):
    current_user, error = current_user_or_error(ROLE_MANAGER)
    if error:
        return error

    if current_user.id == member_id:
        return jsonify({"error": "You cannot delete your own account from Club Management"}), 400

    member = User.query.get_or_404(member_id)

    from model import AttendanceResponse
    from model.stats import AIFeedback, Match, PlayerMatchStat, TeamMatchSummary
    from model.communication import Channel
    from model.booking import Booking
    from model.reference import Team

    PlayerMatchStat.query.filter_by(player_id=member_id).delete()
    AttendanceResponse.query.filter_by(user_id=member_id).delete()
    Booking.query.filter_by(created_by_user_id=member_id).update({"created_by_user_id": None})
    Match.query.filter_by(created_by_user_id=member_id).update({"created_by_user_id": None})
    Team.query.filter_by(coach_id=member_id).update({"coach_id": None})
    Channel.query.filter_by(created_by_user_id=member_id).update({"created_by_user_id": None})
    AIFeedback.query.filter_by(created_by_user_id=member_id).update({"created_by_user_id": None})
    TeamMatchSummary.query.filter_by(created_by_user_id=member_id).update({"created_by_user_id": None})

    db.session.delete(member)
    db.session.commit()

    return jsonify({"message": "Member deleted", "deletedId": member_id})