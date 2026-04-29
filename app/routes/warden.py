from flask import Blueprint, request, jsonify
from app import db
from app.models import User, Complaint, Notification
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

bp = Blueprint('warden', __name__, url_prefix='/api/warden')

@bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    complaints = Complaint.query.all()
    stats = {
        "total": len(complaints),
        "pending": len([c for c in complaints if c.status == 'Pending']),
        "in_progress": len([c for c in complaints if c.status == 'In Progress']),
        "resolved": len([c for c in complaints if c.status == 'Resolved']),
        "rejected": len([c for c in complaints if c.status == 'Rejected'])
    }
    return jsonify(stats), 200

@bp.route('/complaints', methods=['GET'])
@jwt_required()
def get_all_complaints():
    complaints = Complaint.query.order_by(Complaint.created_at.desc()).all()
    return jsonify([c.to_dict() for c in complaints]), 200

@bp.route('/staff', methods=['GET'])
@jwt_required()
def get_staff():
    staff = User.query.filter_by(role='staff').all()
    return jsonify([s.to_dict() for s in staff]), 200

@bp.route('/assign/<int:complaint_id>', methods=['POST'])
@jwt_required()
def assign_staff(complaint_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role != 'warden':
        return jsonify({"msg": "Warden only"}), 403

    data = request.json
    complaint = Complaint.query.get_or_404(complaint_id)
    
    complaint.staff_id = data.get('staff_id')
    complaint.priority = data.get('priority') # Low, Medium, High
    complaint.status = 'In Progress'
    complaint.assigned_at = datetime.utcnow()
    complaint.warden_id = current_user_id
    
    # Notify Student
    notif = Notification(user_id=complaint.student_id, message=f"Your complaint #{complaint.id} has been assigned to staff.")
    db.session.add(notif)
    
    # Notify Staff
    staff_notif = Notification(user_id=complaint.staff_id, message=f"New complaint assigned: #{complaint.id}")
    db.session.add(staff_notif)
    
    db.session.commit()
    return jsonify({"msg": "Assigned successfully"}), 200

@bp.route('/reject/<int:complaint_id>', methods=['POST'])
@jwt_required()
def reject_complaint(complaint_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role != 'warden':
        return jsonify({"msg": "Warden only"}), 403

    data = request.json
    complaint = Complaint.query.get_or_404(complaint_id)
    
    complaint.status = 'Rejected'
    complaint.rejection_reason = data.get('reason')
    complaint.priority = data.get('priority') # Low, Medium, High
    complaint.warden_id = current_user_id
    
    # Notify Student
    notif = Notification(user_id=complaint.student_id, message=f"Your complaint #{complaint.id} was rejected. Reason: {complaint.rejection_reason}")
    db.session.add(notif)
    
    db.session.commit()
    return jsonify({"msg": "Rejected successfully"}), 200
@bp.route('/update_status/<int:complaint_id>', methods=['POST'])
@jwt_required()
def update_status(complaint_id):
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if user.role != 'warden':
        return jsonify({"msg": "Warden only"}), 403

    data = request.json
    complaint = Complaint.query.get_or_404(complaint_id)
    old_status = complaint.status
    new_status = data.get('status')
    
    if new_status not in ['Pending', 'In Progress', 'Resolved', 'Rejected']:
        return jsonify({"msg": "Invalid status"}), 400

    complaint.status = new_status
    if new_status == 'Resolved':
        complaint.resolved_at = datetime.utcnow()
    
    # Notify Student
    notif = Notification(user_id=complaint.student_id, message=f"The status of your complaint #{complaint.id} was changed from {old_status} to {new_status} by the Warden.")
    db.session.add(notif)
    
    db.session.commit()
    return jsonify({"msg": "Status updated successfully"}), 200
