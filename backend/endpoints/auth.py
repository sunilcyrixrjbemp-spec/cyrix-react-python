# endpoints/auth.py
from flask import Blueprint, request, jsonify
import random
from datetime import datetime, timedelta
import requests
from db import get_db_connection

auth_bp = Blueprint('auth', __name__)

RESEND_API_KEY = "re_i7WRWahS_GbcGT7C65PH4fkAvez4DyYiS"
FROM_EMAIL = "Cyrix Healthcare <noreply@sunilbishnoi.co.in>"

def send_email(to_email: str, subject: str, html_content: str):
    """Sends email via Resend API."""
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_content
    }
    resp = requests.post(url, json=payload, headers=headers)
    if resp.status_code not in [200, 201]:
        print(f"Resend Error: {resp.text}")
        raise Exception(f"Failed to send email: {resp.text}")

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    password = data.get("password")

    if not user_id or not password:
        return jsonify({"success": False, "message": "User ID and Password are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute(
            "SELECT user_id, password, full_name, account_status, failed_attempts, role FROM user WHERE user_id = ?",
            (user_id,)
        ).fetchone()

        if not user:
            return jsonify({"success": False, "message": "Invalid User ID."}), 401

        status_lower = (user["account_status"] or "active").lower()

        if status_lower == "locked":
            return jsonify({
                "success": False,
                "message": "Your account is locked. Please visit 'Account Help' to unlock it."
            }), 403

        if status_lower == "in-active":
            return jsonify({
                "success": False,
                "message": "Your account is inactive. Please contact admin for activation."
            }), 403

        # Exact plain text comparison as in original login.js
        if password != user["password"]:
            try:
                current_attempts = int(user["failed_attempts"] or 0)
            except ValueError:
                current_attempts = 0
            attempts = current_attempts + 1

            if attempts >= 5:
                cursor.execute(
                    "UPDATE user SET account_status = 'Locked', failed_attempts = ? WHERE user_id = ?",
                    (str(attempts), user_id)
                )
                conn.commit()
                return jsonify({
                    "success": False,
                    "message": "Too many attempts. Your account is now locked. Please visit 'Account Help' to unlock it."
                }), 403
            else:
                cursor.execute(
                    "UPDATE user SET failed_attempts = ? WHERE user_id = ?",
                    (str(attempts), user_id)
                )
                conn.commit()
                return jsonify({
                    "success": False,
                    "message": f"Incorrect password. {5 - attempts} attempts left."
                }), 401

        # Successful Login
        cursor.execute("UPDATE user SET failed_attempts = '0' WHERE user_id = ?", (user_id,))
        
        allowed_row = cursor.execute("SELECT allowed_menus FROM user_permissions WHERE user_id = ?", (user_id,)).fetchone()
        allowed_menus = allowed_row["allowed_menus"] if allowed_row and allowed_row["allowed_menus"] else "dashboard,expense,profile"
        
        conn.commit()

        from auth_token import generate_token
        token = generate_token(user["user_id"], user["role"], allowed_menus)

        response = jsonify({
            "success": True,
            "message": "Login successful!",
            "user_id": user["user_id"],
            "full_name": user["full_name"],
            "role": user["role"],
            "allowed_menus": allowed_menus,
            "token": token
        })
        response.set_cookie("auth_token", token, max_age=86400, httponly=False, samesite="Lax")
        return response
    finally:
        conn.close()

@auth_bp.route("/forgot", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    dob = data.get("dob")
    doj = data.get("doj")
    action = data.get("action")
    otp = data.get("otp", "")
    new_password = data.get("new_password", "")

    if not user_id or not dob or not doj or not action:
        return jsonify({"success": False, "message": "Missing required details."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute(
            "SELECT user_id, full_name, mail_id, account_status FROM user WHERE user_id = ? AND date_of_birth = ? AND date_joining = ?",
            (user_id, dob, doj)
        ).fetchone()

        if not user:
            return jsonify({"success": False, "message": "Details not matched. Verification failed."}), 404

        status_lower = (user["account_status"] or "active").lower()
        if status_lower == "in-active":
            return jsonify({
                "success": False,
                "message": "Your account is inactive. Please contact admin for activation."
            }), 403

        if action == "SEND_OTP":
            from auth_token import generate_token
            # Generate short lived reset token (0.5 hours = 30 minutes)
            reset_token = generate_token(user_id, "", "", exp_hours=0.5, action="password_reset")
            
            # Determine origin dynamically for local vs production link
            origin = request.headers.get("Origin") or request.headers.get("Referer") or "http://localhost:5173"
            # Extract basic origin scheme + host
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            origin_base = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else "http://localhost:5173"
            
            reset_link = f"{origin_base}/reset-password?token={reset_token}"
            
            email_template = f"""
                <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                    <div style="background-color: #1e3a8a; padding: 25px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Cyrix Healthcare</h1></div>
                    <div style="padding: 40px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #1e293b;">Dear <b>{user['full_name']}</b>,</p>
                        <p style="font-size: 15px; color: #475569; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new password:</p>
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="{reset_link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 10px rgba(37,99,235,0.25);">Reset Password</a>
                            <p style="font-size: 13px; color: #94a3b8; margin-top: 20px;">Or copy and paste this link in your browser:</p>
                            <p style="font-size: 12px; color: #64748b; word-break: break-all; margin-top: 5px;"><a href="{reset_link}" style="color: #2563eb;">{reset_link}</a></p>
                            <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Valid for 30 minutes only.</p>
                        </div>
                        <p style="font-size: 14px; color: #64748b;">If you did not request this, please ignore this email.</p>
                        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
                        <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Secure Access</div>
                    </div>
                </div>"""

            send_email(user["mail_id"], "Reset Your Password - Account Recovery", email_template)
            return jsonify({"success": True, "message": "Password reset link has been sent to your email."})

        elif action == "VERIFY_RESET":
            # Keep fallback to verify compatibility if any client still calls it
            return jsonify({"success": False, "message": "OTP verification is deprecated. Please use the secure email link."}), 400

        else:
            return jsonify({"success": False, "message": "Invalid action."}), 400
    finally:
        conn.close()

@auth_bp.route("/unlock", methods=["POST"])
def unlock_account():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    e_code = data.get("e_code")
    dob = data.get("dob")
    doj = data.get("doj")
    action = data.get("action")
    otp = data.get("otp", "")

    if not user_id or not e_code or not dob or not doj or not action:
        return jsonify({"success": False, "message": "Missing required details."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute(
            "SELECT user_id, full_name, mail_id, account_status FROM user WHERE user_id = ? AND e_code = ? AND date_of_birth = ? AND date_joining = ?",
            (user_id, e_code, dob, doj)
        ).fetchone()

        if not user:
            return jsonify({"success": False, "message": "Verification failed. Incorrect details."}), 404

        status_lower = (user["account_status"] or "active").lower()
        if status_lower == "in-active":
            return jsonify({
                "success": False,
                "message": "Your account is inactive. Please contact admin for activation."
            }), 403

        if action == "SEND_OTP":
            existing = cursor.execute(
                "SELECT attempts FROM otp_verifications WHERE user_id = ?",
                (user_id,)
            ).fetchone()
            current_attempts = existing["attempts"] if existing else 0

            if current_attempts >= 3:
                return jsonify({"success": False, "message": "Security limit reached. Please try again later."}), 429

            generated_otp = str(random.randint(100000, 999999))
            expires = (datetime.utcnow() + timedelta(minutes=5)).isoformat()

            cursor.execute(
                "INSERT OR REPLACE INTO otp_verifications (user_id, otp, expires_at, attempts) VALUES (?, ?, ?, ?)",
                (user_id, generated_otp, expires, current_attempts + 1)
            )
            conn.commit()

            email_template = f"""
                <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                    <div style="background-color: #1e3a8a; padding: 25px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Cyrix Healthcare</h1></div>
                    <div style="padding: 40px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #1e293b;">Dear <b>{user['full_name']}</b>,</p>
                        <p style="font-size: 15px; color: #475569; line-height: 1.6;">Use the following verification code to <b>Unlock</b> your account access:</p>
                        <div style="text-align: center; margin: 35px 0;">
                            <div style="display: inline-block; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px 35px; border-radius: 10px;">
                                <span style="font-size: 34px; font-weight: 700; color: #2563eb; letter-spacing: 8px;">{generated_otp}</span>
                            </div>
                            <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Valid for 5 minutes only.</p>
                        </div>
                        <p style="font-size: 14px; color: #64748b;">If you did not request this, please contact support.</p>
                        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
                        <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Account Security</div>
                    </div>
                </div>"""

            send_email(user["mail_id"], "Action Required: Account Unlock Request", email_template)
            return jsonify({"success": True, "message": "Unlock code sent to your email."})

        elif action == "VERIFY_UNLOCK":
            stored = cursor.execute(
                "SELECT otp, expires_at FROM otp_verifications WHERE user_id = ?",
                (user_id,)
            ).fetchone()

            if not stored or stored["otp"] != otp or datetime.utcnow() > datetime.fromisoformat(stored["expires_at"]):
                return jsonify({"success": False, "message": "Invalid or expired OTP."}), 400

            cursor.execute(
                "UPDATE user SET account_status = 'Active', failed_attempts = '0' WHERE user_id = ?",
                (user_id,)
            )
            cursor.execute("DELETE FROM otp_verifications WHERE user_id = ?", (user_id,))
            conn.commit()

            return jsonify({"success": True, "message": "Account unlocked successfully."})
        else:
            return jsonify({"success": False, "message": "Invalid action."}), 400
    finally:
        conn.close()

@auth_bp.route("/retrive", methods=["POST"])
def retrieve_id():
    data = request.get_json() or {}
    e_code = data.get("e_code")
    dob = data.get("dob")
    doj = data.get("doj")
    action = data.get("action")
    otp = data.get("otp", "")

    if not e_code or not dob or not doj or not action:
        return jsonify({"success": False, "message": "Missing required details."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute(
            "SELECT user_id, full_name, mail_id, account_status FROM user WHERE e_code = ? AND date_of_birth = ? AND date_joining = ?",
            (e_code, dob, doj)
        ).fetchone()

        if not user:
            return jsonify({"success": False, "message": "Record not found. Please check your details."}), 404

        status_lower = (user["account_status"] or "active").lower()
        if status_lower == "in-active":
            return jsonify({
                "success": False,
                "message": "Your account is inactive. Please contact admin for activation."
            }), 403

        if action == "SEND_OTP":
            existing = cursor.execute(
                "SELECT attempts FROM otp_verifications WHERE user_id = ?",
                (user["user_id"],)
            ).fetchone()
            current_attempts = existing["attempts"] if existing else 0

            if current_attempts >= 3:
                return jsonify({"success": False, "message": "Security limit reached. Please try again later."}), 429

            generated_otp = str(random.randint(100000, 999999))
            expires = (datetime.utcnow() + timedelta(minutes=5)).isoformat()

            cursor.execute(
                "INSERT OR REPLACE INTO otp_verifications (user_id, otp, expires_at, attempts) VALUES (?, ?, ?, ?)",
                (user["user_id"], generated_otp, expires, current_attempts + 1)
            )
            conn.commit()

            email_template = f"""
                <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                    <div style="background-color: #1e3a8a; padding: 25px; text-align: center;"><h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Cyrix Healthcare</h1></div>
                    <div style="padding: 40px; background-color: #ffffff;">
                        <p style="font-size: 16px; color: #1e293b;">Dear <b>{user['full_name']}</b>,</p>
                        <p style="font-size: 15px; color: #475569; line-height: 1.6;">Use the following verification code to <b>Retrieve</b> your User ID:</p>
                        <div style="text-align: center; margin: 35px 0;">
                            <div style="display: inline-block; background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px 35px; border-radius: 10px;">
                                <span style="font-size: 34px; font-weight: 700; color: #2563eb; letter-spacing: 8px;">{generated_otp}</span>
                            </div>
                            <p style="font-size: 13px; color: #94a3b8; margin-top: 15px;">Valid for 5 minutes only.</p>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
                        <div style="text-align: center; font-size: 11px; color: #94a3b8;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Identity Retrieval</div>
                    </div>
                </div>"""

            send_email(user["mail_id"], "Security Alert: User ID Retrieval", email_template)
            return jsonify({"success": True, "message": "Verification code sent to your email."})

        elif action == "VERIFY_RETRIEVE":
            stored = cursor.execute(
                "SELECT otp, expires_at FROM otp_verifications WHERE user_id = ?",
                (user["user_id"],)
            ).fetchone()

            if not stored or stored["otp"] != otp or datetime.utcnow() > datetime.fromisoformat(stored["expires_at"]):
                return jsonify({"success": False, "message": "Invalid or expired OTP."}), 400

            cursor.execute("DELETE FROM otp_verifications WHERE user_id = ?", (user["user_id"],))
            conn.commit()

            return jsonify({"success": True, "user_id": user["user_id"]})
        else:
            return jsonify({"success": False, "message": "Invalid action."}), 400
    finally:
        conn.close()

@auth_bp.route("/reset-password", methods=["POST"])
def api_reset_password_endpoint():
    data = request.get_json() or {}
    token = data.get("token")
    new_password = data.get("new_password")
    
    if not token or not new_password:
        return jsonify({"success": False, "message": "Token and new password are required."}), 400
        
    from auth_token import verify_token
    payload = verify_token(token)
    if not payload or payload.get("action") != "password_reset":
        return jsonify({"success": False, "message": "Invalid or expired reset link."}), 400
        
    user_id = payload["user_id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT user_id, full_name FROM user WHERE user_id = ?", (user_id,)).fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found."}), 404
            
        # Salt and hash password (using pbkdf2)
        from endpoints.admin import generate_salt, hash_password
        salt = generate_salt()
        hashed_password = hash_password(new_password, salt)
        
        cursor.execute(
            "UPDATE user SET password = ?, password_salt = ?, failed_attempts = '0', account_status = 'Active' WHERE user_id = ?",
            (hashed_password, salt, user_id)
        )
        conn.commit()
        return jsonify({"success": True, "message": "Password updated successfully. You can now login."})
    finally:
        conn.close()
