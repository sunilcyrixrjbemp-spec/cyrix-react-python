# endpoints/expense.py
from flask import Blueprint, request, jsonify
import json
import os
import time
from datetime import datetime
from db import get_db_connection

expense_bp = Blueprint('expense', __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def resolve_logged_in_user_id(req_obj):
    return getattr(req_obj, 'user_id', None)

@expense_bp.route("/init", methods=["GET"])
def init_expense():
    uid = resolve_logged_in_user_id(request)
    if not uid:
        return jsonify({"success": False, "message": "Unauthorized: Please login first."}), 401

    req_month = request.args.get("month") or datetime.now().isoformat()[:7]

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute(
            "SELECT full_name, e_code, grade, district_name as home_district, level_first_approver, level_second_approver FROM user WHERE user_id = ?",
            (uid,)
        ).fetchone()

        if not user:
            return jsonify({"success": False, "message": "Invalid User: You don't have access to submit expenses."}), 403

        # Total KM this month
        km_res = cursor.execute("""
            SELECT SUM(i.distance_km) as total_km 
            FROM expense_itinerary i 
            JOIN expense_master m ON i.exp_id = m.exp_id 
            WHERE m.user_id = ? 
              AND strftime('%Y-%m', m.expense_date) = ? 
              AND (i.travel_mode = 'Bike' OR i.travel_mode = 'Car')
        """, (uid, req_month)).fetchone()
        total_km = float(km_res["total_km"]) if km_res and km_res["total_km"] else 0.0

        # Total Auto amount this month
        auto_res = cursor.execute("""
            SELECT COALESCE(SUM(i.travel_amount), 0) + COALESCE(SUM(i.sub_amount), 0) as total_auto 
            FROM expense_itinerary i 
            JOIN expense_master m ON i.exp_id = m.exp_id 
            WHERE m.user_id = ? 
              AND strftime('%Y-%m', m.expense_date) = ? 
              AND (i.travel_mode = 'Auto' OR i.sub_mode = 'Auto')
        """, (uid, req_month)).fetchone()
        total_auto = float(auto_res["total_auto"]) if auto_res and auto_res["total_auto"] else 0.0

        # Mapped Facilities list
        try:
            cursor.execute('SELECT 1 FROM "Facily Details" LIMIT 1')
            fac_table = '"Facily Details"'
        except Exception:
            fac_table = 'facility_details'
            
        fac_res = cursor.execute(f"SELECT district_name, facility_name FROM {fac_table}").fetchall()
        facilities = {}
        for row in fac_res:
            d_name = row["district_name"]
            f_name = row["facility_name"]
            if d_name not in facilities:
                facilities[d_name] = []
            facilities[d_name].append(f_name)

        # Submitted dates
        submitted_res = cursor.execute(
            "SELECT expense_date FROM expense_master WHERE user_id = ? AND strftime('%Y-%m', expense_date) = ?",
            (uid, req_month)
        ).fetchall()
        submitted_dates = [r["expense_date"] for r in submitted_res]

        # Approved Limit KM requests
        approved_km_req = cursor.execute("""
            SELECT COALESCE(SUM(requested_value), 0) as approved_km 
            FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'KM' AND LOWER(status) = 'approved' AND for_month = ?
        """, (uid, req_month)).fetchone()
        approved_km = float(approved_km_req["approved_km"]) if approved_km_req else 0.0

        # Approved Limit Auto requests
        approved_auto_req = cursor.execute("""
            SELECT COALESCE(SUM(requested_value), 0) as approved_auto 
            FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'AUTO' AND LOWER(status) = 'approved' AND for_month = ?
        """, (uid, req_month)).fetchone()
        approved_auto = float(approved_auto_req["approved_auto"]) if approved_auto_req else 0.0

        # Existing KM/Auto request status
        existing_km = cursor.execute("""
            SELECT status, requested_value FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'KM' AND for_month = ? ORDER BY id DESC LIMIT 1
        """, (uid, req_month)).fetchone()
        existing_km_req = dict(existing_km) if existing_km else None

        existing_auto = cursor.execute("""
            SELECT status, requested_value FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'AUTO' AND for_month = ? ORDER BY id DESC LIMIT 1
        """, (uid, req_month)).fetchone()
        existing_auto_req = dict(existing_auto) if existing_auto else None

        # Fetch Allowance Master
        allowance = cursor.execute("SELECT * FROM allowance_master WHERE grade = ?", (user["grade"],)).fetchone()
        if allowance:
            allowance_dict = dict(allowance)
        else:
            allowance_dict = {
                "daily_in_district": 250,
                "daily_out_district": 400,
                "daily_hotel": 350,
                "daily_out_state": 600,
                "hotel_in_state_s": 1500,
                "max_km_per_month": 2000,
                "rate_bike": 4.5,
                "rate_car": 9.0,
                "vehicle_type": "Bike"
            }

        allowance_dict["current_month_km"] = total_km
        allowance_dict["current_month_auto"] = total_auto
        allowance_dict["max_auto_per_month"] = 1000

        # Next pending ID format
        mm = datetime.now().strftime("%m")
        yy = datetime.now().strftime("%y")

        return jsonify({
            "success": True,
            "user": {
                "full_name": user["full_name"],
                "e_code": user["e_code"],
                "grade": user["grade"],
                "home_district": user["home_district"],
                "level_first_approver": user["level_first_approver"],
                "level_second_approver": user["level_second_approver"]
            },
            "allowance": allowance_dict,
            "facilities": facilities,
            "submitted_dates": submitted_dates,
            "approved_km": approved_km,
            "approved_auto": approved_auto,
            "existing_km_req": existing_km_req,
            "existing_auto_req": existing_auto_req,
            "next_exp_id": f"RJ-{mm}/{yy}-PENDING"
        })
    finally:
        conn.close()

@expense_bp.route("/edit", methods=["GET"])
def get_expense_edit():
    uid = resolve_logged_in_user_id(request)
    if not uid:
        return jsonify({"success": False, "message": "Unauthorized."}), 401

    exp_id = request.args.get("exp_id")
    if not exp_id:
        return jsonify({"success": False, "message": "exp_id is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        expense = cursor.execute("""
            SELECT m.*, u.full_name, u.e_code, u.grade, u.district_name as home_district
            FROM expense_master m
            JOIN user u ON m.user_id = u.user_id
            WHERE m.exp_id = ?
        """, (exp_id,)).fetchone()

        if not expense:
            return jsonify({"success": False, "message": "Expense not found."}), 404

        if expense["user_id"] != uid:
            return jsonify({"success": False, "message": "Access Denied: You can only edit your own expenses."}), 403

        if "pending" not in (expense["status"] or "").lower():
            return jsonify({"success": False, "message": f"This expense is already {expense['status']} and cannot be edited."}), 409

        itineraries = cursor.execute("""
            SELECT i.*,
                COALESCE(
                    (SELECT GROUP_CONCAT(a.file_url || '::' || a.bill_type, '|||')
                     FROM expense_attachments a
                     WHERE a.itinerary_id = i.itinerary_id),
                    ''
                ) as attachments_raw
            FROM expense_itinerary i
            WHERE i.exp_id = ?
            ORDER BY i.leg_number ASC
        """, (exp_id,)).fetchall()

        enriched_itineraries = []
        for leg in itineraries:
            attachments = []
            if leg["attachments_raw"]:
                for raw in leg["attachments_raw"].split("|||"):
                    if not raw:
                        continue
                    parts = raw.split("::")
                    url_val = parts[0]
                    bill_type = parts[1] if len(parts) > 1 else ""
                    attachments.append({"url": url_val, "bill_type": bill_type})

            enriched_itineraries.append({
                "itinerary_id": leg["itinerary_id"],
                "exp_id": leg["exp_id"],
                "leg": leg["leg_number"],
                "from": leg["from_location"],
                "to": leg["to_location"],
                "mode": leg["travel_mode"],
                "km": leg["distance_km"],
                "amount": leg["travel_amount"],
                "district": leg["to_district"],
                "district_from": leg["from_district"],
                "travel_type": "Outdoor" if leg["from_district"] != leg["to_district"] else "In-District",
                "ws_assigned": leg["calls_assigned"],
                "ws_closed": leg["calls_completed"],
                "ws_pms": leg["pms_count"],
                "ws_asset": leg["asset_tagging"],
                "da": leg["da_amount"],
                "hotel": leg["hotel_amount"],
                "oth_desc": leg["other_desc"],
                "oth_amount": leg["other_amount"],
                "visit_purpose": leg["visit_purpose"],
                "sub_mode": leg["sub_mode"],
                "sub_km": leg["sub_km"],
                "sub_amount": leg["sub_amount"],
                "attachments": attachments
            })

        return jsonify({
            "success": True,
            "expense": dict(expense),
            "itineraries": enriched_itineraries
        })
    finally:
        conn.close()

@expense_bp.route("/limit-request", methods=["POST"])
def create_limit_request():
    uid = resolve_logged_in_user_id(request)
    if not uid:
        return jsonify({"success": False, "message": "Unauthorized: Please login first."}), 401

    req_type = request.form.get("type") or (request.get_json() or {}).get("type")
    amount = request.form.get("amount") or (request.get_json() or {}).get("amount")
    req_month = (request.form.get("month") or (request.get_json() or {}).get("month")) or datetime.now().isoformat()[:7]

    if not req_type or not amount:
        return jsonify({"success": False, "message": "Type ('KM'/'AUTO') and amount are required."}), 400

    try:
        parsed_amount = float(amount)
        if parsed_amount <= 0:
            raise ValueError
    except ValueError:
        return jsonify({"success": False, "message": "Please enter a valid requested amount greater than 0."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT level_first_approver FROM user WHERE user_id = ?", (uid,)).fetchone()
        if not user:
            return jsonify({"success": False, "message": "User not found in database."}), 404

        manager_id = user["level_first_approver"]
        if not manager_id:
            return jsonify({
                "success": False,
                "message": "Approval Blocked: No Level 1 Manager is mapped to your profile."
            }), 400

        existing = cursor.execute(
            "SELECT id, status FROM limit_approval_requests WHERE user_id = ? AND request_type = ? AND for_month = ?",
            (uid, req_type, req_month)
        ).fetchone()

        if existing:
            return jsonify({
                "success": False,
                "message": f"Limit request denied: You have already submitted a request for {req_type} this month. Current status is '{existing['status']}'."
            }), 400

        cursor.execute("""
            INSERT INTO limit_approval_requests (user_id, manager_id, request_type, requested_value, status, for_month)
            VALUES (?, ?, ?, ?, 'Pending', ?)
        """, (uid, manager_id, req_type, parsed_amount, req_month))
        conn.commit()

        return jsonify({
            "success": True,
            "message": f"Limit approval request for additional {parsed_amount} {req_type} successfully saved and sent to your manager ({manager_id})."
        })
    finally:
        conn.close()

def save_upload_file(file, exp_id: str, type_str: str) -> str:
    """Saves file to local uploads directory and returns local url path."""
    if not file or not file.filename:
        return ""
    safe_name = str(file.filename).replace(" ", "_")
    filename = f"{exp_id}_{type_str}_{int(time.time()*1000)}_{safe_name}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    file.save(filepath)
    return f"/uploads/{filename}"

@expense_bp.route("", methods=["POST"])
@expense_bp.route("/submit", methods=["POST"])
def submit_expense():
    uid = resolve_logged_in_user_id(request)
    if not uid:
        return jsonify({"success": False, "message": "Unauthorized: User ID is missing."}), 401

    exp_date = request.form.get("exp_date") or request.form.get("expense_date")
    if not exp_date:
        return jsonify({"success": False, "message": "Expense date is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Check duplicate
        existing = cursor.execute(
            "SELECT exp_id FROM expense_master WHERE user_id = ? AND expense_date = ?",
            (uid, exp_date)
        ).fetchone()
        if existing:
            return jsonify({"success": False, "message": f"For this date ({exp_date}) expense is already submitted."}), 400

        user = cursor.execute(
            "SELECT level_first_approver, level_second_approver FROM user WHERE user_id = ?",
            (uid,)
        ).fetchone()
        if not user:
            return jsonify({"success": False, "message": "Security Error: Invalid User ID."}), 403

        l1_app = user["level_first_approver"]
        l2_app = user["level_second_approver"]

        iti_str = request.form.get("itineraries")
        if not iti_str:
            return jsonify({"success": False, "message": "Itineraries are required."}), 400

        try:
            itineraries = json.loads(iti_str)
        except Exception:
            return jsonify({"success": False, "message": "Invalid itineraries JSON payload."}), 400

        # Calc totals
        total_da = 0.0
        total_hotel = 0.0
        total_other = 0.0
        total_assigned = 0
        total_completed = 0
        total_pms = 0
        total_asset = 0

        incoming_km = 0.0
        incoming_auto = 0.0

        for iti in itineraries:
            total_da += float(iti.get("da") or 0.0)
            total_hotel += float(iti.get("hotel") or 0.0)
            total_other += float(iti.get("oth_amount") or 0.0)
            total_assigned += int(iti.get("ws_assigned") or 0)
            total_completed += int(iti.get("ws_closed") or 0)
            total_pms += int(iti.get("ws_pms") or 0)
            total_asset += int(iti.get("ws_asset") or 0)

            mode = iti.get("mode")
            if mode in ['Bike', 'Car']:
                incoming_km += float(iti.get("km") or 0.0)
            elif mode == 'Auto':
                incoming_auto += float(iti.get("amount") or 0.0)

            sub_mode = iti.get("sub_mode")
            if sub_mode == 'Auto':
                incoming_auto += float(iti.get("sub_amount") or 0.0)

        # Limits Check
        current_month = exp_date[:7]
        
        # Accum km
        km_res = cursor.execute("""
            SELECT COALESCE(SUM(i.distance_km), 0) as total_km 
            FROM expense_itinerary i 
            JOIN expense_master m ON i.exp_id = m.exp_id 
            WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
              AND (i.travel_mode = 'Bike' OR i.travel_mode = 'Car')
        """, (uid, current_month)).fetchone()
        accum_km = float(km_res["total_km"]) if km_res and km_res["total_km"] else 0.0

        # Accum auto
        auto_res = cursor.execute("""
            SELECT COALESCE(SUM(i.travel_amount), 0) + COALESCE(SUM(i.sub_amount), 0) as total_auto 
            FROM expense_itinerary i 
            JOIN expense_master m ON i.exp_id = m.exp_id 
            WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
              AND (i.travel_mode = 'Auto' OR i.sub_mode = 'Auto')
        """, (uid, current_month)).fetchone()
        accum_auto = float(auto_res["total_auto"]) if auto_res and auto_res["total_auto"] else 0.0

        # Limit allowances
        allowance = cursor.execute(
            "SELECT max_km_per_month FROM allowance_master WHERE grade = (SELECT grade FROM user WHERE user_id = ?)",
            (uid,)
        ).fetchone()
        max_km = allowance["max_km_per_month"] if allowance and allowance["max_km_per_month"] else 2000
        max_auto = 1000

        # Limit approvals
        app_km_res = cursor.execute("""
            SELECT COALESCE(SUM(requested_value), 0) as approved_km 
            FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'KM' AND LOWER(status) = 'approved' AND for_month = ?
        """, (uid, current_month)).fetchone()
        approved_km = float(app_km_res["approved_km"]) if app_km_res and app_km_res["approved_km"] else 0.0

        app_auto_res = cursor.execute("""
            SELECT COALESCE(SUM(requested_value), 0) as approved_auto 
            FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'AUTO' AND LOWER(status) = 'approved' AND for_month = ?
        """, (uid, current_month)).fetchone()
        approved_auto = float(app_auto_res["approved_auto"]) if app_auto_res and app_auto_res["approved_auto"] else 0.0

        if (accum_km + incoming_km) > max_km:
            excess_km = (accum_km + incoming_km) - max_km
            if approved_km < excess_km:
                raise HTTPException(
                    status_code=400,
                    detail=f"Submission Locked: You have exceeded your monthly KM limit by {(excess_km - approved_km):.2f} km. You must request approval from your Level 1 Manager to proceed."
                )

        if (accum_auto + incoming_auto) > max_auto:
            excess_auto = (accum_auto + incoming_auto) - max_auto
            if approved_auto < excess_auto:
                raise HTTPException(
                    status_code=400,
                    detail=f"Submission Locked: You have exceeded your monthly Auto limit by ₹{(excess_auto - approved_auto):.2f}. You must request approval from your Level 1 Manager to proceed."
                )

        # ID Generation: RJ-MM/YY-XXXXXX
        date_obj = datetime.strptime(exp_date, "%Y-%m-%d")
        month_prefix = date_obj.strftime("%m/%y")
        
        cursor.execute("SELECT exp_id FROM expense_master WHERE exp_id LIKE ?", (f"RJ-{month_prefix}-%",))
        matching_rows = cursor.fetchall()
        max_seq = 0
        for r in matching_rows:
            parts = r["exp_id"].split("-")
            if len(parts) == 3:
                try:
                    num = int(parts[2])
                    if num > max_seq:
                        max_seq = num
                except ValueError:
                    pass
        
        seq_num = max_seq + 1
        final_exp_id = f"RJ-{month_prefix}-{str(seq_num).zfill(6)}"

        # Double check collision
        collision = cursor.execute("SELECT exp_id FROM expense_master WHERE exp_id = ?", (final_exp_id,)).fetchone()
        if collision:
            final_exp_id = f"RJ-{month_prefix}-{str(int(time.time()) % 1000000).zfill(6)}"

        cursor.execute("""
            INSERT INTO expense_master (
                exp_id, user_id, expense_date, total_amount, status,
                level_first_approver, level_second_approver,
                da_amount, hotel_amount, other_expense_amount,
                calls_assigned, calls_completed, pms_count, asset_tagging
            ) VALUES (?, ?, ?, ?, 'Pending L1', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            final_exp_id, uid, exp_date, request.form.get("total_amount"),
            l1_app, l2_app,
            total_da, total_hotel, total_other,
            total_assigned, total_completed, total_pms, total_asset
        ))

        # Add itineraries
        for iti in itineraries:
            leg_num = int(iti.get("leg") or 1)
            iti_id = f"{final_exp_id}-{leg_num}"
            from_dist = iti.get("district_from") or iti.get("district")
            to_dist = iti.get("district")

            cursor.execute("""
                INSERT INTO expense_itinerary (
                    itinerary_id, exp_id, leg_number,
                    from_district, to_district,
                    from_location, to_location,
                    travel_mode, distance_km, travel_amount,
                    sub_mode, sub_amount,
                    da_amount, hotel_amount,
                    other_desc, other_amount,
                    calls_assigned, calls_completed, pms_count, asset_tagging,
                    visit_purpose
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                iti_id, final_exp_id, leg_num,
                from_dist, to_dist,
                iti.get("from"), iti.get("to"),
                iti.get("mode"), iti.get("km"), iti.get("amount"),
                iti.get("sub_mode"), iti.get("sub_amount"),
                iti.get("da"), iti.get("hotel"),
                iti.get("oth_desc"), iti.get("oth_amount"),
                iti.get("ws_assigned"), iti.get("ws_closed"), iti.get("ws_pms"), iti.get("ws_asset"),
                iti.get("visit_purpose")
            ))

            # Uploads
            # Leg uploads
            comm_file = request.files.get(f"comm_mail_{leg_num}")
            if comm_file:
                url_path = save_upload_file(comm_file, final_exp_id, "Communication_Mail")
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (final_exp_id, iti_id, "Communication_Mail", url_path)
                )

            main_file = request.files.get(f"main_bill_{leg_num}")
            if main_file:
                url_path = save_upload_file(main_file, final_exp_id, iti.get("mode"))
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (final_exp_id, iti_id, iti.get("mode"), url_path)
                )

            sub_file = request.files.get(f"sub_bill_{leg_num}")
            if sub_file and iti.get("sub_mode"):
                url_path = save_upload_file(sub_file, final_exp_id, iti.get("sub_mode"))
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (final_exp_id, iti_id, iti.get("sub_mode"), url_path)
                )

            if leg_num == 1:
                hotel_file = request.files.get("hotel_bill_1")
                if hotel_file:
                    url_path = save_upload_file(hotel_file, final_exp_id, "Hotel")
                    cursor.execute(
                        "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                        (final_exp_id, iti_id, "Hotel", url_path)
                    )

            oth_file = request.files.get(f"oth_bill_{leg_num}")
            if oth_file:
                url_path = save_upload_file(oth_file, final_exp_id, "Other_Expense")
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (final_exp_id, iti_id, "Other_Expense", url_path)
                )

        conn.commit()
        return jsonify({
            "success": True,
            "message": "Expense submitted successfully.",
            "exp_id": final_exp_id
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": "System Error: " + str(e)}), 500
    finally:
        conn.close()

@expense_bp.route("/edit", methods=["PUT"])
def update_expense():
    uid = resolve_logged_in_user_id(request)
    if not uid:
        return jsonify({"success": False, "message": "Unauthorized."}), 401

    exp_id = request.form.get("exp_id")
    if not exp_id:
        return jsonify({"success": False, "message": "exp_id is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        existing = cursor.execute(
            "SELECT user_id, status, expense_date FROM expense_master WHERE exp_id = ?",
            (exp_id,)
        ).fetchone()

        if not existing:
            return jsonify({"success": False, "message": "Expense not found."}), 404

        if existing["user_id"] != uid:
            return jsonify({"success": False, "message": "Access Denied: You can only edit your own expenses."}), 403

        if "pending" not in (existing["status"] or "").lower():
            return jsonify({"success": False, "message": f"Cannot edit: Expense is already {existing['status']}."}), 409

        exp_date = request.form.get("exp_date") or request.form.get("expense_date") or existing["expense_date"]
        current_month = exp_date[:7]

        iti_str = request.form.get("itineraries")
        itineraries = []
        total_da = 0.0
        total_hotel = 0.0
        total_other = 0.0
        total_assigned = 0
        total_completed = 0
        total_pms = 0
        total_asset = 0

        incoming_km = 0.0
        incoming_auto = 0.0

        if iti_str:
            try:
                itineraries = json.loads(iti_str)
            except Exception:
                return jsonify({"success": False, "message": "Invalid itineraries payload."}), 400

            for iti in itineraries:
                total_da += float(iti.get("da") or 0.0)
                total_hotel += float(iti.get("hotel") or 0.0)
                total_other += float(iti.get("oth_amount") or 0.0)
                total_assigned += int(iti.get("ws_assigned") or 0)
                total_completed += int(iti.get("ws_closed") or 0)
                total_pms += int(iti.get("ws_pms") or 0)
                total_asset += int(iti.get("ws_asset") or 0)

                mode = iti.get("mode")
                if mode in ['Bike', 'Car']:
                    incoming_km += float(iti.get("km") or 0.0)
                elif mode == 'Auto':
                    incoming_auto += float(iti.get("amount") or 0.0)

                sub_mode = iti.get("sub_mode")
                if sub_mode == 'Auto':
                    incoming_auto += float(iti.get("sub_amount") or 0.0)

        # Exclude old values of this specific modified expense first
        old_km_res = cursor.execute("""
            SELECT COALESCE(SUM(distance_km), 0) as total_km 
            FROM expense_itinerary 
            WHERE exp_id = ? AND (travel_mode = 'Bike' OR travel_mode = 'Car')
        """, (exp_id,)).fetchone()
        old_km = float(old_km_res["total_km"]) if old_km_res else 0.0

        old_auto_res = cursor.execute("""
            SELECT COALESCE(SUM(travel_amount), 0) + COALESCE(SUM(sub_amount), 0) as total_auto 
            FROM expense_itinerary 
            WHERE exp_id = ? AND (travel_mode = 'Auto' OR sub_mode = 'Auto')
        """, (exp_id,)).fetchone()
        old_auto = float(old_auto_res["total_auto"]) if old_auto_res else 0.0

        # Accumulated values this month
        accum_km_res = cursor.execute("""
            SELECT COALESCE(SUM(i.distance_km), 0) as total_km 
            FROM expense_itinerary i 
            JOIN expense_master m ON i.exp_id = m.exp_id 
            WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
              AND (i.travel_mode = 'Bike' OR i.travel_mode = 'Car')
        """, (uid, current_month)).fetchone()
        accum_km = float(accum_km_res["total_km"]) if accum_km_res and accum_km_res["total_km"] else 0.0

        accum_auto_res = cursor.execute("""
            SELECT COALESCE(SUM(i.travel_amount), 0) + COALESCE(SUM(i.sub_amount), 0) as total_auto 
            FROM expense_itinerary i 
            JOIN expense_master m ON i.exp_id = m.exp_id 
            WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
              AND (i.travel_mode = 'Auto' OR i.sub_mode = 'Auto')
        """, (uid, current_month)).fetchone()
        accum_auto = float(accum_auto_res["total_auto"]) if accum_auto_res and accum_auto_res["total_auto"] else 0.0

        # Allowance limits
        allowance = cursor.execute(
            "SELECT max_km_per_month FROM allowance_master WHERE grade = (SELECT grade FROM user WHERE user_id = ?)",
            (uid,)
        ).fetchone()
        max_km = allowance["max_km_per_month"] if allowance and allowance["max_km_per_month"] else 2000
        max_auto = 1000

        # Limit approvals
        app_km_res = cursor.execute("""
            SELECT COALESCE(SUM(requested_value), 0) as approved_km 
            FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'KM' AND LOWER(status) = 'approved' AND for_month = ?
        """, (uid, current_month)).fetchone()
        approved_km = float(app_km_res["approved_km"]) if app_km_res and app_km_res["approved_km"] else 0.0

        app_auto_res = cursor.execute("""
            SELECT COALESCE(SUM(requested_value), 0) as approved_auto 
            FROM limit_approval_requests 
            WHERE user_id = ? AND request_type = 'AUTO' AND LOWER(status) = 'approved' AND for_month = ?
        """, (uid, current_month)).fetchone()
        approved_auto = float(app_auto_res["approved_auto"]) if app_auto_res and app_auto_res["approved_auto"] else 0.0

        current_accum_km = max(0.0, accum_km - old_km)
        projected_km = current_accum_km + incoming_km

        if projected_km > max_km:
            excess_km = projected_km - max_km
            if approved_km < excess_km:
                return jsonify({
                    "success": False,
                    "message": f"Submission Locked: You have exceeded your monthly KM limit by {(excess_km - approved_km):.2f} km. You must request approval from your Level 1 Manager to proceed."
                }), 400

        current_accum_auto = max(0.0, accum_auto - old_auto)
        projected_auto = current_accum_auto + incoming_auto

        if projected_auto > max_auto:
            excess_auto = projected_auto - max_auto
            if approved_auto < excess_auto:
                return jsonify({
                    "success": False,
                    "message": f"Submission Locked: You have exceeded your monthly Auto limit by ₹{(excess_auto - approved_auto):.2f}. You must request approval from your Level 1 Manager to proceed."
                }), 400

        # Update Master
        cursor.execute("""
            UPDATE expense_master
            SET total_amount = ?,
                da_amount = ?,
                hotel_amount = ?,
                other_expense_amount = ?,
                calls_assigned = ?,
                calls_completed = ?,
                pms_count = ?,
                asset_tagging = ?
            WHERE exp_id = ?
        """, (
            request.form.get("total_amount"),
            total_da, total_hotel, total_other,
            total_assigned, total_completed, total_pms, total_asset,
            exp_id
        ))

        # Insert/Update Legs
        for iti in itineraries:
            leg_num = int(iti.get("leg") or 1)
            iti_id = f"{exp_id}-{leg_num}"
            from_dist = iti.get("district_from") or iti.get("district")
            to_dist = iti.get("district")

            existing_leg = cursor.execute("SELECT itinerary_id FROM expense_itinerary WHERE itinerary_id = ?", (iti_id,)).fetchone()

            if existing_leg:
                cursor.execute("""
                    UPDATE expense_itinerary
                    SET from_district = ?, to_district = ?,
                        from_location = ?, to_location = ?,
                        travel_mode = ?, distance_km = ?, travel_amount = ?,
                        sub_mode = ?, sub_amount = ?,
                        da_amount = ?, hotel_amount = ?,
                        other_desc = ?, other_amount = ?,
                        calls_assigned = ?, calls_completed = ?,
                        pms_count = ?, asset_tagging = ?,
                        visit_purpose = ?
                    WHERE itinerary_id = ?
                """, (
                    from_dist, to_dist,
                    iti.get("from"), iti.get("to"),
                    iti.get("mode"), iti.get("km"), iti.get("amount"),
                    iti.get("sub_mode"), iti.get("sub_amount"),
                    iti.get("da"), iti.get("hotel"),
                    iti.get("oth_desc"), iti.get("oth_amount"),
                    iti.get("ws_assigned"), iti.get("ws_closed"), iti.get("ws_pms"), iti.get("ws_asset"),
                    iti.get("visit_purpose"),
                    iti_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO expense_itinerary (
                        itinerary_id, exp_id, leg_number,
                        from_district, to_district,
                        from_location, to_location,
                        travel_mode, distance_km, travel_amount,
                        sub_mode, sub_amount,
                        da_amount, hotel_amount,
                        other_desc, other_amount,
                        calls_assigned, calls_completed, pms_count, asset_tagging,
                        visit_purpose
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    iti_id, exp_id, leg_num,
                    from_dist, to_dist,
                    iti.get("from"), iti.get("to"),
                    iti.get("mode"), iti.get("km"), iti.get("amount"),
                    iti.get("sub_mode"), iti.get("sub_amount"),
                    iti.get("da"), iti.get("hotel"),
                    iti.get("oth_desc"), iti.get("oth_amount"),
                    iti.get("ws_assigned"), iti.get("ws_closed"), iti.get("ws_pms"), iti.get("ws_asset"),
                    iti.get("visit_purpose")
                ))

            # Uploads
            comm_file = request.files.get(f"comm_mail_{leg_num}")
            if comm_file:
                url_path = save_upload_file(comm_file, exp_id, "Communication_Mail")
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (exp_id, iti_id, "Communication_Mail", url_path)
                )

            main_file = request.files.get(f"main_bill_{leg_num}")
            if main_file:
                url_path = save_upload_file(main_file, exp_id, iti.get("mode"))
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (exp_id, iti_id, iti.get("mode"), url_path)
                )

            sub_file = request.files.get(f"sub_bill_{leg_num}")
            if sub_file and iti.get("sub_mode"):
                url_path = save_upload_file(sub_file, exp_id, iti.get("sub_mode"))
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (exp_id, iti_id, iti.get("sub_mode"), url_path)
                )

            if leg_num == 1:
                hotel_file = request.files.get("hotel_bill_1")
                if hotel_file:
                    url_path = save_upload_file(hotel_file, exp_id, "Hotel")
                    cursor.execute(
                        "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                        (exp_id, iti_id, "Hotel", url_path)
                    )

            oth_file = request.files.get(f"oth_bill_{leg_num}")
            if oth_file:
                url_path = save_upload_file(oth_file, exp_id, "Other_Expense")
                cursor.execute(
                    "INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)",
                    (exp_id, iti_id, "Other_Expense", url_path)
                )

        conn.commit()
        return jsonify({
            "success": True,
            "message": "Expense updated successfully.",
            "exp_id": exp_id
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": "System Error: " + str(e)}), 500
    finally:
        conn.close()
