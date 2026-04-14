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
        "lineup": play.lineup_json,
        "annotations": play.annotations_json,
        "highlights": play.highlights_json,
    }


@play_bp.get("")
@jwt_required()
def list_plays():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error
    return jsonify([serialize_play(play) for play in Play.query.order_by(Play.updated_at.desc()).all()])


@play_bp.post("")
@jwt_required()
def create_play():
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    play = Play(
        name=payload["name"].strip(),
        owner_id=int(payload["ownerId"]),
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


@play_bp.post("/<int:play_id>/duplicate")
@jwt_required()
def duplicate_play(play_id):
    _, error = current_user_or_error(ROLE_MANAGER, ROLE_COACH)
    if error:
        return error
    original = Play.query.get_or_404(play_id)
    duplicated = Play(
        name=f"{original.name} Copy",
        owner_id=original.owner_id,
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
