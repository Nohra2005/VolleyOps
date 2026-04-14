from datetime import date, datetime, timedelta

from flask_jwt_extended import create_access_token

from extensions import db
from model import (
    AIFeedback,
    Booking,
    BookingException,
    Channel,
    ChannelMembership,
    Facility,
    Match,
    Message,
    Play,
    PlayerMatchStat,
    Team,
    User,
)
from services.access_control import ROLE_COACH, ROLE_MANAGER, ROLE_PLAYER, normalize_role
from services.stats_service import calculate_hitting_percentage, calculate_performance_score, generate_feedback_text


def seed_database():
    if Team.query.count() > 0:
        return

    teams = [
        Team(name="U16 Team", division="Youth", age_group="U16"),
        Team(name="U18 Team", division="Youth", age_group="U18"),
        Team(name="Division 1 Women", division="Division 1", age_group="Senior"),
        Team(name="Division 1 Men", division="Division 1", age_group="Senior"),
    ]
    facilities = [
        Facility(name="Court 1", location="Main Complex"),
        Facility(name="Court 2", location="Main Complex"),
        Facility(name="Main Hall", location="Arena"),
    ]
    db.session.add_all(teams + facilities)
    db.session.flush()

    users = [
        User(full_name="VolleyOps Manager", email="manager@volleyops.test", password="manager123", role=ROLE_MANAGER, phone="+961 70 000 000", joined_at=date(2025, 9, 1), payment_status="Paid", position="Club Manager", last_active_at=datetime.utcnow() - timedelta(minutes=3)),
        User(full_name="Tatiana Nohrat", email="tatiana@volleyops.test", password="demo123", role=ROLE_MANAGER, phone="+961 70 000 001", joined_at=date(2025, 9, 1), payment_status="Paid", team_id=teams[2].id, position="Team Manager", last_active_at=datetime.utcnow() - timedelta(minutes=5)),
        User(full_name="Christophe El Chababc", email="christophe@volleyops.test", password="demo123", role=ROLE_COACH, phone="+961 70 000 002", joined_at=date(2025, 9, 3), payment_status="Paid", team_id=teams[2].id, position="Head Coach", last_active_at=datetime.utcnow() - timedelta(hours=2)),
        User(full_name="Joey Saade", email="joey@volleyops.test", password="demo123", role=ROLE_PLAYER, phone="+961 70 000 003", emergency_contact="+961 70 100 003", date_of_birth=date(2007, 2, 14), attendance_rate=94, payment_status="Pending", next_payment_date=date.today() + timedelta(days=14), joined_at=date(2025, 9, 8), team_id=teams[1].id, position="Setter", last_active_at=datetime.utcnow() - timedelta(minutes=12)),
        User(full_name="Jad Mcheimech", email="jad@volleyops.test", password="demo123", role=ROLE_PLAYER, phone="+961 70 000 004", emergency_contact="+961 70 100 004", date_of_birth=date(2006, 6, 20), attendance_rate=88, payment_status="Overdue", next_payment_date=date.today() - timedelta(days=7), joined_at=date(2025, 9, 9), team_id=teams[2].id, position="Outside Hitter", last_active_at=datetime.utcnow() - timedelta(days=1, hours=1)),
        User(full_name="Mira Haddad", email="mira@volleyops.test", password="demo123", role=ROLE_COACH, phone="+961 70 000 005", joined_at=date(2025, 9, 4), payment_status="Paid", team_id=teams[1].id, position="Assistant Coach", last_active_at=datetime.utcnow() - timedelta(hours=6)),
        User(full_name="Lana Khoury", email="lana@volleyops.test", password="demo123", role=ROLE_PLAYER, phone="+961 70 000 006", emergency_contact="+961 70 100 006", date_of_birth=date(2008, 11, 4), attendance_rate=97, payment_status="Paid", next_payment_date=date.today() + timedelta(days=30), joined_at=date(2025, 9, 12), team_id=teams[1].id, position="Middle Blocker", last_active_at=datetime.utcnow() - timedelta(minutes=35)),
    ]
    db.session.add_all(users)
    db.session.flush()

    bookings = [
        Booking(title="U16 Team Practice", color="blue", is_recurring=True, day_of_week=1, start_hour=9, end_hour=11, facility_id=facilities[0].id, team_id=teams[0].id, created_by_user_id=users[1].id),
        Booking(title="Division 1 Women Training", color="green", is_recurring=True, day_of_week=3, start_hour=18, end_hour=20, facility_id=facilities[2].id, team_id=teams[2].id, created_by_user_id=users[2].id),
        Booking(title="Friendly Match Prep", color="purple", is_recurring=False, specific_date=date.today() + timedelta(days=2), start_hour=17, end_hour=19, facility_id=facilities[1].id, team_id=teams[1].id, created_by_user_id=users[5].id),
    ]
    db.session.add_all(bookings)
    db.session.flush()
    next_monday = date.today() + timedelta(days=(7 - date.today().weekday()) % 7)
    db.session.add(BookingException(booking_id=bookings[0].id, exception_date=next_monday))

    db.session.add(
        Play(
            name="Timeout Side-Out",
            owner_id=users[2].id,
            is_locked=False,
            court_view="FULL",
            playback_speed=1.0,
            lineup_json={"S": "Joey Saade", "OH1": "Jad Mcheimech", "MB1": "Lana Khoury"},
            annotations_json=[{"type": "arrow", "from": [10, 20], "to": [55, 40], "color": "#22c55e"}],
            highlights_json=[{"player": "Joey Saade", "color": "#f59e0b"}],
        )
    )

    match = Match(team_id=teams[1].id, opponent="Beirut Falcons", played_on=date.today() - timedelta(days=3), venue="AUB Gym", created_by_user_id=users[5].id)
    db.session.add(match)
    db.session.flush()

    stats_payloads = [
        {"player": users[3], "kills": 11, "attack_attempts": 24, "attack_errors": 4, "aces": 2, "blocks": 1, "digs": 7, "assists": 21, "receive_rating": 2.4},
        {"player": users[6], "kills": 8, "attack_attempts": 18, "attack_errors": 2, "aces": 1, "blocks": 4, "digs": 5, "assists": 2, "receive_rating": 1.8},
    ]

    stat_rows = []
    for payload in stats_payloads:
        stat = PlayerMatchStat(
            match_id=match.id,
            player_id=payload["player"].id,
            kills=payload["kills"],
            attack_attempts=payload["attack_attempts"],
            attack_errors=payload["attack_errors"],
            aces=payload["aces"],
            blocks=payload["blocks"],
            digs=payload["digs"],
            assists=payload["assists"],
            receive_rating=payload["receive_rating"],
            hitting_percentage=calculate_hitting_percentage(payload["kills"], payload["attack_attempts"], payload["attack_errors"]),
            performance_score=calculate_performance_score(payload),
        )
        stat_rows.append(stat)
        db.session.add(stat)
    db.session.flush()

    avg_score = round(sum(item.performance_score for item in stat_rows) / len(stat_rows), 2)
    for stat in stat_rows:
        db.session.add(
            AIFeedback(
                player_stat_id=stat.id,
                tone="encouraging",
                generated_text=generate_feedback_text(stat.player.full_name, stat.player.position, stat, tone="encouraging", team_average_score=avg_score),
                is_approved=True,
                created_by_user_id=users[2].id,
            )
        )

    channels = [
        Channel(name="#team-general", type="TEAM", team_id=teams[1].id),
        Channel(name="#division-1-women", type="TEAM", team_id=teams[2].id),
        Channel(name="#coaches-only", type="COACHES_ONLY", team_id=None),
    ]
    db.session.add_all(channels)
    db.session.flush()

    db.session.add_all(
        [
            ChannelMembership(channel_id=channels[0].id, user_id=users[3].id, is_online=True),
            ChannelMembership(channel_id=channels[0].id, user_id=users[5].id, is_online=True),
            ChannelMembership(channel_id=channels[1].id, user_id=users[2].id, is_online=True),
            ChannelMembership(channel_id=channels[1].id, user_id=users[4].id, is_online=False),
            ChannelMembership(channel_id=channels[2].id, user_id=users[2].id, is_online=True),
            ChannelMembership(channel_id=channels[2].id, user_id=users[5].id, is_online=True),
        ]
    )
    db.session.add_all(
        [
            Message(channel_id=channels[0].id, sender_id=users[5].id, content="Practice starts at 6 PM. Bring resistance bands.", attachment_type="schedule_reminder", is_pinned=True),
            Message(channel_id=channels[0].id, sender_id=users[3].id, content="I uploaded the serve receive clips from yesterday."),
            Message(channel_id=channels[2].id, sender_id=users[2].id, content="Please review the AI feedback before tonight's release.", is_pinned=True),
        ]
    )
    db.session.commit()


def demo_login_payload():
    users = User.query.order_by(User.full_name.asc()).all()
    return [
        {
            "email": user.email,
            "password": user.password,
            "role": normalize_role(user.role),
            "accessToken": create_access_token(identity=str(user.id), additional_claims={"role": normalize_role(user.role)}),
        }
        for user in users
    ]
