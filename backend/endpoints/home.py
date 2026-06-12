# endpoints/home.py
from flask import Blueprint, request, jsonify
from datetime import datetime
from db import get_db_connection

home_bp = Blueprint('home', __name__)

def is_missing(v):
    if v is None:
        return True
    nv = str(v).strip().lower()
    return nv in ["", "null", "undefined"]

def resolve_logged_in_user_id(req_obj):
    return getattr(req_obj, 'user_id', None)

@home_bp.route("/list", methods=["GET"])
def get_home_list():
    user_id = resolve_logged_in_user_id(request)
    month = request.args.get("month") or datetime.now().isoformat()[:7]

    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT role FROM user WHERE user_id = ?", (user_id,)).fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404

        role = user["role"]
        is_admin = role in ["Admin", "Superadmin"]

        query = """
            SELECT m.exp_id as id, m.expense_date as date, m.total_amount as amount, m.status,
                   u.full_name, u.e_code
            FROM expense_master m
            JOIN user u ON m.user_id = u.user_id
            WHERE strftime('%Y-%m', m.expense_date) = ?
        """
        bindings = [month]

        if is_admin:
            query += " AND (m.user_id = ? OR m.level_first_approver = ?)"
            bindings.extend([user_id, user_id])
        else:
            query += " AND m.user_id = ?"
            bindings.append(user_id)

        query += " ORDER BY m.created_at DESC"

        results = cursor.execute(query, bindings).fetchall()
        expenses = [dict(row) for row in results]

        return jsonify({
            "success": True,
            "expenses": expenses
        })
    finally:
        conn.close()

@home_bp.route("/detail", methods=["GET"])
def get_home_detail():
    user_id = resolve_logged_in_user_id(request)
    exp_id = request.args.get("exp_id")

    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    if not exp_id:
        return jsonify({"success": False, "message": "exp_id required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT role FROM user WHERE user_id = ?", (user_id,)).fetchone()
        is_admin = user and (user["role"] in ["Admin", "Superadmin"])

        exp = cursor.execute("""
            SELECT m.*, u.full_name, u.e_code, u.grade, u.designation, u.district_name, u.mobile_number,
                   (SELECT full_name FROM user WHERE user_id = m.level_first_approver) as l1_name,
                   (SELECT full_name FROM user WHERE user_id = m.level_second_approver) as l2_name
            FROM expense_master m
            JOIN user u ON m.user_id = u.user_id
            WHERE m.exp_id = ?
        """, (exp_id,)).fetchone()

        if not exp:
            return jsonify({"success": False, "message": "Expense not found"}), 404

        exp_dict = dict(exp)

        # Security Check
        if not is_admin and exp_dict["user_id"] != user_id and exp_dict["level_first_approver"] != user_id and exp_dict["level_second_approver"] != user_id:
            return jsonify({"success": False, "message": "Access Denied"}), 403

        itineraries = cursor.execute("""
            SELECT i.*,
                COALESCE(
                    (SELECT GROUP_CONCAT(a.file_url || '::' || a.bill_type, '|||')
                     FROM expense_attachments a WHERE a.itinerary_id = i.itinerary_id),
                    ''
                ) as attachments_raw
            FROM expense_itinerary i
            WHERE i.exp_id = ? ORDER BY i.leg_number ASC
        """, (exp_id,)).fetchall()

        enriched_itineraries = []
        for leg in itineraries:
            leg_dict = dict(leg)
            attachments = []
            if leg_dict["attachments_raw"]:
                for raw in leg_dict["attachments_raw"].split("|||"):
                    if not raw:
                        continue
                    parts = raw.split("::")
                    url_val = parts[0]
                    bill_type = parts[1] if len(parts) > 1 else ""
                    if url_val:
                        from urllib.parse import quote
                        attachments.append({
                            "url": f"/api/approval/image?url={quote(url_val)}&user_id={user_id}",
                            "bill_type": bill_type
                        })
            
            leg_dict["travel_type"] = "Outdoor" if leg_dict["from_district"] != leg_dict["to_district"] else "In-District"
            leg_dict["ws_assigned"] = leg_dict["calls_assigned"] if leg_dict["calls_assigned"] is not None else 0
            leg_dict["ws_closed"] = leg_dict["calls_completed"] if leg_dict["calls_completed"] is not None else 0
            leg_dict["ws_pms"] = leg_dict["pms_count"] if leg_dict["pms_count"] is not None else 0
            leg_dict["ws_asset"] = leg_dict["asset_tagging"] if leg_dict["asset_tagging"] is not None else 0
            leg_dict["attachments"] = attachments
            del leg_dict["attachments_raw"]
            
            enriched_itineraries.append(leg_dict)

        return jsonify({
            "success": True,
            "type": 'Expense',
            "expense": exp_dict,
            "itineraries": enriched_itineraries
        })
    finally:
        conn.close()
