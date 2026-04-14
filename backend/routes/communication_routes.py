from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from model import Channel, Message
from services.access_control import ROLE_COACH, ROLE_MANAGER, ROLE_PLAYER, current_user_or_error

communication_bp = Blueprint("communication", __name__, url_prefix="/api/communications")


def serialize_channel(channel):
    return {
        "id": channel.id,
        "name": channel.name,
        "type": channel.type,
        "teamId": channel.team_id,
        "onlineCount": sum(1 for membership in channel.memberships if membership.is_online),
        "memberCount": len(channel.memberships),
    }


def serialize_message(message):
    return {
        "id": message.id,
        "channelId": message.channel_id,
        "senderId": message.sender_id,
        "senderName": message.sender.full_name,
        "content": message.content,
        "attachmentType": message.attachment_type,
        "isPinned": message.is_pinned,
        "createdAt": message.created_at.isoformat(),
    }


@communication_bp.get("/channels")
@jwt_required()
def list_channels():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error
    return jsonify([serialize_channel(channel) for channel in Channel.query.order_by(Channel.name.asc()).all()])


@communication_bp.get("/channels/<int:channel_id>/messages")
@jwt_required()
def list_messages(channel_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error
    channel = Channel.query.get_or_404(channel_id)
    return jsonify([serialize_message(message) for message in channel.messages])


@communication_bp.post("/channels/<int:channel_id>/messages")
@jwt_required()
def post_message(channel_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH, ROLE_PLAYER)
    if error:
        return error
    Channel.query.get_or_404(channel_id)
    payload = request.get_json(silent=True) or {}
    message = Message(
        channel_id=channel_id,
        sender_id=int(payload["senderId"]),
        content=payload["content"].strip(),
        attachment_type=payload.get("attachmentType"),
        is_pinned=bool(payload.get("isPinned", False)),
    )
    db.session.add(message)
    db.session.commit()
    return jsonify(serialize_message(message)), 201
