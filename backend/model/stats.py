from datetime import datetime

from extensions import db


class Match(db.Model):
    __tablename__ = "match"

    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=False)
    opponent = db.Column(db.String(120), nullable=False)
    played_on = db.Column(db.Date, nullable=False)
    venue = db.Column(db.String(120), nullable=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    team = db.relationship("Team", backref=db.backref("matches", lazy=True))
    created_by = db.relationship("User", backref=db.backref("created_matches", lazy=True))


class PlayerMatchStat(db.Model):
    __tablename__ = "player_match_stat"
    __table_args__ = (
        db.UniqueConstraint("match_id", "player_id", name="uq_match_player_stat"),
    )

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey("match.id"), nullable=False)
    player_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    kills = db.Column(db.Integer, nullable=False, default=0)
    attack_attempts = db.Column(db.Integer, nullable=False, default=0)
    attack_errors = db.Column(db.Integer, nullable=False, default=0)
    aces = db.Column(db.Integer, nullable=False, default=0)
    blocks = db.Column(db.Integer, nullable=False, default=0)
    digs = db.Column(db.Integer, nullable=False, default=0)
    assists = db.Column(db.Integer, nullable=False, default=0)
    receive_rating = db.Column(db.Float, nullable=True)

    hitting_percentage = db.Column(db.Float, nullable=False, default=0)
    performance_score = db.Column(db.Float, nullable=False, default=0)

    coach_notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    match = db.relationship(
        "Match",
        backref=db.backref("player_stats", lazy=True, cascade="all, delete-orphan"),
    )
    player = db.relationship("User", backref=db.backref("match_stats", lazy=True))


class AIFeedback(db.Model):
    __tablename__ = "ai_feedback"

    id = db.Column(db.Integer, primary_key=True)
    player_stat_id = db.Column(db.Integer, db.ForeignKey("player_match_stat.id"), nullable=False)
    tone = db.Column(db.String(20), nullable=False, default="standard")
    generated_text = db.Column(db.Text, nullable=False)
    coach_edited_text = db.Column(db.Text, nullable=True)
    is_approved = db.Column(db.Boolean, nullable=False, default=False)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    player_stat = db.relationship(
        "PlayerMatchStat",
        backref=db.backref("feedback_items", lazy=True, cascade="all, delete-orphan"),
    )
    created_by = db.relationship("User", backref=db.backref("authored_feedback", lazy=True))


class TeamMatchSummary(db.Model):
    __tablename__ = "team_match_summary"
    __table_args__ = (
        db.UniqueConstraint("match_id", name="uq_team_match_summary_match"),
    )

    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey("match.id"), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey("team.id"), nullable=False)

    average_performance_score = db.Column(db.Float, nullable=False, default=0)
    average_hitting_percentage = db.Column(db.Float, nullable=False, default=0)
    total_kills = db.Column(db.Integer, nullable=False, default=0)
    total_attack_attempts = db.Column(db.Integer, nullable=False, default=0)
    total_attack_errors = db.Column(db.Integer, nullable=False, default=0)
    total_aces = db.Column(db.Integer, nullable=False, default=0)
    total_blocks = db.Column(db.Integer, nullable=False, default=0)
    total_digs = db.Column(db.Integer, nullable=False, default=0)
    total_assists = db.Column(db.Integer, nullable=False, default=0)

    strongest_metric = db.Column(db.String(80), nullable=True)
    weakest_metric = db.Column(db.String(80), nullable=True)
    generated_summary = db.Column(db.Text, nullable=True)
    coach_notes = db.Column(db.Text, nullable=True)

    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    match = db.relationship(
        "Match",
        backref=db.backref("team_summary", lazy=True, cascade="all, delete-orphan", uselist=False),
    )
    team = db.relationship("Team", backref=db.backref("match_summaries", lazy=True))
    created_by = db.relationship("User", backref=db.backref("authored_team_summaries", lazy=True))