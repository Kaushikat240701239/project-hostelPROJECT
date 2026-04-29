from flask import Blueprint, request, jsonify
from app import db
from app.models import Complaint, User, Notification
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

bp = Blueprint('staff', __name__, url_prefix='/api/staff')

@bp.route('/tasks', methods=['GET'])
@jwt_required()
def get_assigned_tasks():
    current_user_id = get_jwt_identity()
    tasks = Complaint.query.filter_by(staff_id=current_user_id).order_by(Complaint.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks]), 200

@bp.route('/resolve/<int:complaint_id>', methods=['POST'])
@jwt_required()
def resolve_task(complaint_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role != 'staff':
        return jsonify({"msg": "Staff only"}), 403

    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.staff_id != int(current_user_id):
         return jsonify({"msg": "Unauthorized"}), 401

    complaint.status = 'Resolved'
    complaint.resolved_at = datetime.utcnow()
    
    # Notify Student
    notif = Notification(user_id=complaint.student_id, message=f"Your complaint #{complaint.id} has been resolved.")
    db.session.add(notif)
    
    # Notify Warden (optional but good practice)
    warden_id = User.query.filter_by(role='warden').first().id # In a real app, query by warden who assigned
    if complaint.warden_id:
        warden_id = complaint.warden_id
    
    warden_notif = Notification(user_id=warden_id, message=f"Complaint #{complaint.id} resolved by staff.")
    db.session.add(warden_notif)
    
    db.session.commit()
    return jsonify({"msg": "Status updated to Resolved"}), 200

@bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    current_user_id = get_jwt_identity()
    complaints = Complaint.query.filter_by(staff_id=current_user_id).all()
    
    stats = {
        "total": len(complaints),
        "in_progress": len([c for c in complaints if c.status == 'In Progress']),
        "resolved": len([c for c in complaints if c.status == 'Resolved'])
    }
    return jsonify(stats), 200
@bp.route('/revert/<int:complaint_id>', methods=['POST'])
@jwt_required()
def revert_task(complaint_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role != 'staff':
        return jsonify({"msg": "Staff only"}), 403

    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.staff_id != int(current_user_id):
         return jsonify({"msg": "Unauthorized"}), 401

    if complaint.status != 'Resolved':
        return jsonify({"msg": "Can only revert Resolved tasks"}), 400

    complaint.status = 'In Progress'
    complaint.resolved_at = None
    
    # Notify Student
    notif = Notification(user_id=complaint.student_id, message=f"Your complaint #{complaint.id} has been moved back from Resolved to In Progress for further work.")
    db.session.add(notif)
    
    db.session.commit()
    return jsonify({"msg": "Task reverted to In Progress"}), 200
