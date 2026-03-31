from datetime import date, datetime

from flask import abort
from sqlalchemy import and_, or_

from extensions import db
from model import Booking, BookingException, Facility, Team


def parse_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    return datetime.strptime(value, "%Y-%m-%d").date()


def serialize_booking(booking):
    exception_dates = sorted(
        exception.exception_date.isoformat() for exception in booking.exceptions
    )
    return {
        "id": booking.id,
        "title": booking.title,
        "court": booking.facility.name,
        "facilityId": booking.facility_id,
        "team": booking.team.name if booking.team else None,
        "teamId": booking.team_id,
        "dayOfWeek": booking.day_of_week,
        "specificDate": booking.specific_date.isoformat() if booking.specific_date else None,
        "startHour": booking.start_hour,
        "endHour": booking.end_hour,
        "color": booking.color,
        "isRecurring": booking.is_recurring,
        "exceptions": exception_dates,
    }


def _booking_overlap_query(payload, booking_id=None):
    day_of_week = payload.get("day_of_week")
    specific_date = payload.get("specific_date")
    start_hour = int(payload["start_hour"])
    end_hour = int(payload["end_hour"])
    facility_id = int(payload["facility_id"])
    is_recurring = bool(payload["is_recurring"])

    query = Booking.query.filter(Booking.facility_id == facility_id)
    if booking_id:
        query = query.filter(Booking.id != booking_id)

    overlap_hours = and_(Booking.start_hour < end_hour, Booking.end_hour > start_hour)

    if is_recurring:
        day_match = Booking.day_of_week == day_of_week
        specific_match = False
        target_date = payload.get("anchor_date")
        if target_date:
            target_date = parse_date(target_date)
            specific_match = Booking.specific_date == target_date
        return query.filter(overlap_hours).filter(or_(day_match, specific_match))

    booking_date = parse_date(specific_date)
    weekday = booking_date.isoweekday()
    recurring_match = and_(Booking.is_recurring.is_(True), Booking.day_of_week == weekday)
    one_off_match = Booking.specific_date == booking_date
    return query.filter(overlap_hours).filter(or_(recurring_match, one_off_match))


def validate_booking_payload(payload):
    required = ["title", "facility_id", "start_hour", "end_hour", "is_recurring"]
    missing = [field for field in required if field not in payload]
    if missing:
        abort(400, description=f"Missing required fields: {', '.join(missing)}")

    start_hour = int(payload["start_hour"])
    end_hour = int(payload["end_hour"])
    if end_hour <= start_hour:
        abort(400, description="End hour must be later than start hour")

    Facility.query.get_or_404(int(payload["facility_id"]))
    if payload.get("team_id"):
        Team.query.get_or_404(int(payload["team_id"]))

    is_recurring = bool(payload["is_recurring"])
    if is_recurring and not payload.get("day_of_week"):
        abort(400, description="Recurring bookings require day_of_week")
    if not is_recurring and not payload.get("specific_date"):
        abort(400, description="One-time bookings require specific_date")


def ensure_no_overlaps(payload, booking_id=None):
    existing = _booking_overlap_query(payload, booking_id=booking_id).all()
    if not existing:
        return

    if payload.get("is_recurring") and payload.get("anchor_date"):
        target_date = parse_date(payload["anchor_date"])
        for booking in existing:
            if booking.is_recurring:
                if any(exception.exception_date == target_date for exception in booking.exceptions):
                    continue
            elif booking.specific_date != target_date:
                continue
            abort(409, description="This time slot overlaps with an existing booking")

    abort(409, description="This time slot overlaps with an existing booking")


def create_booking(payload):
    validate_booking_payload(payload)
    ensure_no_overlaps(payload)

    booking = Booking(
        title=payload["title"].strip(),
        color=payload.get("color", "blue"),
        is_recurring=bool(payload["is_recurring"]),
        day_of_week=int(payload["day_of_week"]) if payload.get("day_of_week") else None,
        specific_date=parse_date(payload.get("specific_date")),
        start_hour=int(payload["start_hour"]),
        end_hour=int(payload["end_hour"]),
        facility_id=int(payload["facility_id"]),
        team_id=int(payload["team_id"]) if payload.get("team_id") else None,
        created_by_user_id=int(payload["created_by_user_id"]) if payload.get("created_by_user_id") else None,
    )
    db.session.add(booking)
    db.session.commit()
    return booking


def delete_booking_instance(booking, instance_date):
    if not booking.is_recurring:
        db.session.delete(booking)
        db.session.commit()
        return

    parsed_date = parse_date(instance_date)
    if not any(exception.exception_date == parsed_date for exception in booking.exceptions):
        db.session.add(BookingException(booking_id=booking.id, exception_date=parsed_date))
        db.session.commit()
