# endpoints/dashboard.py
from flask import Blueprint, request, jsonify
import json
from db import get_db_connection

dashboard_bp = Blueprint('dashboard', __name__)

def is_missing(v):
    if v is None:
        return True
    nv = str(v).strip().lower()
    return nv in ["", "null", "undefined"]

def resolve_user_id(user_id_param=None):
    return getattr(request, 'user_id', None)

@dashboard_bp.route("/filters", methods=["GET"])
def get_filters():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        try:
            cursor.execute('SELECT 1 FROM "Facily Details" LIMIT 1')
            fac_table = '"Facily Details"'
        except Exception:
            fac_table = 'facility_details'

        users = cursor.execute("SELECT user_id, full_name, role, zone_name, district_name FROM user").fetchall()
        facilities = cursor.execute(
            f"SELECT DISTINCT facility_name, facility_incharge, district_name, zone_name, dm_name, coordinator_name FROM {fac_table}"
        ).fetchall()

        return jsonify({
            "success": True,
            "users": [dict(u) for u in users],
            "facilities": [dict(f) for f in facilities]
        })
    finally:
        conn.close()

@dashboard_bp.route("/expenses", methods=["GET"])
def get_dashboard_expenses():
    user_id_param = request.args.get("user_id")
    uid = resolve_user_id(user_id_param)
    if not uid:
        return jsonify({"success": False, "message": "Unauthorized."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute(
            "SELECT user_id, full_name, role, e_upkaran_id, zone_name, district_name FROM user WHERE user_id = ?",
            (uid,)
        ).fetchone()

        if not user:
            return jsonify({"success": False, "message": "User not found."}), 403

        role = (user["role"] or "").strip()
        is_admin = role in ["Admin", "Superadmin"]
        is_coordinator = role == "Coordinator"
        is_dm = role in ["Divisional Manager", "DM"]
        is_di = role in ["District Incharge", "DI"]
        is_manager = role == "Manager"

        zone = request.args.get("zone", "All")
        district = request.args.get("district", "All")
        engineer = request.args.get("engineer", "All")
        status = request.args.get("status", "All")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        conds = ["1=1"]
        params = []

        if not is_admin:
            if is_coordinator or is_dm:
                conds.append("u.zone_name = ?")
                params.append(user["zone_name"])
            elif is_di:
                conds.append("u.district_name = ?")
                params.append(user["district_name"])
            elif is_manager:
                conds.append("(m.level_first_approver = ? OR m.level_second_approver = ?)")
                params.extend([uid, uid])
            else:
                # Engineer own data
                conds.append("m.user_id = ?")
                params.append(uid)

        if zone != "All":
            conds.append("u.zone_name = ?")
            params.append(zone)

        if district != "All":
            conds.append("(u.district_name = ? OR EXISTS(SELECT 1 FROM expense_itinerary i2 WHERE i2.exp_id = m.exp_id AND i2.to_district = ?))")
            params.extend([district, district])

        if engineer != "All":
            conds.append("m.user_id = ?")
            params.append(engineer)

        if status != "All":
            if status == "Pending":
                conds.append("m.status LIKE 'Pending%'")
            else:
                conds.append("m.status = ?")
                params.append(status)

        if start_date and end_date:
            conds.append("(m.expense_date >= ? AND m.expense_date <= ?)")
            params.extend([start_date, end_date])

        where_clause = " AND ".join(conds)

        raw_sql = f"""
            SELECT m.exp_id, m.user_id, m.expense_date, m.total_amount, m.status,
                   m.level_first_approver, m.level_second_approver,
                   u.full_name, u.zone_name, u.district_name as user_district,
                   (SELECT SUM(distance_km) FROM expense_itinerary WHERE exp_id = m.exp_id) AS total_km
            FROM expense_master m
            JOIN user u ON m.user_id = u.user_id
            WHERE {where_clause}
            ORDER BY m.expense_date DESC
        """
        raw_results = cursor.execute(raw_sql, params).fetchall()

        agg_sql = f"""
            SELECT 
                u.district_name as district,
                COUNT(m.exp_id) as total_complaints,
                SUM(CASE WHEN m.status = 'Approved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN m.status LIKE 'Pending%' THEN 1 ELSE 0 END) as pending
            FROM expense_master m
            JOIN user u ON m.user_id = u.user_id
            WHERE {where_clause}
            GROUP BY u.district_name
            ORDER BY total_complaints DESC
        """
        agg_results = cursor.execute(agg_sql, params).fetchall()

        expenses_list = []
        for row in raw_results:
            expenses_list.append({
                "exp_id": row["exp_id"],
                "user_id": row["user_id"],
                "expense_date": row["expense_date"],
                "total_amount": float(row["total_amount"]) if row["total_amount"] else 0.0,
                "status": row["status"],
                "level_first_approver": row["level_first_approver"],
                "level_second_approver": row["level_second_approver"],
                "full_name": row["full_name"],
                "zone_name": row["zone_name"],
                "user_district": row["user_district"],
                "total_km": float(row["total_km"]) if row["total_km"] else 0.0
            })

        summary_list = []
        for row in agg_results:
            summary_list.append({
                "district": row["district"] or "Unknown",
                "total_complaints": row["total_complaints"] or 0,
                "resolved": row["resolved"] or 0,
                "pending": row["pending"] or 0
            })

        return jsonify({
            "success": True,
            "expenses": expenses_list,
            "summary": summary_list
        })
    finally:
        conn.close()

@dashboard_bp.route("/penalties", methods=["GET"])
def get_dashboard_penalties():
    user_id_param = request.args.get("user_id")
    uid = resolve_user_id(user_id_param)
    if not uid:
        return jsonify({"success": False, "message": "Unauthorized."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute(
            "SELECT user_id, full_name, role, e_upkaran_id, zone_name, district_name FROM user WHERE user_id = ?",
            (uid,)
        ).fetchone()

        if not user:
            return jsonify({"success": False, "message": "User not found."}), 403

        role = (user["role"] or "").strip()
        user_name = user["full_name"] or ""
        is_admin = role in ["Admin", "Superadmin"]
        is_coordinator = role == "Coordinator"
        is_dm = role in ["Divisional Manager", "DM"]
        is_di = role in ["District Incharge", "DI"]
        is_manager = role == "Manager"

        zone = request.args.get("zone", "All")
        district = request.args.get("district", "All")
        facility = request.args.get("facility", "All")
        engineer = request.args.get("engineer", "All")
        manager = request.args.get("manager", "All")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        try:
            cursor.execute('SELECT 1 FROM "Facily Details" LIMIT 1')
            fac_table = '"Facily Details"'
        except Exception:
            fac_table = 'facility_details'

        conds = ["1=1"]
        params = []

        if not is_admin:
            if is_coordinator:
                conds.append("f.coordinator_name = ?")
                params.append(user_name)
            elif is_dm:
                conds.append("f.dm_name = ?")
                params.append(user_name)
            elif is_di:
                conds.append("f.district_name = ?")
                params.append(user["district_name"])
            elif is_manager:
                conds.append("f.facility_incharge = ?")
                params.append(user_name)
            else:
                e_id = user["e_upkaran_id"] or "XXX"
                conds.append("(p.attend_engineer_id = ? OR p.close_engineer_id = ?)")
                params.extend([e_id, e_id])

        if zone != "All":
            conds.append("f.zone_name = ?")
            params.append(zone)

        if district != "All":
            conds.append("f.district_name = ?")
            params.append(district)

        if facility != "All":
            conds.append("p.hospital_name = ?")
            params.append(facility)

        if manager != "All":
            conds.append("f.facility_incharge = ?")
            params.append(manager)

        if engineer != "All":
            conds.append("(p.attend_engineer_id = ? OR p.close_engineer_id = ?)")
            params.extend([engineer, engineer])

        if start_date and end_date:
            pd_sql = """(SUBSTR(p.complaint_raise_date, 8, 4) || '-' || 
                         CASE SUBSTR(p.complaint_raise_date, 4, 3) 
                             WHEN 'Jan' THEN '01' 
                             WHEN 'Feb' THEN '02' 
                             WHEN 'Mar' THEN '03' 
                             WHEN 'Apr' THEN '04' 
                             WHEN 'May' THEN '05' 
                             WHEN 'Jun' THEN '06' 
                             WHEN 'Jul' THEN '07' 
                             WHEN 'Aug' THEN '08' 
                             WHEN 'Sep' THEN '09' 
                             WHEN 'Oct' THEN '10' 
                             WHEN 'Nov' THEN '11' 
                             WHEN 'Dec' THEN '12' 
                         END || '-' || 
                         SUBSTR(p.complaint_raise_date, 1, 2))"""
            conds.append(f"({pd_sql} >= ? AND {pd_sql} <= ?)")
            params.extend([start_date, end_date])

        where_clause = " AND ".join(conds)

        raw_sql = f"""
            SELECT p.*, f.district_name as facility_district 
            FROM penalty_report p 
            LEFT JOIN {fac_table} f ON p.hospital_name = f.facility_name 
            WHERE {where_clause} 
            ORDER BY p.complaint_raise_date DESC
        """
        raw_results = cursor.execute(raw_sql, params).fetchall()

        agg_sql = f"""
            SELECT 
                COALESCE(f.district_name, 'Unknown') as district,
                COUNT(p.id) as total_complaints,
                SUM(CASE WHEN LOWER(p.complaint_status) LIKE '%close%' OR LOWER(p.complaint_status) LIKE '%resolv%' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN LOWER(p.complaint_status) NOT LIKE '%close%' AND LOWER(p.complaint_status) NOT LIKE '%resolv%' THEN 1 ELSE 0 END) as pending,
                SUM(COALESCE(CAST(p.attend_penalty AS REAL), 0)) as attend_penalty,
                SUM(COALESCE(CAST(p.penalty AS REAL), 0)) as close_penalty,
                SUM(COALESCE(CAST(p.total_penalty AS REAL), 0)) as total_penalty
            FROM penalty_report p
            LEFT JOIN {fac_table} f ON p.hospital_name = f.facility_name
            WHERE {where_clause}
            GROUP BY district
            ORDER BY total_complaints DESC
        """
        agg_results = cursor.execute(agg_sql, params).fetchall()

        penalties_list = []
        for row in raw_results:
            penalties_list.append(dict(row))

        summary_list = []
        for row in agg_results:
            summary_list.append({
                "district": row["district"] or "Unknown",
                "total_complaints": row["total_complaints"] or 0,
                "resolved": row["resolved"] or 0,
                "pending": row["pending"] or 0,
                "attend_penalty": float(row["attend_penalty"]) if row["attend_penalty"] else 0.0,
                "close_penalty": float(row["close_penalty"]) if row["close_penalty"] else 0.0,
                "total_penalty": float(row["total_penalty"]) if row["total_penalty"] else 0.0
            })

        return jsonify({
            "success": True,
            "penalties": penalties_list,
            "summary": summary_list
        })
    finally:
        conn.close()
