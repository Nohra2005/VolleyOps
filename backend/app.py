import os

from flask import Flask, jsonify

from db_config import DB_CONFIG, ensure_database_exists
from extensions import cors, db, jwt, ma
from routes import register_blueprints
from services.seed_service import demo_login_payload
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


with app.app_context():
    db.create_all()
    if model.User.query.count() > 0 and model.User.query.filter_by(role="ADMIN").count() == 0:
        first_user = model.User.query.order_by(model.User.id.asc()).first()
        first_user.role = "ADMIN"
        db.session.commit()
    # seed_database() is intentionally disabled; create users through signup/admin UI.


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
