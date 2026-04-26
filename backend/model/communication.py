from datetime import datetime

from extensions import db


class Channel(db.Model):
    __tablename__ = "channel"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    type = db.Column(db.String(20), nullable=False, default="TEAM")
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    is_system = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    team = db.relationship("Team", backref=db.backref("channels", lazy=True))
    created_by = db.relationship("User", backref=db.backref("created_channels", lazy=True))


class ChannelMembership(db.Model):
    __tablename__ = "channel_membership"
    __table_args__ = (
        db.UniqueConstraint("channel_id", "user_id", name="uq_channel_user"),
    )

    id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(db.Integer, db.ForeignKey("channel.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    is_online = db.Column(db.Boolean, nullable=False, default=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    channel = db.relationship(
        "Channel",
        backref=db.backref("memberships", lazy=True, cascade="all, delete-orphan"),
    )
    user = db.relationship("User", backref=db.backref("channel_memberships", lazy=True, cascade="all, delete-orphan"))


class Message(db.Model):
    __tablename__ = "message"

    id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(db.Integer, db.ForeignKey("channel.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    attachment_type = db.Column(db.String(40), nullable=True)
    is_pinned = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    channel = db.relationship("Channel", backref=db.backref("messages", lazy=True, cascade="all, delete-orphan"))
    sender = db.relationship("User", backref=db.backref("messages", lazy=True, cascade="all, delete-orphan"))


class NotificationDismissal(db.Model):
    __tablename__ = "notification_dismissal"
    __table_args__ = (
        db.UniqueConstraint("user_id", "notification_key", name="uq_notification_user_key"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    notification_key = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship(
        "User",
        backref=db.backref("dismissed_notifications", lazy=True, cascade="all, delete-orphan"),
    )
