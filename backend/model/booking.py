from datetime import datetime

from extensions import db


class Booking(db.Model):
    __tablename__ = "booking"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    color = db.Column(db.String(20), nullable=False, default="blue")
    is_recurring = db.Column(db.Boolean, nullable=False, default=True)
    day_of_week = db.Column(db.Integer, nullable=True)
    specific_date = db.Column(db.Date, nullable=True)
    recurrence_start_date = db.Column(db.Date, nullable=True)
    recurrence_end_date = db.Column(db.Date, nullable=True)
    notify_team = db.Column(db.Boolean, nullable=False, default=False)
    start_hour = db.Column(db.Numeric(5, 2, asdecimal=False), nullable=False)
    end_hour = db.Column(db.Numeric(5, 2, asdecimal=False), nullable=False)
    facility_id = db.Column(db.Integer, db.ForeignKey("facility.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)
    
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    facility = db.relationship("Facility", backref=db.backref("bookings", lazy=True))
    team = db.relationship("Team", backref=db.backref("bookings", lazy=True))
    
    # FIXED: Defined only once, explicitly linking to the foreign key column with the cascade fix
    created_by = db.relationship(
        "User",
        foreign_keys=[created_by_user_id],
        backref=db.backref("created_bookings", lazy=True),
    )


class BookingException(db.Model):
    __tablename__ = "booking_exception"
    __table_args__ = (
        db.UniqueConstraint("booking_id", "exception_date", name="uq_booking_exception_date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey("booking.id"), nullable=False)
    exception_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    booking = db.relationship(
        "Booking",
        backref=db.backref("exceptions", lazy=True, cascade="all, delete-orphan"),
    )
