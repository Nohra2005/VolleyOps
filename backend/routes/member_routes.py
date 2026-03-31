from datetime import date, datetime

from flask import Blueprint, jsonify, request

from extensions import db
from model import User
from services.serialization import format_date, format_pretty_date, last_active_label

member_bp = Blueprint("member", __name__, url_prefix="/api/members")


def serialize_member(member):
    return {
        "id": member.id,
        "name": member.full_name,
        "email": member.email,
        "role": member.role,
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
def list_members():
    role = (request.args.get("role") or "").upper()
    query = User.query
    if role:
        query = query.filter(User.role == role)
    members = query.order_by(User.full_name.asc()).all()
    return jsonify([serialize_member(member) for member in members])


@member_bp.get("/<int:member_id>")
def get_member(member_id):
    member = User.query.get_or_404(member_id)
    return jsonify(serialize_member(member))


@member_bp.post("")
def create_member():
    payload = request.get_json(silent=True) or {}
    member = User(
        full_name=payload["name"].strip(),
        email=payload["email"].strip().lower(),
        password=payload.get("password", "demo123"),
        role=(payload.get("role") or "ATHLETE").upper(),
        joined_at=date.today(),
    )
    apply_member_updates(member, payload)
    db.session.add(member)
    db.session.commit()
    return jsonify(serialize_member(member)), 201


@member_bp.put("/<int:member_id>")
def update_member(member_id):
    member = User.query.get_or_404(member_id)
    payload = request.get_json(silent=True) or {}
    if payload.get("role"):
        member.role = payload["role"].upper()
    apply_member_updates(member, payload)
    db.session.commit()
    return jsonify(serialize_member(member))


@member_bp.delete("/<int:member_id>")
def delete_member(member_id):
    member = User.query.get_or_404(member_id)
    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "Member deleted"})
