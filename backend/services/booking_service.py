from datetime import date, datetime, timedelta

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


def _iso(value):
    return value.isoformat() if value else None


def _round_quarter_hour(value):
    return round(round(float(value) * 4) / 4, 2)


def _is_quarter_hour(value):
    return abs(float(value) * 4 - round(float(value) * 4)) < 1e-9


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
        "specificDate": _iso(booking.specific_date),
        "recurrenceStartDate": _iso(booking.recurrence_start_date),
        "recurrenceEndDate": _iso(booking.recurrence_end_date),
        "startHour": float(booking.start_hour),
        "endHour": float(booking.end_hour),
        "color": booking.color,
        "isRecurring": booking.is_recurring,
        "notifyTeam": bool(getattr(booking, "notify_team", False)),
        "exceptions": exception_dates,
    }


def _normalize_payload(payload):
    normalized = dict(payload)
    normalized["is_recurring"] = bool(payload.get("is_recurring"))
    normalized["start_hour"] = _round_quarter_hour(payload["start_hour"])
    normalized["end_hour"] = _round_quarter_hour(payload["end_hour"])
    normalized["facility_id"] = int(payload["facility_id"])
    normalized["team_id"] = int(payload["team_id"]) if payload.get("team_id") else None
    normalized["day_of_week"] = (
        int(payload["day_of_week"]) if payload.get("day_of_week") else None
    )
    normalized["specific_date"] = parse_date(payload.get("specific_date"))
    normalized["anchor_date"] = parse_date(payload.get("anchor_date"))
    normalized["recurrence_start_date"] = parse_date(payload.get("recurrence_start_date"))
    normalized["recurrence_end_date"] = parse_date(payload.get("recurrence_end_date"))
    normalized["notify_team"] = bool(payload.get("notify_team"))
    return normalized


def _booking_active_on_date(booking, target_date):
    if booking.is_recurring:
        if booking.day_of_week != target_date.isoweekday():
            return False
        if booking.recurrence_start_date and target_date < booking.recurrence_start_date:
            return False
        if booking.recurrence_end_date and target_date > booking.recurrence_end_date:
            return False
        if any(exception.exception_date == target_date for exception in booking.exceptions):
            return False
        return True
    return booking.specific_date == target_date


def _date_ranges_intersect(start_a, end_a, start_b, end_b):
    return max(start_a, start_b) <= min(end_a, end_b)


def _booking_overlap_query(payload, booking_id=None):
    day_of_week = payload.get("day_of_week")
    specific_date = payload.get("specific_date")
    start_hour = payload["start_hour"]
    end_hour = payload["end_hour"]
    facility_id = payload["facility_id"]
    is_recurring = payload["is_recurring"]

    query = Booking.query.filter(Booking.facility_id == facility_id)
    if booking_id:
        query = query.filter(Booking.id != booking_id)

    overlap_hours = and_(Booking.start_hour < end_hour, Booking.end_hour > start_hour)

    if is_recurring:
        return query.filter(overlap_hours).filter(
            or_(Booking.day_of_week == day_of_week, Booking.specific_date.isnot(None))
        )

    booking_date = specific_date
    weekday = booking_date.isoweekday()
    return query.filter(overlap_hours).filter(
        or_(Booking.specific_date == booking_date, Booking.day_of_week == weekday)
    )


def validate_booking_payload(payload):
    required = ["title", "facility_id", "start_hour", "end_hour", "is_recurring"]
    missing = [field for field in required if field not in payload]
    if missing:
        abort(400, description=f"Missing required fields: {', '.join(missing)}")

    normalized = _normalize_payload(payload)

    if normalized["end_hour"] <= normalized["start_hour"]:
        abort(400, description="End hour must be later than start hour")

    if not _is_quarter_hour(normalized["start_hour"]) or not _is_quarter_hour(normalized["end_hour"]):
        abort(400, description="Booking times must align to 15-minute intervals")

    Facility.query.get_or_404(normalized["facility_id"])
    if normalized["team_id"]:
        Team.query.get_or_404(normalized["team_id"])

    if normalized["is_recurring"]:
        if not normalized["day_of_week"]:
            abort(400, description="Recurring bookings require day_of_week")

        recurrence_start = normalized["recurrence_start_date"] or normalized["anchor_date"]
        if not recurrence_start:
            abort(400, description="Recurring bookings require a recurrence_start_date")
        normalized["recurrence_start_date"] = recurrence_start

        if normalized["specific_date"]:
            normalized["specific_date"] = None

        recurrence_end = normalized["recurrence_end_date"]
        if recurrence_end and recurrence_end < recurrence_start:
            abort(400, description="Recurring end date must be on or after the start date")

        if recurrence_start.isoweekday() != normalized["day_of_week"]:
            abort(400, description="Recurring start date must match the selected weekday")
    else:
        if not normalized["specific_date"]:
            abort(400, description="One-time bookings require specific_date")
        normalized["day_of_week"] = None
        normalized["recurrence_start_date"] = None
        normalized["recurrence_end_date"] = None

    return normalized


def ensure_no_overlaps(payload, booking_id=None):
    existing = _booking_overlap_query(payload, booking_id=booking_id).all()
    if not existing:
        return

    if payload["is_recurring"]:
        requested_start = payload["recurrence_start_date"]
        requested_end = payload["recurrence_end_date"] or date.max

        for booking in existing:
            if booking.is_recurring:
                if booking.day_of_week != payload["day_of_week"]:
                    continue

                existing_start = booking.recurrence_start_date or date.min
                existing_end = booking.recurrence_end_date or date.max
                if not _date_ranges_intersect(requested_start, requested_end, existing_start, existing_end):
                    continue

                probe = requested_start
                while probe <= requested_end:
                    if probe.isoweekday() == payload["day_of_week"] and _booking_active_on_date(booking, probe):
                        abort(409, description="This time slot overlaps with an existing booking")
                    probe += timedelta(days=7)
            else:
                if _booking_active_on_date(booking, booking.specific_date):
                    booking_date = booking.specific_date
                    if booking_date >= requested_start and booking_date <= requested_end:
                        abort(409, description="This time slot overlaps with an existing booking")
        return

    for booking in existing:
        if _booking_active_on_date(booking, payload["specific_date"]):
            abort(409, description="This time slot overlaps with an existing booking")


def create_booking(payload):
    normalized = validate_booking_payload(payload)
    ensure_no_overlaps(normalized)

    booking = Booking(
        title=normalized["title"].strip(),
        color=normalized.get("color", "blue"),
        is_recurring=normalized["is_recurring"],
        day_of_week=normalized["day_of_week"],
        specific_date=normalized["specific_date"],
        recurrence_start_date=normalized["recurrence_start_date"],
        recurrence_end_date=normalized["recurrence_end_date"],
        notify_team=normalized["notify_team"],
        start_hour=normalized["start_hour"],
        end_hour=normalized["end_hour"],
        facility_id=normalized["facility_id"],
        team_id=normalized["team_id"],
        created_by_user_id=int(payload["created_by_user_id"]) if payload.get("created_by_user_id") else None,
    )
    db.session.add(booking)
    db.session.commit()
    return booking


def delete_booking_instance(booking, instance_date):
    parsed_date = parse_date(instance_date)

    if not booking.is_recurring:
        db.session.delete(booking)
        db.session.commit()
        return

    if booking.recurrence_start_date and parsed_date < booking.recurrence_start_date:
        abort(400, description="This recurring series is not active on that date")

    if booking.recurrence_end_date and parsed_date > booking.recurrence_end_date:
        abort(400, description="This recurring series is not active on that date")

    if parsed_date.isoweekday() != booking.day_of_week:
        abort(400, description="That date does not match this recurring booking")

    if not any(exception.exception_date == parsed_date for exception in booking.exceptions):
        db.session.add(BookingException(booking_id=booking.id, exception_date=parsed_date))
        db.session.commit()
