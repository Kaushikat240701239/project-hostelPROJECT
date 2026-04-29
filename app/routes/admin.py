from flask import Blueprint, request, jsonify, send_file
from app import db, bcrypt
from app.models import User, Complaint, Notification
from flask_jwt_extended import jwt_required, get_jwt_identity
import pandas as pd
import os
from io import BytesIO
from fpdf import FPDF

bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def admin_required(fn):
    from functools import wraps
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or user.role != 'admin':
            return jsonify({"msg": "Admin only"}), 403
        return fn(*args, **kwargs)
    return wrapper

@bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

@bp.route('/users', methods=['POST'])
@admin_required
def manage_user():
    data = request.json
    user_id = data.get('id')
    
    if user_id:
        user = User.query.get(user_id)
        if not user:
            return jsonify({"msg": "User not found"}), 404
        user.username = data.get('username', user.username)
        user.role = data.get('role', user.role)
        if data.get('password'):
            user.password_hash = bcrypt.generate_password_hash(data.get('password')).decode('utf-8')
        db.session.commit()
        return jsonify({"msg": "User updated"}), 200
    else:
        # Create new
        hashed_password = bcrypt.generate_password_hash(data.get('password')).decode('utf-8')
        new_user = User(
            username=data.get('username'),
            password_hash=hashed_password,
            role=data.get('role')
        )
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"msg": "User created"}), 201

@bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"msg": "User deleted"}), 200

@bp.route('/stats', methods=['GET'])
@admin_required
def get_stats():
    complaints = Complaint.query.all()
    stats = {
        "total": len(complaints),
        "pending": len([c for c in complaints if c.status == 'Pending']),
        "in_progress": len([c for c in complaints if c.status == 'In Progress']),
        "resolved": len([c for c in complaints if c.status == 'Resolved']),
        "rejected": len([c for c in complaints if c.status == 'Rejected']),
        # Added priority stats for charts
        "low": len([c for c in complaints if c.priority == 'Low']),
        "medium": len([c for c in complaints if c.priority == 'Medium']),
        "high": len([c for c in complaints if c.priority == 'High'])
    }
    return jsonify(stats), 200

@bp.route('/report', methods=['GET'])
@admin_required
def generate_report():
    report_format = request.args.get('format', 'csv')
    complaints = Complaint.query.all()
    data = [c.to_dict() for c in complaints]
    
    output = BytesIO()
    
    if report_format == 'pdf':
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("helvetica", 'B', 16)
        pdf.cell(0, 10, "Hostel Complaint Management - System Report", 0, 1, 'C')
        pdf.ln(10)
        
        # Table Header
        pdf.set_font("helvetica", 'B', 10)
        col_widths = [10, 30, 60, 25, 30, 35]
        headers = ["ID", "Student", "Issue", "Status", "Block/Room", "Date"]
        
        for i, header in enumerate(headers):
            pdf.cell(col_widths[i], 10, header, 1)
        pdf.ln()
        
        # Table Data
        pdf.set_font("helvetica", '', 9)
        for c in data:
            pdf.cell(col_widths[0], 10, str(c['id']), 1)
            pdf.cell(col_widths[1], 10, str(c['student'])[:15], 1)
            pdf.cell(col_widths[2], 10, str(c['complaint_type'])[:30], 1)
            pdf.cell(col_widths[3], 10, str(c['status']), 1)
            pdf.cell(col_widths[4], 10, f"{c['block']}/{c['room_number']}", 1)
            pdf.cell(col_widths[5], 10, str(c['created_at'])[:10], 1)
            pdf.ln()
            
        pdf.output(output)
        output.seek(0)
        return send_file(output, mimetype='application/pdf', as_attachment=True, download_name='complaints_report.pdf')
    
    # Default CSV
    df = pd.DataFrame(data)
    df.to_csv(output, index=False)
    output.seek(0)
    return send_file(output, mimetype='text/csv', as_attachment=True, download_name='complaints_report.csv')

@bp.route('/notify', methods=['POST'])
@admin_required
def send_notification():
    data = request.json
    msg = data.get('message')
    target = data.get('target') # all, selective
    user_ids = data.get('user_ids', [])

    if target == 'all':
        users = User.query.all()
        for user in users:
            new_notif = Notification(user_id=user.id, message=msg)
            db.session.add(new_notif)
    elif target == 'selective':
        for uid in user_ids:
            new_notif = Notification(user_id=uid, message=msg)
            db.session.add(new_notif)
    
    db.session.commit()
    return jsonify({"msg": "Notifications sent successfully"}), 200
