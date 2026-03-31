from routes.auth_routes import auth_bp
from routes.booking_routes import booking_bp
from routes.communication_routes import communication_bp
from routes.member_routes import member_bp
from routes.play_routes import play_bp
from routes.reference_routes import reference_bp
from routes.stats_routes import stats_bp


def register_blueprints(app):
    app.register_blueprint(reference_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(member_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(play_bp)
    app.register_blueprint(stats_bp)
    app.register_blueprint(communication_bp)
