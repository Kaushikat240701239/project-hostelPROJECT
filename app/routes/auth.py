from flask import Blueprint, request, jsonify
from app import db, bcrypt
from app.models import User
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from functools import wraps

bp = Blueprint('auth', __name__, url_prefix='/api/auth')

def role_required(role):
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            if not user or user.role != role:
                return jsonify({"msg": "Forbidden"}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or user.role != 'admin':
            return jsonify({"msg": "Admin only"}), 403
        return fn(*args, **kwargs)
    return wrapper

@bp.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'student') # student, warden, staff, admin
    block = data.get('block')
    room_number = data.get('room_number')

    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "User already exists"}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(
        username=username, 
        password_hash=hashed_password, 
        role=role,
        block=block,
        room_number=room_number
    )
    
    db.session.add(new_user)
    try:
        db.session.commit()
        return jsonify({"msg": "User created successfully"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 500

@bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    user = User.query.filter_by(username=username).first()
    if user and bcrypt.check_password_hash(user.password_hash, password):
        if user.role != role:
            return jsonify({"msg": f"Invalid role for this user. You are registered as {user.role}"}), 401
            
        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            "access_token": access_token,
            "user": user.to_dict()
        }), 200

    return jsonify({"msg": "Invalid credentials"}), 401

@bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    return jsonify(user.to_dict()), 200
