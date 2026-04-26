from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from model import Booking
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
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    booking = create_booking(payload)
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
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
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

    return jsonify(serialize_booking(updated_booking))
