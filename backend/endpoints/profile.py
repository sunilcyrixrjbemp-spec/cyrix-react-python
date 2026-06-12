# endpoints/profile.py
from flask import Blueprint, request, jsonify
from db import get_db_connection

profile_bp = Blueprint('profile', __name__)

@profile_bp.route("/profile", methods=["GET"])
@profile_bp.route("/profile/<userId>", methods=["GET"])
def get_profile(userId=None):
    logged_in_id = getattr(request, 'user_id', None)
    target_id = userId or request.args.get("user_id") or request.args.get("userId") or logged_in_id
    if not target_id:
        return jsonify({"success": False, "message": "User ID is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Secure check: if target_id is different from logged_in_id, verify access
        if logged_in_id and target_id != logged_in_id:
            requester = cursor.execute("SELECT role FROM user WHERE user_id = ?", (logged_in_id,)).fetchone()
            role = requester["role"] if requester else ""
            if role not in ["Admin", "Superadmin", "HR"]:
                target_user = cursor.execute("SELECT level_first_approver, level_second_approver FROM user WHERE user_id = ?", (target_id,)).fetchone()
                if not target_user or (target_user["level_first_approver"] != logged_in_id and target_user["level_second_approver"] != logged_in_id):
                    # Fallback to the requester's own profile to prevent unauthorized snooping
                    target_id = logged_in_id

        user = cursor.execute("""
            SELECT 
                u.user_id, u.e_code, u.full_name, u.date_of_birth, u.date_joining, 
                u.designation, u.mobile_number, u.mail_id, u.zone_name, u.district_name, 
                u.account_status, u.grade, u.role, 
                COALESCE((SELECT full_name FROM user l1 WHERE l1.user_id = u.level_first_approver), u.level_first_approver) as level_first_approver, 
                COALESCE((SELECT full_name FROM user l2 WHERE l2.user_id = u.level_second_approver), u.level_second_approver) as level_second_approver 
            FROM user u 
            WHERE u.user_id = ?
        """, (target_id,)).fetchone()

        if not user:
            return jsonify({"success": False, "message": "User not found."}), 404

        profile = dict(user)
        
        # Query manager's reportees if any
        reportees = cursor.execute("""
            SELECT user_id, full_name, designation, role, mobile_number, mail_id, account_status
            FROM user
            WHERE level_first_approver = ? OR level_second_approver = ?
            ORDER BY full_name ASC
        """, (target_id, target_id)).fetchall()
        
        profile["reportees"] = [dict(r) for r in reportees]

        return jsonify({
            "success": True,
            "profile": profile
        })
    finally:
        conn.close()

@profile_bp.route("/team", methods=["GET"])
def get_team():
    logged_in_id = getattr(request, 'user_id', None)
    manager_id = request.args.get("manager_id") or logged_in_id
    if not manager_id:
        return jsonify({"success": False, "message": "Manager ID is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Secure check: only admin can view another manager's team
        if logged_in_id and manager_id != logged_in_id:
            requester = cursor.execute("SELECT role FROM user WHERE user_id = ?", (logged_in_id,)).fetchone()
            role = requester["role"] if requester else ""
            if role not in ["Admin", "Superadmin"]:
                manager_id = logged_in_id

        manager = cursor.execute("SELECT role FROM user WHERE user_id = ?", (manager_id,)).fetchone()
        if not manager:
            return jsonify({"success": False, "message": "Manager not found."}), 404

        raw_role = (manager["role"] or "").strip().upper()
        is_admin = raw_role in ["ADMIN", "SUPERADMIN", "HR"]
        is_manager = "MANAGER" in raw_role or "INCHARGE" in raw_role
        is_coordinator = "COORDINATOR" in raw_role

        team_query = """
            SELECT u.user_id, u.full_name, u.designation, u.role, u.e_code, u.account_status,
                   COALESCE((SELECT full_name FROM user l1 WHERE l1.user_id = u.level_first_approver), 'No Manager Assigned') as manager_name
            FROM user u
            WHERE 1=1
        """
        bindings = []

        if is_admin:
            pass
        elif is_manager and is_coordinator:
            team_query += " AND (u.level_first_approver = ? OR u.level_second_approver = ?)"
            bindings.extend([manager_id, manager_id])
        elif is_manager:
            team_query += " AND u.level_first_approver = ?"
            bindings.append(manager_id)
        elif is_coordinator:
            team_query += " AND u.level_second_approver = ?"
            bindings.append(manager_id)
        else:
            team_query += " AND (u.level_first_approver = ? OR u.level_second_approver = ?)"
            bindings.extend([manager_id, manager_id])

        team_query += " ORDER BY manager_name ASC, u.full_name ASC"

        results = cursor.execute(team_query, bindings).fetchall()
        team_list = [dict(row) for row in results]

        return jsonify({
            "success": True,
            "team": team_list
        })
    finally:
        conn.close()
