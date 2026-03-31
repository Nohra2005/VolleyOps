from datetime import datetime

from extensions import db


class Play(db.Model):
    __tablename__ = "play"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    is_locked = db.Column(db.Boolean, nullable=False, default=False)
    court_view = db.Column(db.String(20), nullable=False, default="FULL")
    playback_speed = db.Column(db.Float, nullable=False, default=1.0)
    lineup_json = db.Column(db.JSON, nullable=False, default=dict)
    annotations_json = db.Column(db.JSON, nullable=False, default=list)
    highlights_json = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    owner = db.relationship("User", backref=db.backref("plays", lazy=True))
