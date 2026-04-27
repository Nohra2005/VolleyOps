from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from model import AttendanceResponse, Booking, Channel, ChannelMembership, Match, Message, NotificationDismissal, Team, User
from services.access_control import (
    ROLE_COACH,
    ROLE_MANAGER,
    ROLE_PLAYER,
    current_user_or_error,
    normalize_role,
)

communication_bp = Blueprint("communication", __name__, url_prefix="/api/communications")

CHANNEL_ANNOUNCEMENT = "ANNOUNCEMENT"
CHANNEL_PUBLIC = "PUBLIC"
CHANNEL_TEAM = "TEAM"
CHANNEL_STAFF = "STAFF"
CHANNEL_COACHES_ONLY = "COACHES_ONLY"

PUBLIC_TYPES = {CHANNEL_ANNOUNCEMENT, CHANNEL_PUBLIC}
STAFF_TYPES = {CHANNEL_STAFF, CHANNEL_COACHES_ONLY}

ALLOWED_CHANNEL_TYPES = PUBLIC_TYPES | STAFF_TYPES | {CHANNEL_TEAM}


def now_utc():
    return datetime.utcnow()


def team_slug(name):
    clean = "".join(character.lower() if character.isalnum() else "-" for character in name.strip())
    return "-".join(part for part in clean.split("-") if part)


def ensure_base_channels():
    created = False
    memberships_added = 0

    def ensure_channel(name, channel_type, team_id=None):
        nonlocal created
        channel = Channel.query.filter_by(name=name).first()
        if channel:
            if not channel.is_system:
                channel.is_system = True
                created = True
            if channel.type != channel_type:
                channel.type = channel_type
                created = True
            if channel.team_id != team_id:
                channel.team_id = team_id
                created = True
            return channel

        channel = Channel(name=name, type=channel_type, team_id=team_id, is_system=True)
        db.session.add(channel)
        db.session.flush()
        created = True
        return channel

    announcement_channel = ensure_channel("#club-announcements", CHANNEL_ANNOUNCEMENT)
    staff_channel = ensure_channel("#coaches-staff", CHANNEL_STAFF)

    team_channels = []
    for team in Team.query.order_by(Team.name.asc()).all():
        channel_name = f"#team-{team_slug(team.name)}"
        team_channels.append(ensure_channel(channel_name, CHANNEL_TEAM, team_id=team.id))

    channels = [announcement_channel, staff_channel, *team_channels]
    for channel in channels:
        memberships_added += sync_channel_memberships(channel)

    if created or memberships_added:
        db.session.commit()


def sync_channel_memberships(channel):
    channel_type = (channel.type or "").upper()

    if channel_type in PUBLIC_TYPES:
        eligible_users = User.query.all()
    elif channel_type in STAFF_TYPES:
        eligible_users = [
            user
            for user in User.query.all()
            if normalize_role(user.role) in {ROLE_MANAGER, ROLE_COACH}
        ]
    elif channel_type == CHANNEL_TEAM:
        team_coach_id = None
        if channel.team_id:
            team = Team.query.get(channel.team_id)
            if team:
                team_coach_id = team.coach_id
        eligible_users = [
            user
            for user in User.query.all()
            if normalize_role(user.role) == ROLE_MANAGER
            or user.team_id == channel.team_id
            or (team_coach_id and user.id == team_coach_id)
        ]
    else:
        eligible_users = []

    existing_memberships = {membership.user_id for membership in channel.memberships}
    added = 0
    for user in eligible_users:
        if user.id not in existing_memberships:
            db.session.add(ChannelMembership(channel_id=channel.id, user_id=user.id, is_online=False))
            added += 1

    return added


def role_capabilities(role):
    normalized = normalize_role(role)
    is_manager = normalized == ROLE_MANAGER
    is_coach = normalized == ROLE_COACH

    return {
        "canCreateChannel": is_manager or is_coach,
        "canCreateStaffChannel": is_manager,
        "canSendAlert": is_manager or is_coach,
        "canPinMessage": is_manager or is_coach,
        "canManageMemberships": is_manager,
        "canDeleteNotifications": True,
    }


def can_manage_channel(current_user, channel):
    role = normalize_role(current_user.role)
    if channel.is_system:
        return False

    if role == ROLE_MANAGER:
        return True

    if role == ROLE_COACH and channel.created_by_user_id == current_user.id:
        return True

    return False


def user_has_channel_access(user, channel):
    role = normalize_role(user.role)
    channel_type = (channel.type or "").upper()

    if role == ROLE_MANAGER:
        return True

    if any(membership.user_id == user.id for membership in channel.memberships):
        return True

    if channel_type in PUBLIC_TYPES:
        return True

    if channel_type in STAFF_TYPES:
        return role in {ROLE_MANAGER, ROLE_COACH}

    if channel_type == CHANNEL_TEAM:
        if user.team_id and user.team_id == channel.team_id:
            return True

        if role == ROLE_COACH and channel.team_id:
            team = Team.query.get(channel.team_id)
            return bool(team and team.coach_id == user.id)

        return False

    return False


def teams_visible_to_user(user):
    role = normalize_role(user.role)
    if role == ROLE_MANAGER:
        return {team.id for team in Team.query.all()}

    team_ids = set()
    if user.team_id:
        team_ids.add(user.team_id)

    if role == ROLE_COACH:
        for team in Team.query.filter_by(coach_id=user.id).all():
            team_ids.add(team.id)

    return team_ids


def serialize_channel(channel, current_user):
    sorted_messages = sorted(channel.messages, key=lambda item: item.created_at or datetime.min)
    latest_message = sorted_messages[-1] if sorted_messages else None

    unread_count = 0
    for message in sorted_messages:
        if message.sender_id == current_user.id:
            continue
        if message.created_at and current_user.last_active_at and message.created_at > current_user.last_active_at:
            unread_count += 1

    return {
        "id": channel.id,
        "name": channel.name,
        "type": (channel.type or "").upper(),
        "teamId": channel.team_id,
        "onlineCount": sum(1 for membership in channel.memberships if membership.is_online),
        "memberCount": len(channel.memberships),
        "unreadCount": unread_count,
        "latestMessageAt": latest_message.created_at.isoformat() if latest_message else None,
        "latestMessagePreview": (latest_message.content[:90] if latest_message else ""),
        "isSystem": bool(channel.is_system),
        "canEdit": can_manage_channel(current_user, channel),
        "canDelete": can_manage_channel(current_user, channel),
    }


def serialize_message(message, current_user_id=None):
    is_event_poll = message.attachment_type == "event_poll"
    attendance_counts = None
    user_response = None

    if is_event_poll:
        responses = message.attendance_responses
        attendance_counts = {
            "ATTENDING": sum(1 for r in responses if r.status == "ATTENDING"),
            "NOT_ATTENDING": sum(1 for r in responses if r.status == "NOT_ATTENDING"),
            "TENTATIVE": sum(1 for r in responses if r.status == "TENTATIVE"),
        }
        if current_user_id is not None:
            user_r = next((r for r in responses if r.user_id == current_user_id), None)
            user_response = user_r.status if user_r else None

    return {
        "id": message.id,
        "channelId": message.channel_id,
        "senderId": message.sender_id,
        "senderName": message.sender.full_name if message.sender else "Unknown sender",
        "content": message.content,
        "attachmentType": message.attachment_type,
        "isPinned": message.is_pinned,
        "isEventPoll": is_event_poll,
        "attendanceCounts": attendance_counts,
        "userResponse": user_response,
        "createdAt": message.created_at.isoformat() if message.created_at else None,
    }


def build_notifications(current_user, visible_channels):
    role = normalize_role(current_user.role)
    visible_team_ids = teams_visible_to_user(current_user)
    notifications = []
    now = now_utc()

    recent_messages = (
        Message.query
        .filter(Message.channel_id.in_([channel.id for channel in visible_channels]) if visible_channels else False)
        .filter(Message.created_at >= now - timedelta(days=14))
        .order_by(Message.created_at.desc())
        .limit(15)
        .all()
    ) if visible_channels else []

    for message in recent_messages:
        attachment_type = (message.attachment_type or "").lower()
        is_alert = attachment_type.startswith("alert_") or message.is_pinned
        if not is_alert:
            continue

        notifications.append(
            {
                "id": f"msg:{message.id}",
                "type": "CHANNEL_ALERT",
                "title": "Important channel update",
                "message": message.content,
                "timestamp": message.created_at.isoformat() if message.created_at else None,
                "channelId": message.channel_id,
            }
        )

    recent_bookings = (
        Booking.query
        .filter(Booking.updated_at >= now - timedelta(days=21))
        .order_by(Booking.updated_at.desc())
        .limit(20)
        .all()
    )

    for booking in recent_bookings:
        if role != ROLE_MANAGER and booking.team_id and booking.team_id not in visible_team_ids:
            continue

        changed = abs((booking.updated_at - booking.created_at).total_seconds()) > 120
        action = "updated" if changed else "added"

        notifications.append(
            {
                "id": f"booking:{booking.id}:{booking.updated_at.isoformat() if booking.updated_at else ''}",
                "type": "PRACTICE_UPDATE",
                "title": f"Practice {action}",
                "message": f"{booking.title} at {booking.facility.name if booking.facility else 'Unknown court'} was {action}.",
                "timestamp": booking.updated_at.isoformat() if booking.updated_at else None,
                "teamId": booking.team_id,
            }
        )

    recent_matches = (
        Match.query
        .filter(Match.created_at >= now - timedelta(days=30))
        .order_by(Match.created_at.desc())
        .limit(12)
        .all()
    )

    for match in recent_matches:
        if role != ROLE_MANAGER and match.team_id not in visible_team_ids:
            continue

        notifications.append(
            {
                "id": f"match:{match.id}:{match.created_at.isoformat() if match.created_at else ''}",
                "type": "MATCH_UPDATE",
                "title": "New match update",
                "message": f"{match.team.name if match.team else 'Team'} vs {match.opponent} on {match.played_on.isoformat()}",
                "timestamp": match.created_at.isoformat() if match.created_at else None,
                "teamId": match.team_id,
            }
        )

    notifications.sort(key=lambda item: item.get("timestamp") or "", reverse=True)

    dismissed = {
        row.notification_key
        for row in NotificationDismissal.query.filter_by(user_id=current_user.id).all()
    }
    visible_notifications = [
        item for item in notifications if item["id"] not in dismissed
    ]
    return visible_notifications[:20]


def visible_channels_for_user(current_user):
    channels = Channel.query.order_by(Channel.name.asc()).all()
    return [channel for channel in channels if user_has_channel_access(current_user, channel)]


@communication_bp.get("/overview")
@jwt_required()
def communication_overview():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    ensure_base_channels()
    channels = visible_channels_for_user(current_user)

    return jsonify(
        {
            "role": normalize_role(current_user.role),
            "capabilities": role_capabilities(current_user.role),
            "channels": [serialize_channel(channel, current_user) for channel in channels],
            "notifications": build_notifications(current_user, channels),
        }
    )


@communication_bp.get("/channels")
@jwt_required()
def list_channels():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    ensure_base_channels()
    channels = visible_channels_for_user(current_user)
    return jsonify([serialize_channel(channel, current_user) for channel in channels])


@communication_bp.post("/channels")
@jwt_required()
def create_channel():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Channel name is required"}), 400

    channel_type = (payload.get("type") or CHANNEL_TEAM).upper()
    if channel_type not in ALLOWED_CHANNEL_TYPES:
        return jsonify({"error": "Invalid channel type"}), 400

    role = normalize_role(current_user.role)
    if role != ROLE_MANAGER and channel_type in STAFF_TYPES:
        return jsonify({"error": "Only managers can create staff-only channels"}), 403

    team_id = payload.get("teamId")
    if channel_type == CHANNEL_TEAM:
        if not team_id:
            team_id = current_user.team_id
        if not team_id:
            return jsonify({"error": "teamId is required for team channels"}), 400

        team = Team.query.get(int(team_id))
        if not team:
            return jsonify({"error": "Team does not exist"}), 404

        if role == ROLE_COACH and team.coach_id != current_user.id and current_user.team_id != team.id:
            return jsonify({"error": "Coaches can only create channels for their own teams"}), 403
    else:
        team_id = None

    if Channel.query.filter_by(name=name).first():
        return jsonify({"error": "A channel with this name already exists"}), 409

    channel = Channel(
        name=name,
        type=channel_type,
        team_id=team_id,
        created_by_user_id=current_user.id,
        is_system=False,
    )
    db.session.add(channel)
    db.session.flush()

    sync_channel_memberships(channel)
    db.session.commit()

    return jsonify(serialize_channel(channel, current_user)), 201


@communication_bp.put("/channels/<int:channel_id>")
@jwt_required()
def update_channel(channel_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    channel = Channel.query.get_or_404(channel_id)
    if not can_manage_channel(current_user, channel):
        return jsonify({"error": "You do not have permission to edit this channel"}), 403

    payload = request.get_json(silent=True) or {}
    next_name = (payload.get("name") or channel.name).strip()
    if not next_name:
        return jsonify({"error": "Channel name is required"}), 400

    existing = Channel.query.filter(Channel.name == next_name, Channel.id != channel.id).first()
    if existing:
        return jsonify({"error": "A channel with this name already exists"}), 409

    channel.name = next_name

    if channel.type == CHANNEL_TEAM and "teamId" in payload:
        next_team_id = payload.get("teamId")
        if not next_team_id:
            return jsonify({"error": "teamId is required for team channels"}), 400

        team = Team.query.get(int(next_team_id))
        if not team:
            return jsonify({"error": "Team does not exist"}), 404

        role = normalize_role(current_user.role)
        if role == ROLE_COACH and team.coach_id != current_user.id and current_user.team_id != team.id:
            return jsonify({"error": "Coaches can only assign channels to their own teams"}), 403

        channel.team_id = team.id

    sync_channel_memberships(channel)
    db.session.commit()
    return jsonify(serialize_channel(channel, current_user))


@communication_bp.delete("/channels/<int:channel_id>")
@jwt_required()
def delete_channel(channel_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    channel = Channel.query.get_or_404(channel_id)
    if not can_manage_channel(current_user, channel):
        return jsonify({"error": "You do not have permission to delete this channel"}), 403

    db.session.delete(channel)
    db.session.commit()
    return jsonify({"message": "Channel deleted", "deletedId": channel_id})


@communication_bp.get("/channels/<int:channel_id>/messages")
@jwt_required()
def list_messages(channel_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    channel = Channel.query.get_or_404(channel_id)
    if not user_has_channel_access(current_user, channel):
        return jsonify({"error": "You do not have access to this channel"}), 403

    messages = Message.query.filter_by(channel_id=channel_id).order_by(Message.created_at.asc(), Message.id.asc()).all()
    current_user.last_active_at = now_utc()
    db.session.commit()
    return jsonify([serialize_message(message, current_user_id=current_user.id) for message in messages])


@communication_bp.post("/channels/<int:channel_id>/messages")
@jwt_required()
def post_message(channel_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    channel = Channel.query.get_or_404(channel_id)
    if not user_has_channel_access(current_user, channel):
        return jsonify({"error": "You do not have access to this channel"}), 403

    payload = request.get_json(silent=True) or {}
    content = (payload.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Message content is required"}), 400

    role = normalize_role(current_user.role)
    is_alert = bool(payload.get("isAlert", False))
    can_pin = role in {ROLE_MANAGER, ROLE_COACH}

    if is_alert and role not in {ROLE_MANAGER, ROLE_COACH}:
        return jsonify({"error": "Only managers and coaches can send alerts"}), 403

    is_event_poll = payload.get("attachmentType") == "event_poll"
    if is_event_poll and role not in {ROLE_MANAGER, ROLE_COACH}:
        return jsonify({"error": "Only managers and coaches can create event polls"}), 403

    message = Message(
        channel_id=channel_id,
        sender_id=current_user.id,
        content=content,
        attachment_type=(payload.get("attachmentType") or ("alert_general" if is_alert else None)),
        is_pinned=bool(payload.get("isPinned", False)) if can_pin else False,
    )

    if is_alert or is_event_poll:
        message.is_pinned = True

    db.session.add(message)
    db.session.commit()

    return jsonify(serialize_message(message, current_user_id=current_user.id)), 201


@communication_bp.post("/attendance")
@jwt_required()
def record_attendance():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    message_id = payload.get("messageId")
    status = (payload.get("status") or "").upper()

    if not message_id:
        return jsonify({"error": "messageId is required"}), 400

    if status not in {"ATTENDING", "NOT_ATTENDING", "TENTATIVE"}:
        return jsonify({"error": "status must be ATTENDING, NOT_ATTENDING, or TENTATIVE"}), 400

    message = Message.query.get_or_404(int(message_id))
    if message.attachment_type != "event_poll":
        return jsonify({"error": "This message is not an event poll"}), 400

    existing = AttendanceResponse.query.filter_by(message_id=message.id, user_id=current_user.id).first()
    if existing:
        existing.status = status
    else:
        db.session.add(AttendanceResponse(message_id=message.id, user_id=current_user.id, status=status))

    db.session.commit()
    return jsonify({"messageId": message.id, "status": status})


@communication_bp.post("/notifications/dismiss")
@jwt_required()
def dismiss_notification():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    notification_id = (payload.get("notificationId") or "").strip()
    if not notification_id:
        return jsonify({"error": "notificationId is required"}), 400

    existing = NotificationDismissal.query.filter_by(
        user_id=current_user.id,
        notification_key=notification_id,
    ).first()
    if not existing:
        db.session.add(
            NotificationDismissal(
                user_id=current_user.id,
                notification_key=notification_id,
            )
        )
        db.session.commit()

    return jsonify({"dismissed": True, "notificationId": notification_id})
