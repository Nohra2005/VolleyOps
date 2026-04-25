from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db
from model import Play
from services.access_control import ROLE_COACH, ROLE_MANAGER, current_user_or_error

play_bp = Blueprint("play", __name__, url_prefix="/api/plays")


def serialize_play(play):
    return {
        "id": play.id,
        "name": play.name,
        "ownerId": play.owner_id,
        "isLocked": play.is_locked,
        "courtView": play.court_view,
        "playbackSpeed": play.playback_speed,
        "lineup": play.lineup_json or {},
        "annotations": play.annotations_json or [],
        "highlights": play.highlights_json or [],
        "createdAt": play.created_at.isoformat() if play.created_at else None,
        "updatedAt": play.updated_at.isoformat() if play.updated_at else None,
    }


def apply_play_payload(play, payload):
    if "name" in payload:
        play.name = (payload.get("name") or "Untitled Play").strip()

    if "ownerId" in payload and payload.get("ownerId"):
        play.owner_id = int(payload["ownerId"])

    if "isLocked" in payload:
        play.is_locked = bool(payload["isLocked"])

    if "courtView" in payload:
        play.court_view = payload.get("courtView") or "FULL"

    if "playbackSpeed" in payload:
        play.playback_speed = float(payload.get("playbackSpeed") or 1.0)

    if "lineup" in payload:
        play.lineup_json = payload.get("lineup") or {}

    if "annotations" in payload:
        play.annotations_json = payload.get("annotations") or []

    if "highlights" in payload:
        play.highlights_json = payload.get("highlights") or []


@play_bp.get("")
@jwt_required()
def list_plays():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    plays = Play.query.order_by(Play.updated_at.desc()).all()
    return jsonify([serialize_play(play) for play in plays])


@play_bp.post("")
@jwt_required()
def create_play():
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    payload = request.get_json(silent=True) or {}

    play = Play(
        name=(payload.get("name") or "Untitled Play").strip(),
        owner_id=int(payload.get("ownerId") or current_user.id),
        is_locked=bool(payload.get("isLocked", False)),
        court_view=payload.get("courtView", "FULL"),
        playback_speed=float(payload.get("playbackSpeed", 1.0)),
        lineup_json=payload.get("lineup", {}),
        annotations_json=payload.get("annotations", []),
        highlights_json=payload.get("highlights", []),
    )

    db.session.add(play)
    db.session.commit()
    return jsonify(serialize_play(play)), 201


@play_bp.put("/<int:play_id>")
@jwt_required()
def update_play(play_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    play = Play.query.get_or_404(play_id)

    if play.is_locked:
        return jsonify({"error": "This play is locked and cannot be edited"}), 403

    payload = request.get_json(silent=True) or {}
    apply_play_payload(play, payload)

    db.session.commit()
    return jsonify(serialize_play(play))


@play_bp.post("/<int:play_id>/duplicate")
@jwt_required()
def duplicate_play(play_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    original = Play.query.get_or_404(play_id)

    duplicated = Play(
        name=f"{original.name} Copy",
        owner_id=current_user.id,
        is_locked=False,
        court_view=original.court_view,
        playback_speed=original.playback_speed,
        lineup_json=original.lineup_json,
        annotations_json=original.annotations_json,
        highlights_json=original.highlights_json,
    )

    db.session.add(duplicated)
    db.session.commit()
    return jsonify(serialize_play(duplicated)), 201


@play_bp.delete("/<int:play_id>")
@jwt_required()
def delete_play(play_id):
    current_user, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error

    play = Play.query.get_or_404(play_id)

    if play.is_locked:
        return jsonify({"error": "This play is locked and cannot be deleted"}), 403

    db.session.delete(play)
    db.session.commit()
    return jsonify({"message": "Play deleted", "deletedId": play_id})