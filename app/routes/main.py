from flask import Blueprint, render_template, redirect, url_for

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    return redirect(url_for('main.login_page'))

@bp.route('/login')
def login_page():
    return render_template('login.html')

@bp.route('/dashboard')
def dashboard_page():
    return render_template('dashboard.html')
