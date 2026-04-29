from app import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # student, warden, staff, admin
    block = db.Column(db.String(50), nullable=True) # Ruby, Pearl, Emerald, Gold, Habitat
    room_number = db.Column(db.String(10), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "block": self.block,
            "room_number": self.room_number
        }

class Complaint(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    warden_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    staff_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    complaint_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    block = db.Column(db.String(50), nullable=False)
    room_number = db.Column(db.String(10), nullable=False)
    
    status = db.Column(db.String(20), default='Pending') # Pending, In Progress, Resolved, Rejected
    priority = db.Column(db.String(20), nullable=True) # Low, Medium, High
    rejection_reason = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_at = db.Column(db.DateTime, nullable=True)
    resolved_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref='complaints_made')
    warden = db.relationship('User', foreign_keys=[warden_id], backref='complaints_managed')
    staff = db.relationship('User', foreign_keys=[staff_id], backref='complaints_assigned')

    def to_dict(self):
        return {
            "id": self.id,
            "student": self.student.username,
            "complaint_type": self.complaint_type,
            "description": self.description,
            "block": self.block,
            "room_number": self.room_number,
            "status": self.status,
            "priority": self.priority,
            "rejection_reason": self.rejection_reason,
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            "assigned_at": self.assigned_at.strftime('%Y-%m-%d %H:%M:%S') if self.assigned_at else None,
            "resolved_at": self.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if self.resolved_at else None,
            "staff_name": self.staff.username if self.staff else None
        }

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='notifications')

    def to_dict(self):
        return {
            "id": self.id,
            "message": self.message,
            "is_read": self.is_read,
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }
