from datetime import datetime

from extensions import db


class User(db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    phone = db.Column(db.String(30), nullable=True)
    emergency_contact = db.Column(db.String(120), nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    attendance_rate = db.Column(db.Float, nullable=True)
    payment_status = db.Column(db.String(20), nullable=False, default="Pending")
    next_payment_date = db.Column(db.Date, nullable=True)
    joined_at = db.Column(db.Date, nullable=False)
    last_active_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)
    position = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    team = db.relationship("Team", backref=db.backref("members", lazy=True))
