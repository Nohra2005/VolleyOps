from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from model import Booking, Channel, Message
from services.access_control import ROLE_COACH, ROLE_MANAGER, current_user_or_error
from services.booking_service import (
    create_booking,
    delete_booking_instance,
    parse_date,
    serialize_booking,
    update_booking,
    update_booking_instance,
)

booking_bp = Blueprint("booking", __name__, url_prefix="/api/bookings")

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _fmt_hour(hour):
    if hour is None:
        return "TBD"
    h = int(float(hour))
    m = int((float(hour) - h) * 60)
    period = "AM" if h < 12 else "PM"
    h12 = h % 12 or 12
    return f"{h12} {period}" if m == 0 else f"{h12}:{m:02d} {period}"


def _notify_team_channel(booking, sender_id):
    if not booking.notify_team or not booking.team_id:
        return

    channel = Channel.query.filter_by(team_id=booking.team_id, is_system=True).first()
    if not channel:
        return

    if booking.is_recurring:
        day = DAYS[booking.day_of_week] if booking.day_of_week is not None else "TBD"
        schedule = f"every {day}"
    else:
        schedule = f"on {booking.specific_date.strftime('%B %d, %Y')}" if booking.specific_date else "TBD"

    facility = booking.facility.name if booking.facility else "TBD"
    time_range = f"{_fmt_hour(booking.start_hour)} – {_fmt_hour(booking.end_hour)}"
    content = f"Practice scheduled: {booking.title} — {schedule}, {time_range} at {facility}."

    db.session.add(Message(
        channel_id=channel.id,
        sender_id=sender_id,
        content=content,
        attachment_type="alert_schedule_change",
        is_pinned=True,
    ))


@booking_bp.get("")
@jwt_required()
def list_bookings():
    week_start_raw = request.args.get("weekStart")
    court = request.args.get("court")
    week_start = parse_date(week_start_raw) if week_start_raw else None
    week_end = week_start + timedelta(days=6) if week_start else None

    query = Booking.query
    if court:
        query = query.join(Booking.facility).filter_by(name=court)

    bookings = query.order_by(Booking.start_hour.asc(), Booking.id.asc()).all()
    serialized = []

    for booking in bookings:
        if week_start and week_end:
            if booking.is_recurring:
                recurrence_start = booking.recurrence_start_date or week_start
                recurrence_end = booking.recurrence_end_date or week_end
                if recurrence_end < week_start or recurrence_start > week_end:
                    continue
            else:
                if not booking.specific_date or not (week_start <= booking.specific_date <= week_end):
                    continue

        serialized.append(serialize_booking(booking))

    return jsonify(serialized)


@booking_bp.post("")
@jwt_required()
def create_booking_route():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    booking = create_booking(payload)
    _notify_team_channel(booking, sender_id=current_user.id)
    db.session.commit()
    return jsonify(serialize_booking(booking)), 201


@booking_bp.delete("/<int:booking_id>")
@jwt_required()
def delete_booking_route(booking_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    booking = Booking.query.get_or_404(booking_id)
    mode = request.args.get("mode", "all")
    instance_date = request.args.get("instanceDate")

    if mode == "instance":
        if not instance_date:
            return jsonify({"error": "instanceDate is required for instance deletion"}), 400
        delete_booking_instance(booking, instance_date)
        return jsonify({"message": "Booking instance removed"})

    db.session.delete(booking)
    db.session.commit()
    return jsonify({"message": "Booking deleted"})


@booking_bp.put("/<int:booking_id>")
@jwt_required()
def update_booking_route(booking_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    booking = Booking.query.get_or_404(booking_id)
    payload = request.get_json(silent=True) or {}
    mode = request.args.get("mode", "all")
    instance_date = request.args.get("instanceDate")

    if mode == "instance":
        updated_booking = update_booking_instance(booking, payload, instance_date)
    else:
        updated_booking = update_booking(booking, payload)

    if payload.get("notifyTeam") or payload.get("notify_team"):
        _notify_team_channel(updated_booking, sender_id=current_user.id)
        db.session.commit()

    return jsonify(serialize_booking(updated_booking))
