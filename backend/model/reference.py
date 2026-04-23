from datetime import datetime

from extensions import db


class Team(db.Model):
    __tablename__ = "team"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    division = db.Column(db.String(120), nullable=False)
    age_group = db.Column(db.String(50), nullable=True)
    coach_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    coach = db.relationship("User", foreign_keys=[coach_id], backref=db.backref("coached_teams", lazy=True))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Facility(db.Model):
    __tablename__ = "facility"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    location = db.Column(db.String(120), nullable=True)
    operating_start_hour = db.Column(db.Integer, nullable=False, default=8)
    operating_end_hour = db.Column(db.Integer, nullable=False, default=22)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
