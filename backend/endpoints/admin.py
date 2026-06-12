# endpoints/admin.py
from flask import Blueprint, request, jsonify
import os
import hashlib
import base64
import re
from db import get_db_connection

admin_bp = Blueprint('admin', __name__)

def generate_salt():
    return base64.b64encode(os.urandom(16)).decode('utf-8')

def hash_password(password: str, salt: str) -> str:
    """Computes standard PBKDF2-HMAC-SHA256 matching the Web Crypto API version."""
    password_bytes = password.encode('utf-8')
    salt_bytes = salt.encode('utf-8')
    dk = hashlib.pbkdf2_hmac('sha256', password_bytes, salt_bytes, 100000, 32)
    return base64.b64encode(dk).decode('utf-8')

def get_next_id(cursor):
    cursor.execute("SELECT user_id FROM user WHERE user_id LIKE 'RJ%' ORDER BY user_id DESC LIMIT 1")
    row = cursor.fetchone()
    if not row or not row["user_id"]:
        return "RJ001"
    match = re.match(r"RJ(\d+)", row["user_id"])
    if match:
        next_num = int(match.group(1)) + 1
        return f"RJ{str(next_num).zfill(3)}"
    return "RJ001"

@admin_bp.route("/dropdowns", methods=["GET"])
def get_dropdowns():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        try:
            cursor.execute('SELECT 1 FROM "Facily Details" LIMIT 1')
            fac_table = '"Facily Details"'
        except Exception:
            fac_table = 'facility_details'

        zones = cursor.execute(f"SELECT DISTINCT zone_name FROM {fac_table}").fetchall()
        roles = cursor.execute("SELECT DISTINCT Role FROM Role").fetchall()
        grades = cursor.execute("SELECT DISTINCT grade FROM allowance_master").fetchall()
        next_id = get_next_id(cursor)

        return jsonify({
            "success": True,
            "zones": [z["zone_name"] for z in zones if z["zone_name"]],
            "roles": [r["Role"] for r in roles if r["Role"]],
            "grades": [g["grade"] for g in grades if g["grade"]],
            "next_id": next_id
        })
    finally:
        conn.close()

@admin_bp.route("/districts", methods=["GET"])
def get_districts():
    zone = request.args.get('zone')
    if not zone:
        return jsonify({"success": False, "message": "Zone is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        try:
            cursor.execute('SELECT 1 FROM "Facily Details" LIMIT 1')
            fac_table = '"Facily Details"'
        except Exception:
            fac_table = 'facility_details'

        districts = cursor.execute(
            f"SELECT DISTINCT district_name FROM {fac_table} WHERE zone_name = ?",
            (zone,)
        ).fetchall()

        return jsonify({
            "success": True,
            "districts": [d["district_name"] for d in districts if d["district_name"]]
        })
    finally:
        conn.close()

@admin_bp.route("/users", methods=["GET", "POST"])
def manage_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if request.method == "GET":
            users = cursor.execute("""
                SELECT u.user_id, u.e_code, u.full_name, u.designation, u.mobile_number, u.mail_id, 
                       u.e_upkaran_id, u.date_of_birth, u.date_joining, u.zone_name, u.district_name, 
                       u.grade, u.role, u.level_first_approver, u.level_second_approver, u.account_status, u.failed_attempts,
                       p.allowed_menus
                FROM user u
                LEFT JOIN user_permissions p ON u.user_id = p.user_id
                ORDER BY u.user_id DESC
            """).fetchall()

            users_list = []
            for u in users:
                d = dict(u)
                if not d.get("allowed_menus"):
                    d["allowed_menus"] = "dashboard,expense,profile"
                users_list.append(d)

            return jsonify({
                "success": True,
                "users": users_list
            })
            
        elif request.method == "POST":
            req = request.get_json() or {}
            e_code = req.get("e_code")
            full_name = req.get("full_name")
            designation = req.get("designation")
            mobile_number = req.get("mobile_number")
            mail_id = req.get("mail_id")
            zone_name = req.get("zone_name")
            district_name = req.get("district_name")
            grade = req.get("grade")
            role = req.get("role")
            allowed_menus = req.get("allowed_menus") or "dashboard,expense,profile"
            
            if not e_code or not full_name or not mobile_number or not mail_id:
                return jsonify({"success": False, "message": "Missing required details."}), 400

            # Check duplicate
            existing = cursor.execute(
                "SELECT user_id FROM user WHERE e_code = ? OR mobile_number = ? OR mail_id = ?",
                (e_code, mobile_number, mail_id)
            ).fetchone()
            if existing:
                return jsonify({"success": False, "message": "User with this Employee Code, Mobile, or Email already exists."}), 400

            next_id = get_next_id(cursor)
            salt = generate_salt()
            plain_password = req.get("password") or "123456"
            hashed_password = hash_password(plain_password, salt)

            cursor.execute("""
                INSERT INTO user (
                    user_id, e_code, full_name, designation, mobile_number, mail_id, 
                    e_upkaran_id, date_of_birth, date_joining, zone_name, district_name, 
                    grade, role, level_first_approver, level_second_approver, 
                    password, password_salt, account_status, failed_attempts
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 0)
            """, (
                next_id, e_code, full_name, designation, mobile_number, mail_id,
                req.get("e_upkaran_id"), req.get("date_of_birth"), req.get("date_joining"), zone_name, district_name,
                grade, role, req.get("level_first_approver"), req.get("level_second_approver"),
                hashed_password, salt
            ))

            cursor.execute("""
                INSERT OR REPLACE INTO user_permissions (user_id, full_name, allowed_menus)
                VALUES (?, ?, ?)
            """, (next_id, full_name, allowed_menus))

            conn.commit()

            return jsonify({"success": True, "user_id": next_id})
    finally:
        conn.close()

@admin_bp.route("/users/<userId>", methods=["PUT", "DELETE"])
def update_delete_user(userId):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        existing = cursor.execute("SELECT user_id FROM user WHERE user_id = ?", (userId,)).fetchone()
        if not existing:
            return jsonify({"success": False, "message": "User not found."}), 404

        if request.method == "PUT":
            req = request.get_json() or {}
            allowed_menus = req.get("allowed_menus") or "dashboard,expense,profile"
            
            query = """
                UPDATE user SET e_code=?, full_name=?, designation=?, mobile_number=?, mail_id=?, 
                e_upkaran_id=?, date_of_birth=?, date_joining=?, zone_name=?, district_name=?, 
                grade=?, role=?, level_first_approver=?, level_second_approver=?
            """
            params = [
                req.get("e_code"), req.get("full_name"), req.get("designation"), req.get("mobile_number"), req.get("mail_id"),
                req.get("e_upkaran_id"), req.get("date_of_birth"), req.get("date_joining"), req.get("zone_name"), req.get("district_name"),
                req.get("grade"), req.get("role"), req.get("level_first_approver"), req.get("level_second_approver")
            ]

            pwd = req.get("password")
            if pwd and pwd.strip():
                salt = generate_salt()
                hashed_password = hash_password(pwd, salt)
                query += ", password=?, password_salt=?"
                params.extend([hashed_password, salt])

            query += " WHERE user_id=?"
            params.append(userId)

            cursor.execute(query, params)

            cursor.execute("""
                INSERT OR REPLACE INTO user_permissions (user_id, full_name, allowed_menus)
                VALUES (?, ?, ?)
            """, (userId, req.get("full_name"), allowed_menus))

            conn.commit()

            return jsonify({"success": True})
            
        elif request.method == "DELETE":
            cursor.execute("DELETE FROM user WHERE user_id = ?", (userId,))
            cursor.execute("DELETE FROM user_permissions WHERE user_id = ?", (userId,))
            conn.commit()
            return jsonify({"success": True})
    finally:
        conn.close()

@admin_bp.route("/users/<userId>/status", methods=["PUT"])
def update_user_status(userId):
    req = request.get_json() or {}
    status_val = req.get("status")
    
    if not status_val:
        return jsonify({"success": False, "message": "Status is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        existing = cursor.execute("SELECT user_id FROM user WHERE user_id = ?", (userId,)).fetchone()
        if not existing:
            return jsonify({"success": False, "message": "User not found."}), 404

        if status_val == "Active":
            cursor.execute("UPDATE user SET account_status = ?, failed_attempts = 0 WHERE user_id = ?", (status_val, userId))
        else:
            cursor.execute("UPDATE user SET account_status = ? WHERE user_id = ?", (status_val, userId))
        
        conn.commit()
        return jsonify({"success": True})
    finally:
        conn.close()
