# endpoints/month.py
from flask import Blueprint, request, jsonify
from db import get_db_connection

month_bp = Blueprint('month', __name__)

def to_float(v) -> float:
    try:
        return float(v) if v else 0.0
    except ValueError:
        return 0.0

def build_date_filter(month: str, year: str, alias: str = "em"):
    clauses = []
    params = []
    if month:
        mm = str(int(month)).zfill(2)
        clauses.append(f"strftime('%m', {alias}.expense_date) = ?")
        params.append(mm)
    if year:
        clauses.append(f"strftime('%Y', {alias}.expense_date) = ?")
        params.append(str(int(year)))
    
    clause_str = " AND " + " AND ".join(clauses) if clauses else ""
    return clause_str, params

def build_access_filter(role: str, user_id: str):
    open_roles = ["Admin", "Superadmin", "Travel Desk", "Accounts"]
    if role in open_roles:
        return "", []
    elif role == "Manager":
        return "AND em.level_first_approver = ?", [user_id]
    elif role in ["Coordinator", "Divisional Manager"]:
        return "AND em.level_second_approver = ?", [user_id]
    elif role == "Engineer":
        return "AND em.user_id = ?", [user_id]
    else:
        return "AND 1 = 0", []  # Deny by default

@month_bp.route("/summary", methods=["GET"])
def get_month_summary():
    user_id = getattr(request, 'user_id', None)
    status = request.args.get("status", "Approved")
    month = request.args.get("month")
    year = request.args.get("year")

    if not user_id:
        return jsonify({"success": False, "message": "user_id is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT role FROM user WHERE user_id = ? LIMIT 1", (user_id,)).fetchone()
        if not user:
            return jsonify({"success": False, "message": "Unauthorized: user not found."}), 403

        role = user["role"] or ""
        access_clause, access_params = build_access_filter(role, user_id)
        date_clause, date_params = build_date_filter(month, year, "em")

        sql = f"""
            SELECT
                u.user_id,
                u.full_name,
                u.e_code,
                u.designation,
                u.grade,
                u.district_name,
                u.mobile_number,
                COUNT(DISTINCT em.exp_id) AS expense_count,
                COALESCE(SUM(em.da_amount), 0) AS da_amount,
                COALESCE(SUM(em.hotel_amount), 0) AS hotel_amount,
                COALESCE(SUM(em.local_purchase_amount), 0) AS local_purchase_amount,
                COALESCE(SUM(em.other_expense_amount), 0) AS other_expense_amount,
                COALESCE(SUM(ei.travel_amount), 0) AS travel_amount,
                COALESCE(SUM(ei.sub_amount), 0) AS sub_amount,
                COALESCE(SUM(ei.distance_km), 0) AS total_km,
                COALESCE(SUM(em.total_amount), 0) AS total_amount
            FROM expense_master em
            INNER JOIN user u ON u.user_id = em.user_id
            LEFT JOIN expense_itinerary ei ON ei.exp_id = em.exp_id
            WHERE em.status = ?
                  {date_clause}
                  {access_clause}
            GROUP BY
                u.user_id, u.full_name, u.e_code, u.designation, u.grade, u.district_name, u.mobile_number
            ORDER BY u.full_name ASC
        """
        
        bind_params = [status] + date_params + access_params
        results = cursor.execute(sql, bind_params).fetchall()

        engineers = []
        for eng in results:
            engineers.append({
                "user_id": str(eng["user_id"]),
                "full_name": eng["full_name"] or "",
                "e_code": eng["e_code"] or "",
                "designation": eng["designation"] or "",
                "grade": eng["grade"] or "",
                "district_name": eng["district_name"] or "",
                "mobile_number": eng["mobile_number"] or "",
                "mobile": eng["mobile_number"] or "",  # Fallback for frontend
                "expense_count": eng["expense_count"] or 0,
                "da_amount": to_float(eng["da_amount"]),
                "hotel_amount": to_float(eng["hotel_amount"]),
                "local_purchase_amount": to_float(eng["local_purchase_amount"]),
                "other_expense_amount": to_float(eng["other_expense_amount"]),
                "travel_amount": to_float(eng["travel_amount"]) + to_float(eng["sub_amount"]),
                "total_km": to_float(eng["total_km"]),
                "total_amount": to_float(eng["total_amount"])
            })

        return jsonify({
            "success": True,
            "count": len(engineers),
            "engineers": engineers
        })
    finally:
        conn.close()

@month_bp.route("/detail", methods=["GET"])
def get_month_detail():
    user_id = getattr(request, 'user_id', None)
    engineer_id = request.args.get("engineer_id") or request.args.get("engineerId")
    status = request.args.get("status", "Approved")
    month = request.args.get("month")
    year = request.args.get("year")

    if not user_id or not engineer_id:
        return jsonify({"success": False, "message": "user_id and engineer_id are required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Auth check
        requester = cursor.execute("SELECT role FROM user WHERE user_id = ? LIMIT 1", (user_id,)).fetchone()
        if not requester:
            return jsonify({"success": False, "message": "Unauthorized: user not found."}), 403

        role = requester["role"] or ""
        
        # Engineer can only see own
        if role == "Engineer" and str(user_id) != str(engineer_id):
            return jsonify({"success": False, "message": "Access denied."}), 403

        # Manager checks
        if role == "Manager":
            check = cursor.execute(
                "SELECT exp_id FROM expense_master WHERE user_id = ? AND level_first_approver = ? AND status = ? LIMIT 1",
                (engineer_id, user_id, status)
            ).fetchone()
            if not check:
                return jsonify({"success": False, "message": "Access denied."}), 403

        # Coordinator / DM checks
        if role in ["Coordinator", "Divisional Manager"]:
            check = cursor.execute(
                "SELECT exp_id FROM expense_master WHERE user_id = ? AND level_second_approver = ? AND status = ? LIMIT 1",
                (engineer_id, user_id, status)
            ).fetchone()
            if not check:
                return jsonify({"success": False, "message": "Access denied."}), 403

        date_clause, date_params = build_date_filter(month, year, "em")

        exp_sql = f"""
            SELECT
                em.exp_id,
                em.user_id,
                u.full_name,
                u.e_code,
                u.grade,
                u.designation,
                u.district_name,
                u.mobile_number,
                em.expense_date,
                em.da_amount,
                em.hotel_amount,
                em.local_purchase_desc,
                em.local_purchase_amount,
                em.other_expense_desc,
                em.other_expense_amount,
                em.visit_purpose,
                em.calls_assigned,
                em.calls_completed,
                em.pms_count,
                em.asset_tagging,
                em.total_amount,
                em.status,
                em.level_first_approver,
                em.level_second_approver,
                (SELECT full_name FROM user WHERE user_id = em.level_first_approver) as l1_name,
                (SELECT full_name FROM user WHERE user_id = em.level_second_approver) as l2_name
            FROM expense_master em
            LEFT JOIN user u ON u.user_id = em.user_id
            WHERE em.user_id = ?
              AND em.status = ?
                  {date_clause}
            ORDER BY em.expense_date ASC
        """
        
        bind_params = [engineer_id, status] + date_params
        expenses = cursor.execute(exp_sql, bind_params).fetchall()

        if not expenses:
            return jsonify({"success": True, "expenses": []})

        exp_ids = [e["exp_id"] for e in expenses]
        placeholders = ",".join(["?" for _ in exp_ids])

        # Fetch itineraries + automated penalty report barcode mapping
        # Exact logic translation of PRAGMA-like barcode lookup in SQLite
        iti_sql = f"""
            SELECT
                ei.itinerary_id,
                ei.exp_id,
                ei.leg_number,
                ei.from_location,
                ei.to_location,
                ei.from_district,
                ei.to_district,
                ei.travel_mode,
                ei.sub_mode,
                ei.sub_km,
                ei.distance_km,
                ei.travel_amount,
                ei.sub_amount,
                ei.visit_purpose,
                ei.working_district,
                ei.da_amount,
                ei.hotel_amount,
                ei.other_desc,
                ei.other_amount,
                ei.calls_assigned,
                ei.calls_completed,
                ei.pms_count,
                ei.asset_tagging,
                (
                    SELECT GROUP_CONCAT(DISTINCT SUBSTR(pr.bar_code, -8))
                    FROM penalty_report pr
                    WHERE (
                            (ei.from_location IS NOT NULL AND ei.from_location != '' AND pr.hospital_name = ei.from_location)
                            OR 
                            (ei.to_location IS NOT NULL AND ei.to_location != '' AND pr.hospital_name = ei.to_location)
                          )
                      AND (
                          pr.attend_date LIKE SUBSTR(em.expense_date, 1, 10) || '%' OR
                          pr.complaint_close_date LIKE SUBSTR(em.expense_date, 1, 10) || '%' OR
                          SUBSTR(em.expense_date, 1, 10) LIKE '%' || SUBSTR(pr.attend_date, 1, 10) || '%'
                      )
                ) as auto_asset_tagging
             FROM expense_itinerary ei
             JOIN expense_master em ON ei.exp_id = em.exp_id
             WHERE ei.exp_id IN ({placeholders})
             ORDER BY ei.exp_id ASC, ei.leg_number ASC
        """
        itineraries = cursor.execute(iti_sql, exp_ids).fetchall()

        # Fetch attachments
        att_sql = f"""
            SELECT id, exp_id, itinerary_id, file_url, bill_type
            FROM expense_attachments
            WHERE exp_id IN ({placeholders})
        """
        attachments = cursor.execute(att_sql, exp_ids).fetchall()

        # Grouping
        iti_map = {}
        for leg in itineraries:
            eid = leg["exp_id"]
            if eid not in iti_map:
                iti_map[eid] = []
            
            # Filter attachments for this leg
            leg_atts = [
                {
                    "attachment_id": a["id"],
                    "url": a["file_url"],
                    "bill_type": a["bill_type"]
                }
                for a in attachments if str(a["itinerary_id"]) == str(leg["itinerary_id"])
            ]

            iti_map[eid].append({
                "itinerary_id": leg["itinerary_id"],
                "leg_number": leg["leg_number"] or 0,
                "from_location": leg["from_location"] or "",
                "to_location": leg["to_location"] or "",
                "from_district": leg["from_district"] or "",
                "to_district": leg["to_district"] or "",
                "travel_mode": leg["travel_mode"] or "",
                "sub_mode": leg["sub_mode"] or "",
                "sub_km": to_float(leg["sub_km"]),
                "distance_km": to_float(leg["distance_km"]),
                "travel_amount": to_float(leg["travel_amount"]),
                "sub_amount": to_float(leg["sub_amount"]),
                "visit_purpose": leg["visit_purpose"] or "",
                "working_district": leg["working_district"] or "",
                "da_amount": to_float(leg["da_amount"]),
                "hotel_amount": to_float(leg["hotel_amount"]),
                "other_desc": leg["other_desc"] or "",
                "other_amount": to_float(leg["other_amount"]),
                "calls_assigned": leg["calls_assigned"] or 0,
                "calls_completed": leg["calls_completed"] or 0,
                "pms_count": leg["pms_count"] or 0,
                "asset_tagging": leg["auto_asset_tagging"] if leg["auto_asset_tagging"] else (leg["asset_tagging"] or ""),
                "attachments": leg_atts
            })

        # Group global attachments
        global_att_map = {}
        for att in attachments:
            if not att["itinerary_id"]:
                eid = att["exp_id"]
                if eid not in global_att_map:
                    global_att_map[eid] = []
                global_att_map[eid].append({
                    "attachment_id": att["id"],
                    "url": att["file_url"],
                    "bill_type": att["bill_type"]
                })

        # Construct final list
        output = []
        for e in expenses:
            eid = e["exp_id"]
            output.append({
                "expense_id": e["exp_id"],
                "user_id": e["user_id"],
                "full_name": e["full_name"] or "",
                "e_code": e["e_code"] or "",
                "grade": e["grade"] or "",
                "designation": e["designation"] or "",
                "district_name": e["district_name"] or "",
                "mobile_number": e["mobile_number"] or "",
                "mobile": e["mobile_number"] or "",
                "l1_name": e["l1_name"] or "",
                "l2_name": e["l2_name"] or "",
                "expense_date": e["expense_date"],
                "da_amount": to_float(e["da_amount"]),
                "hotel_amount": to_float(e["hotel_amount"]),
                "local_purchase_desc": e["local_purchase_desc"] or "",
                "local_purchase_amount": to_float(e["local_purchase_amount"]),
                "other_expense_desc": e["other_expense_desc"] or "",
                "other_expense_amount": to_float(e["other_expense_amount"]),
                "visit_purpose": e["visit_purpose"] or "",
                "calls_assigned": e["calls_assigned"] or 0,
                "calls_completed": e["calls_completed"] or 0,
                "pms_count": e["pms_count"] or 0,
                "asset_tagging": e["asset_tagging"] or "",
                "total_amount": to_float(e["total_amount"]),
                "status": e["status"],
                "level_first_approver": e["level_first_approver"],
                "level_second_approver": e["level_second_approver"],
                "itineraries": iti_map.get(eid, []),
                "expense_attachments": global_att_map.get(eid, [])
            })

        return jsonify({
            "success": True,
            "expenses": output
        })
    finally:
        conn.close()
