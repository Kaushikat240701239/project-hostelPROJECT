from flask import Blueprint, request, jsonify
from app import db
from app.models import Complaint, User, Notification
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

bp = Blueprint('student', __name__, url_prefix='/api/student')

@bp.route('/complaints', methods=['POST'])
@jwt_required()
def submit_complaint():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role != 'student':
        return jsonify({"msg": "Student identity required"}), 403

    data = request.json
    new_complaint = Complaint(
        student_id=current_user_id,
        complaint_type=data.get('complaint_type'),
        description=data.get('description'),
        block=user.block or data.get('block'),
        room_number=user.room_number or data.get('room_number'),
        status='Pending'
    )
    
    db.session.add(new_complaint)
    db.session.commit()
    
    return jsonify({"msg": "Complaint submitted", "id": new_complaint.id}), 201

@bp.route('/complaints', methods=['GET'])
@jwt_required()
def get_complaints():
    current_user_id = get_jwt_identity()
    complaints = Complaint.query.filter_by(student_id=current_user_id).order_by(Complaint.created_at.desc()).all()
    return jsonify([c.to_dict() for c in complaints]), 200

@bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    current_user_id = get_jwt_identity()
    complaints = Complaint.query.filter_by(student_id=current_user_id).all()
    
    stats = {
        "total": len(complaints),
        "pending": len([c for c in complaints if c.status == 'Pending']),
        "in_progress": len([c for c in complaints if c.status == 'In Progress']),
        "resolved": len([c for c in complaints if c.status == 'Resolved']),
        "rejected": len([c for c in complaints if c.status == 'Rejected'])
    }
    return jsonify(stats), 200

@bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    current_user_id = get_jwt_identity()
    notifs = Notification.query.filter_by(user_id=current_user_id).order_by(Notification.created_at.desc()).limit(10).all()
    return jsonify([n.to_dict() for n in notifs]), 200
