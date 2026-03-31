from flask import Blueprint, jsonify, request

from extensions import db
from model import Channel, Message

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
def list_channels():
    return jsonify([serialize_channel(channel) for channel in Channel.query.order_by(Channel.name.asc()).all()])


@communication_bp.get("/channels/<int:channel_id>/messages")
def list_messages(channel_id):
    channel = Channel.query.get_or_404(channel_id)
    return jsonify([serialize_message(message) for message in channel.messages])


@communication_bp.post("/channels/<int:channel_id>/messages")
def post_message(channel_id):
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
