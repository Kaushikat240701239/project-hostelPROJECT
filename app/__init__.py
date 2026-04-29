from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from config import Config

db = SQLAlchemy()
jwt = JWTManager()
bcrypt = Bcrypt()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    CORS(app)

    with app.app_context():
        from app.routes import main, auth, student, warden, staff, admin
        app.register_blueprint(main.bp)
        app.register_blueprint(auth.bp)
        app.register_blueprint(student.bp)
        app.register_blueprint(warden.bp)
        app.register_blueprint(staff.bp)
        app.register_blueprint(admin.bp)

        db.create_all()

    return app
