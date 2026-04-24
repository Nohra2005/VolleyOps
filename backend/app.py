import os

from flask import Flask, jsonify
from sqlalchemy import inspect, text

from db_config import DB_CONFIG, ensure_database_exists
from extensions import cors, db, jwt, ma
from routes import register_blueprints
from services.seed_service import demo_login_payload, seed_database
from services.access_control import ROLE_MANAGER, normalize_role
import model

ensure_database_exists()


app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = DB_CONFIG
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = os.getenv("SECRET_KEY", "volleyops-dev-secret")
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

db.init_app(app)
ma.init_app(app)
jwt.init_app(app)
cors.init_app(app, resources={r"/api/*": {"origins": CORS_ORIGIN}})

register_blueprints(app)


@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": getattr(error, "description", "Bad request")}), 400


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": getattr(error, "description", "Not found")}), 404


@app.errorhandler(409)
def conflict(error):
    return jsonify({"error": getattr(error, "description", "Conflict")}), 409


@app.get("/api/demo/logins")
def demo_logins():
    return jsonify(demo_login_payload())


def ensure_booking_schema_updates():
    inspector = inspect(db.engine)
    if "booking" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("booking")}
    statements = []

    if "recurrence_start_date" not in columns:
        statements.append(
            "ALTER TABLE booking ADD COLUMN recurrence_start_date DATE NULL"
        )
    if "recurrence_end_date" not in columns:
        statements.append(
            "ALTER TABLE booking ADD COLUMN recurrence_end_date DATE NULL"
        )
    if "notify_team" not in columns:
        statements.append(
            "ALTER TABLE booking ADD COLUMN notify_team BOOLEAN NOT NULL DEFAULT 0"
        )

    if not statements:
        return

    with db.engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

        connection.execute(
            text(
                """
                UPDATE booking
                SET recurrence_start_date = specific_date
                WHERE is_recurring = 1
                  AND recurrence_start_date IS NULL
                  AND specific_date IS NOT NULL
                """
            )
        )


def normalize_user_roles():
    users = model.User.query.all()
    changed = False

    for user in users:
        normalized_role = normalize_role(user.role)
        if user.role != normalized_role:
            user.role = normalized_role
            changed = True

    if changed:
        db.session.commit()


with app.app_context():
    db.create_all()
    normalize_user_roles()
    ensure_booking_schema_updates()
    #seed_database()

    if model.User.query.count() > 0 and model.User.query.filter_by(role=ROLE_MANAGER).count() == 0:
        first_user = model.User.query.order_by(model.User.id.asc()).first()
        first_user.role = ROLE_MANAGER
        db.session.commit()
    # seed_database()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
