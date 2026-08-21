from flask import Flask, render_template, jsonify, request, redirect, url_for, flash, session
from src.prompt import *
import os
import sys
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets
import sqlite3
from functools import wraps
import json
from werkzeug.utils import secure_filename
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from flask_socketio import SocketIO, emit, join_room, leave_room

from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.schema import HumanMessage, SystemMessage
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
# Flask app instantiation
app = Flask(__name__)
app.secret_key = secrets.token_hex(16)  # Generate a random secret key
socketio = SocketIO(app)

# API key configuration (only set when present so a missing key cannot crash import)
if OPENAI_API_KEY:
    os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

# Base directory of the application
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Vercel's serverless filesystem is read-only except for /tmp, so keep the
# database and uploaded files there. Override with DATABASE_PATH / UPLOAD_PATH if needed.
IS_VERCEL = bool(os.getenv("VERCEL"))
DB_PATH = os.getenv("DATABASE_PATH") or (
    os.path.join("/tmp", "mediconnect.db") if IS_VERCEL else os.path.join(BASE_DIR, "mediconnect.db")
)
UPLOAD_PATH = os.getenv("UPLOAD_PATH") or (
    os.path.join("/tmp", "uploads") if IS_VERCEL else os.path.join(BASE_DIR, "uploads")
)

# Configure upload folder
UPLOAD_FOLDER = UPLOAD_PATH
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Database setup
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL,
        registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    )
    ''')
    
    # Create messages table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users (id),
        FOREIGN KEY (receiver_id) REFERENCES users (id)
    )
    ''')
    
    # Create tasks table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATE,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES users (id)
    )
    ''')
    
    # Create doctor_profiles table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS doctor_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        speciality TEXT,
        license_number TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    
    # Create appointments table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        department TEXT NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (doctor_id) REFERENCES users (id)
    )
    ''')
    
    # Create prescriptions table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        date DATE NOT NULL,
        medications TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (doctor_id) REFERENCES users (id)
    )
    ''')
    
    # Create medical_records table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        record_type TEXT NOT NULL,
        description TEXT,
        file_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (doctor_id) REFERENCES users (id)
    )
    ''')
    
    # Create password_reset_tokens table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    
    # Create prescription_refills table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS prescription_refills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        response_date TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (prescription_id) REFERENCES prescriptions (id),
        FOREIGN KEY (patient_id) REFERENCES users (id),
        FOREIGN KEY (doctor_id) REFERENCES users (id)
    )
    ''')
    
    # Create doctor_ratings table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS doctor_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES users (id),
        FOREIGN KEY (patient_id) REFERENCES users (id)
    )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database on app startup
init_db()

# Login decorator for protected routes
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Veuillez vous connecter pour accéder à cette page.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Connect to Meta Llama 3.3 70B Instruct via OpenRouter.
# Only build the client when a key is available so that a missing API key
# cannot crash the import (and therefore the whole site) on Vercel.
if OPENAI_API_KEY:
    llm = ChatOpenAI(
        temperature=0.4,
        max_tokens=1000,
        model_name="meta-llama/llama-3.3-70b-instruct",
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=OPENAI_API_KEY
    )
else:
    llm = None

# Create prompt for the LLM
prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("human", "{input}"),
])

# Email configuration
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "your-email@gmail.com"  # Replace with your email
SMTP_PASSWORD = "your-app-password"     # Replace with your app password

def send_email(to_email, subject, body):
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USERNAME
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False

def send_appointment_reminder(appointment_id):
    conn = get_db_connection()
    appointment = conn.execute('''
        SELECT a.*, 
               p.email as patient_email, p.first_name as patient_first_name, p.last_name as patient_last_name,
               d.email as doctor_email, d.first_name as doctor_first_name, d.last_name as doctor_last_name
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.id = ?
    ''', (appointment_id,)).fetchone()
    
    if appointment:
        # Send to patient
        patient_body = f"""
        <h2>Rappel de rendez-vous</h2>
        <p>Bonjour {appointment['patient_first_name']},</p>
        <p>Ceci est un rappel pour votre rendez-vous avec Dr. {appointment['doctor_last_name']} le {appointment['date']} à {appointment['time']}.</p>
        <p>Motif: {appointment['reason']}</p>
        <p>Merci de confirmer votre présence.</p>
        """
        send_email(appointment['patient_email'], "Rappel de rendez-vous", patient_body)
        
        # Send to doctor
        doctor_body = f"""
        <h2>Rappel de rendez-vous</h2>
        <p>Bonjour Dr. {appointment['doctor_last_name']},</p>
        <p>Vous avez un rendez-vous avec {appointment['patient_first_name']} {appointment['patient_last_name']} le {appointment['date']} à {appointment['time']}.</p>
        <p>Motif: {appointment['reason']}</p>
        """
        send_email(appointment['doctor_email'], "Rappel de rendez-vous", doctor_body)
    
    conn.close()

# Initialize scheduler
scheduler = BackgroundScheduler()
scheduler.start()

# Schedule appointment reminders
def schedule_appointment_reminders():
    conn = get_db_connection()
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    appointments = conn.execute('''
        SELECT id FROM appointments 
        WHERE date = ? AND status = 'scheduled'
    ''', (tomorrow,)).fetchall()
    
    for appointment in appointments:
        scheduler.add_job(
            send_appointment_reminder,
            'date',
            run_date=datetime.now() + timedelta(hours=12),
            args=[appointment['id']]
        )
    
    conn.close()

# Schedule the reminder check daily
scheduler.add_job(
    schedule_appointment_reminders,
    IntervalTrigger(hours=24),
    id='appointment_reminders',
    replace_existing=True
)

# ✅ Route to render landing page
@app.route("/")
def index():
    return render_template('index.html')

# Authentication routes
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        remember = request.form.get("remember")
        
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['role'] = user['role']
            session['name'] = f"{user['first_name']} {user['last_name']}"
            
            if remember:
                # Set session to last for 30 days
                session.permanent = True
                app.permanent_session_lifetime = timedelta(days=30)
            
            # Update last login time
            conn = get_db_connection()
            conn.execute('UPDATE users SET last_login = ? WHERE id = ?', 
                        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), user['id']))
            conn.commit()
            conn.close()
            
            # Redirect based on role
            if user['role'] == 'doctor':
                return redirect(url_for('doctor_dashboard'))
            else:
                return redirect(url_for('patient_dashboard'))
        else:
            flash("Email ou mot de passe incorrect.", "error")
    
    return render_template('auth/login.html')

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        first_name = request.form.get("first_name")
        last_name = request.form.get("last_name")
        email = request.form.get("email")
        phone = request.form.get("phone")
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")
        role = request.form.get("role")
        
        # Validation
        if not all([first_name, last_name, email, phone, password, confirm_password, role]):
            flash("Tous les champs sont obligatoires.", "error")
            return render_template('auth/register.html')
        
        if password != confirm_password:
            flash("Les mots de passe ne correspondent pas.", "error")
            return render_template('auth/register.html')
        
        conn = get_db_connection()
        existing_user = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        
        if existing_user:
            conn.close()
            flash("Cet email est déjà utilisé.", "error")
            return render_template('auth/register.html')
        
        # Create user
        hashed_password = generate_password_hash(password)
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO users (first_name, last_name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)',
            (first_name, last_name, email, phone, hashed_password, role)
        )
        user_id = cursor.lastrowid
        
        # If doctor, add doctor profile
        if role == 'doctor':
            speciality = request.form.get("speciality")
            license_number = request.form.get("license_number")
            
            if not all([speciality, license_number]):
                conn.rollback()
                conn.close()
                flash("Tous les champs de médecin sont obligatoires.", "error")
                return render_template('auth/register.html')
            
            cursor.execute(
                'INSERT INTO doctor_profiles (user_id, speciality, license_number) VALUES (?, ?, ?)',
                (user_id, speciality, license_number)
            )
        
        conn.commit()
        conn.close()
        
        flash("Compte créé avec succès. Vous pouvez maintenant vous connecter.", "success")
        return redirect(url_for('login'))
    
    return render_template('auth/register.html')

@app.route("/logout")
def logout():
    session.clear()
    flash("Vous avez été déconnecté.", "success")
    return redirect(url_for('login'))

@app.route("/reset-password-request", methods=["GET", "POST"])
def reset_password_request():
    if request.method == "POST":
        email = request.form.get("email")
        
        conn = get_db_connection()
        user = conn.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        
        if user:
            # Generate token
            token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(hours=24)
            
            # Store token in database
            conn.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', (user['id'],))
            conn.execute(
                'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                (user['id'], token, expires_at.strftime("%Y-%m-%d %H:%M:%S"))
            )
            conn.commit()
            
            # Here you would send an email with the reset link
            # For now, we'll just flash the link (in a real app, never do this!)
            reset_url = url_for('reset_password', token=token, _external=True)
            flash(f"Un lien de réinitialisation a été envoyé à votre email. URL: {reset_url}", "success")
            
        else:
            # Don't reveal that the email doesn't exist
            flash("Si votre email existe dans notre base de données, vous recevrez un lien de réinitialisation.", "success")
        
        conn.close()
        return redirect(url_for('login'))
    
    return render_template('auth/reset_password_request.html')

@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    conn = get_db_connection()
    token_data = conn.execute(
        'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?', 
        (token,)
    ).fetchone()
    
    if not token_data or datetime.now() > datetime.strptime(token_data['expires_at'], "%Y-%m-%d %H:%M:%S"):
        conn.close()
        flash("Le lien de réinitialisation est invalide ou a expiré.", "error")
        return redirect(url_for('reset_password_request'))
    
    if request.method == "POST":
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")
        
        if password != confirm_password:
            flash("Les mots de passe ne correspondent pas.", "error")
            return render_template('auth/reset_password.html', token=token)
        
        hashed_password = generate_password_hash(password)
        conn.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_password, token_data['user_id']))
        conn.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', (token_data['user_id'],))
        conn.commit()
        conn.close()
        
        flash("Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.", "success")
        return redirect(url_for('login'))
    
    conn.close()
    return render_template('auth/reset_password.html', token=token)

# Dashboard routes (protected)
@app.route("/patient-dashboard")
@login_required
def patient_dashboard():
    if session.get('role') != 'patient':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    conn = get_db_connection()
    
    # Get next appointment
    next_appointment = conn.execute('''
        SELECT a.*, u.first_name, u.last_name, d.speciality
        FROM appointments a 
        JOIN users u ON a.doctor_id = u.id 
        JOIN doctor_profiles d ON u.id = d.user_id
        WHERE a.patient_id = ? AND a.date >= date('now')
        ORDER BY a.date, a.time 
        LIMIT 1
    ''', (session['user_id'],)).fetchone()
    
    # Get active prescriptions
    active_prescriptions = conn.execute('''
        SELECT COUNT(*) as count 
        FROM prescriptions 
        WHERE patient_id = ? AND date >= date('now', '-30 days')
    ''', (session['user_id'],)).fetchone()['count']
    
    # Get unread messages
    unread_messages = conn.execute('''
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE receiver_id = ? AND is_read = 0
    ''', (session['user_id'],)).fetchone()['count']
    
    # Get assigned doctors
    assigned_doctors = conn.execute('''
        SELECT COUNT(DISTINCT doctor_id) as count 
        FROM appointments 
        WHERE patient_id = ?
    ''', (session['user_id'],)).fetchone()['count']
    
    # Get medical records
    medical_records = conn.execute('''
        SELECT mr.*, u.first_name, u.last_name
        FROM medical_records mr
        JOIN users u ON mr.doctor_id = u.id
        WHERE mr.patient_id = ?
        ORDER BY mr.created_at DESC
        LIMIT 5
    ''', (session['user_id'],)).fetchall()
    
    conn.close()
    
    return render_template('patient/dashboard.html',
                         next_appointment=next_appointment,
                         active_prescriptions=active_prescriptions,
                         unread_messages=unread_messages,
                         assigned_doctors=assigned_doctors,
                         medical_records=medical_records)

@app.route("/doctor-dashboard")
@login_required
def doctor_dashboard():
    if session.get('role') != 'doctor':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    conn = get_db_connection()
    
    # Get total patients who have appointments with this doctor
    total_patients = conn.execute('''
        SELECT COUNT(DISTINCT patient_id) as count 
        FROM appointments 
        WHERE doctor_id = ?
    ''', (session['user_id'],)).fetchone()['count']
    
    # Get today's appointments
    today = datetime.now().strftime('%Y-%m-%d')
    today_appointments = conn.execute('''
        SELECT COUNT(*) as count 
        FROM appointments 
        WHERE doctor_id = ? AND date = ?
    ''', (session['user_id'], today)).fetchone()['count']
    
    # Get unread messages
    unread_messages = conn.execute('''
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE receiver_id = ? AND is_read = 0
    ''', (session['user_id'],)).fetchone()['count']
    
    # Get recent messages
    recent_messages = conn.execute('''
        SELECT m.*, 
               u.first_name as sender_first_name, 
               u.last_name as sender_last_name,
               u.id as sender_id
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.receiver_id = ? AND m.is_read = 0
        ORDER BY m.created_at DESC
        LIMIT 5
    ''', (session['user_id'],)).fetchall()
    
    # Get pending tasks
    pending_tasks = conn.execute('''
        SELECT COUNT(*) as count 
        FROM tasks 
        WHERE doctor_id = ? AND status = 'pending'
    ''', (session['user_id'],)).fetchone()['count']
    
    # Get upcoming appointments with patient details
    upcoming_appointments = conn.execute('''
        SELECT a.*, u.first_name, u.last_name, u.phone, u.id as patient_id
        FROM appointments a 
        JOIN users u ON a.patient_id = u.id 
        WHERE a.doctor_id = ? AND a.date >= ? 
        ORDER BY a.date, a.time 
        LIMIT 5
    ''', (session['user_id'], today)).fetchall()
    
    conn.close()
    
    return render_template('doctor/dashboard.html', 
                         total_patients=total_patients,
                         today_appointments=today_appointments,
                         unread_messages=unread_messages,
                         recent_messages=recent_messages,
                         pending_tasks=pending_tasks,
                         upcoming_appointments=upcoming_appointments)

@app.route("/chat")
@login_required
def chat_list():
    conn = get_db_connection()
    
    # Get all conversations for the current user
    conversations = conn.execute('''
        WITH last_messages AS (
            SELECT 
                CASE 
                    WHEN sender_id = ? THEN receiver_id
                    ELSE sender_id
                END as other_user_id,
                content as last_message,
                created_at as last_message_time,
                ROW_NUMBER() OVER (
                    PARTITION BY 
                        CASE 
                            WHEN sender_id = ? THEN receiver_id
                            ELSE sender_id
                        END
                    ORDER BY created_at DESC
                ) as rn
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
        ),
        unread_counts AS (
            SELECT 
                sender_id as other_user_id,
                COUNT(*) as unread_count
            FROM messages
            WHERE receiver_id = ? AND is_read = 0
            GROUP BY sender_id
        )
        SELECT 
            lm.other_user_id,
            u.first_name as other_user_first_name,
            u.last_name as other_user_last_name,
            u.role as other_user_role,
            lm.last_message,
            lm.last_message_time,
            COALESCE(uc.unread_count, 0) as unread_count
        FROM last_messages lm
        JOIN users u ON lm.other_user_id = u.id
        LEFT JOIN unread_counts uc ON lm.other_user_id = uc.other_user_id
        WHERE lm.rn = 1
        ORDER BY lm.last_message_time DESC
    ''', (session['user_id'], session['user_id'], session['user_id'], session['user_id'], session['user_id'])).fetchall()
    
    conn.close()
    return render_template('chat/list.html', conversations=conversations)

# Update the chat function to work without RAG
@app.route("/get", methods=["GET", "POST"])
@login_required
def chat():
    try:
        user_input = request.form["msg"]
        
        # Make sure the user input is valid
        if not user_input or user_input.strip() == "":
            return "Veuillez poser une question médicale. 🩺"
        
        # The LLM client is only built when an API key is configured.
        if llm is None:
            return "Le service de chat n'est pas disponible pour le moment. Veuillez réessayer plus tard. ⚠️"
        
        # Use the LLM directly with an empty context
        response = llm.invoke(prompt.format(input=user_input, context=""))
        
        # The response is now directly from Llama 3.3 70B model
        return response.content
    except Exception as e:
        # Handle any errors
        print(f"Error in chat: {str(e)}")
        return "Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer. ⚠️"

# Error handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_server_error(e):
    return render_template('errors/500.html'), 500

# Additional pages routes
@app.route("/services")
def services():
    return render_template('services.html')

@app.route("/about")
def about():
    return render_template('about.html')

@app.route("/contact", methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        # Here you would process the form data, such as sending an email
        name = request.form.get("name")
        email = request.form.get("email")
        subject = request.form.get("subject")
        message = request.form.get("message")
        
        # In a real implementation, you would send an email or store in database
        # For now, just flash a success message
        flash("Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.", "success")
        return redirect(url_for('contact'))
        
    return render_template('contact.html')

@app.route("/doctor/new-appointment", methods=["GET", "POST"])
@login_required
def new_appointment():
    if session.get('role') != 'doctor':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    if request.method == "POST":
        patient_id = request.form.get("patient_name")
        date = request.form.get("appointment_date")
        time = request.form.get("appointment_time")
        department = request.form.get("department")
        reason = request.form.get("reason")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO appointments (patient_id, doctor_id, date, time, department, reason) VALUES (?, ?, ?, ?, ?, ?)',
            (patient_id, session['user_id'], date, time, department, reason)
        )
        appointment_id = cursor.lastrowid
        
        # Get email addresses
        patient = conn.execute('SELECT email, first_name, last_name FROM users WHERE id = ?', (patient_id,)).fetchone()
        doctor = conn.execute('SELECT email, first_name, last_name FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        
        # Send confirmation emails
        patient_body = f"""
        <h2>Confirmation de rendez-vous</h2>
        <p>Bonjour {patient['first_name']},</p>
        <p>Votre rendez-vous avec Dr. {doctor['last_name']} a été confirmé pour le {date} à {time}.</p>
        <p>Motif: {reason}</p>
        <p>Service: {department}</p>
        """
        send_email(patient['email'], "Confirmation de rendez-vous", patient_body)
        
        doctor_body = f"""
        <h2>Nouveau rendez-vous</h2>
        <p>Bonjour Dr. {doctor['last_name']},</p>
        <p>Un nouveau rendez-vous a été programmé avec {patient['first_name']} {patient['last_name']} pour le {date} à {time}.</p>
        <p>Motif: {reason}</p>
        <p>Service: {department}</p>
        """
        send_email(doctor['email'], "Nouveau rendez-vous", doctor_body)
        
        conn.commit()
        conn.close()
        
        flash("Rendez-vous créé avec succès.", "success")
        return redirect(url_for('doctor_dashboard'))
    
    conn = get_db_connection()
    patients = conn.execute('SELECT * FROM users WHERE role = ?', ('patient',)).fetchall()
    conn.close()
    
    return render_template('doctor/new_appointment.html', patients=patients)

@app.route("/doctor/new-prescription", methods=["GET", "POST"])
@login_required
def new_prescription():
    if session.get('role') != 'doctor':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    if request.method == "POST":
        patient_id = request.form.get("patient_name")
        date = request.form.get("prescription_date")
        medications = request.form.getlist("medications")
        notes = request.form.get("notes")
        
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO prescriptions (patient_id, doctor_id, date, medications, notes) VALUES (?, ?, ?, ?, ?)',
            (patient_id, session['user_id'], date, json.dumps(medications), notes)
        )
        conn.commit()
        conn.close()
        
        flash("Prescription créée avec succès.", "success")
        return redirect(url_for('doctor_dashboard'))
    
    conn = get_db_connection()
    # Get patient_id from query parameters if provided
    patient_id = request.args.get('patient_id')
    
    if patient_id:
        # Get specific patient
        patient = conn.execute('SELECT * FROM users WHERE id = ? AND role = ?', (patient_id, 'patient')).fetchone()
        patients = [patient] if patient else []
    else:
        # Get all patients
        patients = conn.execute('SELECT * FROM users WHERE role = ?', ('patient',)).fetchall()
    
    conn.close()
    
    return render_template('doctor/new_prescription.html', patients=patients, selected_patient_id=patient_id)

@app.route("/doctor/add-record", methods=["GET", "POST"])
@login_required
def add_record():
    if session.get('role') != 'doctor':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    if request.method == "POST":
        patient_id = request.form.get("patient")
        record_type = request.form.get("record_type")
        description = request.form.get("description")
        file = request.files.get("file")
        
        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
        else:
            file_path = None
        
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO medical_records (patient_id, doctor_id, record_type, description, file_path) VALUES (?, ?, ?, ?, ?)',
            (patient_id, session['user_id'], record_type, description, file_path)
        )
        conn.commit()
        conn.close()
        
        flash("Dossier médical ajouté avec succès.", "success")
        return redirect(url_for('doctor_dashboard'))
    
    conn = get_db_connection()
    patients = conn.execute('SELECT * FROM users WHERE role = ?', ('patient',)).fetchall()
    conn.close()
    
    return render_template('doctor/add_record.html', patients=patients)

@app.route("/patient/new-appointment", methods=["GET", "POST"])
@login_required
def patient_new_appointment():
    if session.get('role') != 'patient':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    conn = get_db_connection()
    # List all doctors
    doctors = conn.execute('''
        SELECT u.id, u.first_name, u.last_name, d.speciality
        FROM users u
        JOIN doctor_profiles d ON u.id = d.user_id
        WHERE u.role = 'doctor'
    ''').fetchall()
    if request.method == "POST":
        doctor_id = request.form.get("doctor_id")
        date = request.form.get("appointment_date")
        time = request.form.get("appointment_time")
        department = request.form.get("department")
        reason = request.form.get("reason")
        conn.execute(
            'INSERT INTO appointments (patient_id, doctor_id, date, time, department, reason) VALUES (?, ?, ?, ?, ?, ?)',
            (session['user_id'], doctor_id, date, time, department, reason)
        )
        conn.commit()
        conn.close()
        flash("Votre demande de rendez-vous a été envoyée.", "success")
        return redirect(url_for('patient_dashboard'))
    conn.close()
    return render_template('patient/new_appointment.html', doctors=doctors)

@app.route("/patient/prescriptions")
@login_required
def patient_prescriptions():
    if session.get('role') != 'patient':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    conn = get_db_connection()
    prescriptions = conn.execute('''
        SELECT p.*, u.first_name, u.last_name
        FROM prescriptions p
        JOIN users u ON p.doctor_id = u.id
        WHERE p.patient_id = ?
        ORDER BY p.date DESC
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return render_template('patient/prescriptions.html', prescriptions=prescriptions)

@app.route("/patient/messages")
@login_required
def patient_messages():
    if session.get('role') != 'patient':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    conn = get_db_connection()
    messages = conn.execute('''
        SELECT m.*, u.first_name, u.last_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.receiver_id = ?
        ORDER BY m.created_at DESC
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return render_template('patient/messages.html', messages=messages)

@app.route("/patient/doctors")
@login_required
def patient_doctors():
    if session.get('role') != 'patient':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    conn = get_db_connection()
    # Get all doctors with their specialties
    doctors = conn.execute('''
        SELECT u.id, u.first_name, u.last_name, d.speciality,
               (SELECT COUNT(*) FROM appointments WHERE doctor_id = u.id AND patient_id = ?) as is_my_doctor
        FROM users u
        JOIN doctor_profiles d ON u.id = d.user_id
        WHERE u.role = 'doctor'
    ''', (session['user_id'],)).fetchall()
    conn.close()
    return render_template('patient/doctors.html', doctors=doctors)

# Chat functionality
@socketio.on('connect')
def handle_connect():
    if 'user_id' in session:
        join_room(f"user_{session['user_id']}")

@socketio.on('disconnect')
def handle_disconnect():
    if 'user_id' in session:
        leave_room(f"user_{session['user_id']}")

@socketio.on('send_message')
def handle_message(data):
    if 'user_id' not in session:
        return
    
    sender_id = session['user_id']
    receiver_id = data['receiver_id']
    message = data['message']
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO messages (sender_id, receiver_id, subject, content) VALUES (?, ?, ?, ?)',
        (sender_id, receiver_id, "Message privé", message)
    )
    message_id = cursor.lastrowid
    conn.commit()
    
    # Get sender info
    sender = conn.execute('SELECT first_name, last_name FROM users WHERE id = ?', (sender_id,)).fetchone()
    
    # Prepare message data
    message_data = {
        'id': message_id,
        'sender_id': sender_id,
        'sender_name': f"{sender['first_name']} {sender['last_name']}",
        'content': message,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    
    # Emit to receiver
    emit('new_message', message_data, room=f"user_{receiver_id}")
    # Emit back to sender for confirmation
    emit('message_sent', message_data)
    
    conn.close()

@app.route("/chat/<int:user_id>")
@login_required
def private_chat(user_id):
    conn = get_db_connection()
    other_user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    
    if not other_user:
        flash("Utilisateur non trouvé.", "error")
        return redirect(url_for('chat_list'))
    
    # Get chat history
    messages = conn.execute('''
        SELECT m.*, 
               s.first_name as sender_first_name, s.last_name as sender_last_name,
               r.first_name as receiver_first_name, r.last_name as receiver_last_name
        FROM messages m
        JOIN users s ON m.sender_id = s.id
        JOIN users r ON m.receiver_id = r.id
        WHERE (m.sender_id = ? AND m.receiver_id = ?)
           OR (m.sender_id = ? AND m.receiver_id = ?)
        ORDER BY m.created_at ASC
    ''', (session['user_id'], user_id, user_id, session['user_id'])).fetchall()
    
    # Mark messages as read
    conn.execute('''
        UPDATE messages 
        SET is_read = 1 
        WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
    ''', (session['user_id'], user_id))
    conn.commit()
    conn.close()
    
    return render_template('chat/private.html', 
                         other_user=other_user,
                         messages=messages)

# Prescription refill routes
@app.route("/patient/prescription/<int:prescription_id>/refill", methods=["POST"])
@login_required
def request_prescription_refill(prescription_id):
    if session.get('role') != 'patient':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    notes = request.form.get('notes', '')
    
    conn = get_db_connection()
    prescription = conn.execute('''
        SELECT * FROM prescriptions WHERE id = ? AND patient_id = ?
    ''', (prescription_id, session['user_id'])).fetchone()
    
    if not prescription:
        flash("Ordonnance non trouvée.", "error")
        return redirect(url_for('patient_prescriptions'))
    
    conn.execute('''
        INSERT INTO prescription_refills (prescription_id, patient_id, doctor_id, notes)
        VALUES (?, ?, ?, ?)
    ''', (prescription_id, session['user_id'], prescription['doctor_id'], notes))
    conn.commit()
    
    # Send email notification to doctor
    doctor = conn.execute('SELECT email, first_name, last_name FROM users WHERE id = ?', 
                         (prescription['doctor_id'],)).fetchone()
    patient = conn.execute('SELECT first_name, last_name FROM users WHERE id = ?', 
                          (session['user_id'],)).fetchone()
    
    email_body = f"""
    <h2>Demande de renouvellement d'ordonnance</h2>
    <p>Bonjour Dr. {doctor['last_name']},</p>
    <p>{patient['first_name']} {patient['last_name']} a demandé le renouvellement d'une ordonnance.</p>
    <p>Notes: {notes}</p>
    <p>Veuillez vous connecter à votre espace pour traiter cette demande.</p>
    """
    send_email(doctor['email'], "Demande de renouvellement d'ordonnance", email_body)
    
    conn.close()
    flash("Votre demande de renouvellement a été envoyée.", "success")
    return redirect(url_for('patient_prescriptions'))

@app.route("/doctor/prescription-refills")
@login_required
def prescription_refills():
    if session.get('role') != 'doctor':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    conn = get_db_connection()
    refills = conn.execute('''
        SELECT r.*, 
               p.first_name as patient_first_name, p.last_name as patient_last_name,
               pr.medications, pr.date as prescription_date
        FROM prescription_refills r
        JOIN users p ON r.patient_id = p.id
        JOIN prescriptions pr ON r.prescription_id = pr.id
        WHERE r.doctor_id = ? AND r.status = 'pending'
        ORDER BY r.request_date DESC
    ''', (session['user_id'],)).fetchall()
    conn.close()
    
    return render_template('doctor/prescription_refills.html', refills=refills)

@app.route("/doctor/prescription-refill/<int:refill_id>/respond", methods=["POST"])
@login_required
def respond_to_refill_request(refill_id):
    if session.get('role') != 'doctor':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    status = request.form.get('status')
    response_notes = request.form.get('notes', '')
    
    conn = get_db_connection()
    refill = conn.execute('''
        SELECT r.*, p.email as patient_email, p.first_name as patient_first_name, p.last_name as patient_last_name
        FROM prescription_refills r
        JOIN users p ON r.patient_id = p.id
        WHERE r.id = ? AND r.doctor_id = ?
    ''', (refill_id, session['user_id'])).fetchone()
    
    if not refill:
        flash("Demande non trouvée.", "error")
        return redirect(url_for('prescription_refills'))
    
    conn.execute('''
        UPDATE prescription_refills 
        SET status = ?, notes = ?, response_date = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (status, response_notes, refill_id))
    conn.commit()
    
    # Send email notification to patient
    email_body = f"""
    <h2>Réponse à votre demande de renouvellement</h2>
    <p>Bonjour {refill['patient_first_name']},</p>
    <p>Votre demande de renouvellement d'ordonnance a été {status}.</p>
    <p>Notes du médecin: {response_notes}</p>
    """
    send_email(refill['patient_email'], "Réponse à votre demande de renouvellement", email_body)
    
    conn.close()
    flash("Réponse envoyée avec succès.", "success")
    return redirect(url_for('prescription_refills'))

# Doctor rating routes
@app.route("/patient/doctor/<int:doctor_id>/rate", methods=["POST"])
@login_required
def rate_doctor(doctor_id):
    if session.get('role') != 'patient':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    rating = request.form.get('rating')
    comment = request.form.get('comment', '')
    
    if not rating or not rating.isdigit() or int(rating) < 1 or int(rating) > 5:
        flash("Note invalide.", "error")
        return redirect(url_for('patient_doctors'))
    
    conn = get_db_connection()
    # Check if patient has had appointments with this doctor
    has_appointments = conn.execute('''
        SELECT COUNT(*) as count 
        FROM appointments 
        WHERE patient_id = ? AND doctor_id = ? AND status = 'completed'
    ''', (session['user_id'], doctor_id)).fetchone()['count']
    
    if not has_appointments:
        flash("Vous ne pouvez noter que les médecins que vous avez consultés.", "error")
        return redirect(url_for('patient_doctors'))
    
    # Check if patient has already rated this doctor
    existing_rating = conn.execute('''
        SELECT id FROM doctor_ratings 
        WHERE patient_id = ? AND doctor_id = ?
    ''', (session['user_id'], doctor_id)).fetchone()
    
    if existing_rating:
        conn.execute('''
            UPDATE doctor_ratings 
            SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (rating, comment, existing_rating['id']))
    else:
        conn.execute('''
            INSERT INTO doctor_ratings (doctor_id, patient_id, rating, comment)
            VALUES (?, ?, ?, ?)
        ''', (doctor_id, session['user_id'], rating, comment))
    
    conn.commit()
    conn.close()
    
    flash("Merci pour votre évaluation.", "success")
    return redirect(url_for('patient_doctors'))

@app.route("/doctor/ratings")
@login_required
def doctor_ratings():
    if session.get('role') != 'doctor':
        flash("Accès non autorisé.", "error")
        return redirect(url_for('index'))
    
    conn = get_db_connection()
    ratings = conn.execute('''
        SELECT r.*, 
               p.first_name as patient_first_name, p.last_name as patient_last_name
        FROM doctor_ratings r
        JOIN users p ON r.patient_id = p.id
        WHERE r.doctor_id = ?
        ORDER BY r.created_at DESC
    ''', (session['user_id'],)).fetchall()
    
    # Calculate average rating
    avg_rating = conn.execute('''
        SELECT AVG(rating) as avg_rating 
        FROM doctor_ratings 
        WHERE doctor_id = ?
    ''', (session['user_id'],)).fetchone()['avg_rating']
    
    conn.close()
    
    return render_template('doctor/ratings.html', 
                         ratings=ratings,
                         avg_rating=round(avg_rating, 1) if avg_rating else 0)

@app.route('/chatbot')
@login_required
def chatbot():
    return render_template('chatbot.html')

@app.route('/api/chatbot', methods=['POST'])
@login_required
def chatbot_response():
    try:
        data = request.get_json()
        user_message = data.get('message')

        if not OPENAI_API_KEY:
            return jsonify({'error': 'Le service de chat n\'est pas configuré.'}), 503

        chat = ChatOpenAI(
            model="meta-llama/llama-3.3-70b-instruct",
            temperature=0.7,
            openai_api_base="https://openrouter.ai/api/v1",
            openai_api_key=OPENAI_API_KEY,
            default_headers={
                "HTTP-Referer": "http://192.168.11.102:8080",
                "X-Title": "MediConnect Chatbot",
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            }
        )
        
        messages = [
            SystemMessage(content="You are a medical assistant chatbot. Provide helpful information in French."),
            HumanMessage(content=user_message)
        ]
        
        try:
            response = chat.invoke(messages)
            return jsonify({'response': response.content})
        except Exception as api_error:
            print(f"API Error: {str(api_error)}")
            return jsonify({'error': 'Erreur de communication avec l\'assistant. Veuillez réessayer.'}), 500
        
    except Exception as e:
        print(f"Chatbot error: {str(e)}")
        return jsonify({'error': 'Désolé, une erreur est survenue. Veuillez réessayer.'}), 500

# Run the Flask app
if __name__ == "__main__":
    # Disable Flask's automatic dotenv loading
    sys.argv = ["flask", "run", "--no-load-dotenv", "--host=0.0.0.0", "--port=8080", "--debug"]
    app.run(host="0.0.0.0", port=8080, debug=True, load_dotenv=False)