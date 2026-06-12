# endpoints/approval.py
from flask import Blueprint, request, jsonify, send_file, Response
import os
import requests
from datetime import datetime
from db import get_db_connection

approval_bp = Blueprint('approval', __name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

def resolve_logged_in_user_id(req_obj, body=None):
    return getattr(req_obj, 'user_id', None)

def get_approver_info(cursor, requester_id: str, exp_id: str = None):
    requester = cursor.execute("SELECT role FROM user WHERE user_id = ?", (requester_id,)).fetchone()
    if not requester:
        return None

    is_admin = (requester["role"] or "") in ["Admin", "Superadmin"]
    is_l1 = False
    is_l2 = False

    if exp_id:
        exp = cursor.execute("SELECT level_first_approver, level_second_approver FROM expense_master WHERE exp_id = ?", (exp_id,)).fetchone()
        if exp:
            is_l1 = exp["level_first_approver"] == requester_id
            is_l2 = exp["level_second_approver"] == requester_id
    else:
        l1_check = cursor.execute("SELECT exp_id FROM expense_master WHERE level_first_approver = ? LIMIT 1", (requester_id,)).fetchone()
        l2_check = cursor.execute("SELECT exp_id FROM expense_master WHERE level_second_approver = ? LIMIT 1", (requester_id,)).fetchone()
        limit_check = cursor.execute("SELECT id FROM limit_approval_requests WHERE manager_id = ? LIMIT 1", (requester_id,)).fetchone()
        is_l1 = bool(l1_check or limit_check)
        is_l2 = bool(l2_check)

    return {
        "is_admin": is_admin,
        "is_l1": is_l1,
        "is_l2": is_l2,
        "role": requester["role"]
    }

def can_access_approval_center(cursor, requester_id: str) -> bool:
    info = get_approver_info(cursor, requester_id)
    if not info:
        return False
    if info["is_admin"]:
        return True
    manager_roles = ["manager", "hod", "accounts", "senior manager", "zsm", "rsm", "asm", "divisional manager", "coordinator"]
    has_role = any(r in (info["role"] or "").lower() for r in manager_roles)
    return has_role or info["is_l1"] or info["is_l2"]

def derive_action_level(expense):
    status = (expense["status"] or "").lower()
    if status == "pending l2":
        return "L2"
    if status in ["pending l1", "pending"]:
        return "L1"
    if status in ["rejected", "approved"]:
        if expense["approved_by"]:
            if expense["approved_by"] == expense["level_second_approver"]:
                return "L2"
            if expense["approved_by"] == expense["level_first_approver"]:
                return "L1"
    return None

@approval_bp.route("/image", methods=["GET"])
def get_image():
    user_id = getattr(request, 'user_id', None)
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized."}), 401

    object_key = request.args.get("key")
    raw_url = request.args.get("url")

    if not object_key and raw_url:
        from urllib.parse import urlparse
        parsed = urlparse(raw_url)
        if parsed.path.startswith("/uploads/"):
            object_key = parsed.path.replace("/uploads/", "")
        else:
            object_key = raw_url

    if not object_key:
        return jsonify({"success": False, "message": "Missing key or url parameter."}), 400

    # Try local serving
    local_path = os.path.join(UPLOAD_DIR, object_key)
    if os.path.exists(local_path):
        return send_file(local_path)

    # Try proxying from original Cloudflare R2 if it is an external URL (cloned DB)
    if raw_url and raw_url.startswith("http"):
        try:
            resp = requests.get(raw_url, stream=True, timeout=5)
            if resp.status_code == 200:
                content_type = resp.headers.get("Content-Type", "image/jpeg")
                return Response(resp.content, mimetype=content_type)
        except Exception as e:
            print(f"Failed to proxy image {raw_url}: {e}")

    return jsonify({"success": False, "message": "Image not found."}), 404

@approval_bp.route("/list", methods=["GET"])
def get_approval_list():
    user_id = getattr(request, 'user_id', None)
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized: Please login first."}), 401

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if not can_access_approval_center(cursor, user_id):
            return jsonify({
                "success": False,
                "message": "Access Denied: Only managers/approvers can access the Approval Center."
            }), 403

        current_month = datetime.now().isoformat()[:7]

        # Query all pending expenses where this user is the active level approver, 
        # and approved/rejected items in this month.
        exp_query = """
            SELECT m.exp_id, m.user_id, m.expense_date, m.total_amount, m.status,
                   m.da_amount, m.hotel_amount, m.other_expense_amount,
                   m.level_first_approver, m.level_second_approver,
                   m.approved_by, m.reject_reason, m.created_at as submitted_at,
                   u.full_name, u.e_code, u.grade, u.district_name,
                   (SELECT GROUP_CONCAT(DISTINCT i.to_district) FROM expense_itinerary i WHERE i.exp_id = m.exp_id) as district
            FROM expense_master m
            JOIN user u ON m.user_id = u.user_id
            WHERE 
                ((m.status = 'Pending L1' OR m.status = 'Pending') AND m.level_first_approver = ?)
                OR
                (m.status = 'Pending L2' AND m.level_second_approver = ?)
                OR
                (strftime('%Y-%m', m.expense_date) = ? AND (m.level_first_approver = ? OR m.level_second_approver = ?))
            ORDER BY m.created_at DESC
        """
        expenses = cursor.execute(exp_query, (user_id, user_id, current_month, user_id, user_id)).fetchall()

        # Query limit requests
        lim_query = """
            SELECT l.id, l.request_type, l.requested_value, l.status, l.created_at, u.full_name, u.e_code
            FROM limit_approval_requests l
            JOIN user u ON l.user_id = u.user_id
            WHERE l.manager_id = ?
              AND (LOWER(l.status) = 'pending' OR strftime('%Y-%m', l.created_at) = ?)
            ORDER BY l.created_at DESC
        """
        limits = cursor.execute(lim_query, (user_id, current_month)).fetchall()

        combined = []

        # Process Expenses
        for e in expenses:
            can_action = False
            status_val = e["status"]
            action_level = derive_action_level(e)

            if status_val in ["Pending L1", "Pending"] and e["level_first_approver"] == user_id:
                can_action = True
                action_level = "L1"
            elif status_val == "Pending L2" and e["level_second_approver"] == user_id:
                can_action = True
                action_level = "L2"

            combined.append({
                "type": "Expense",
                "id": e["exp_id"],
                "full_name": e["full_name"],
                "e_code": e["e_code"],
                "district": e["district"] or "N/A",
                "date": e["expense_date"],
                "amount": float(e["total_amount"]) if e["total_amount"] else 0.0,
                "status": status_val,
                "can_action": can_action,
                "action_level": action_level,
                "submitted_at": e["submitted_at"],
                "sort_date": e["submitted_at"]
            })

        # Process Limits
        for l in limits:
            status_str = l["status"] or "Pending"
            can_action = status_str.lower() == "pending"

            combined.append({
                "type": "Limit",
                "id": f"REQ-{l['id']}",
                "req_type": l["request_type"],
                "full_name": l["full_name"],
                "e_code": l["e_code"],
                "district": "N/A",
                "date": l["created_at"],
                "amount": float(l["requested_value"]) if l["requested_value"] else 0.0,
                "status": status_str.capitalize(),
                "can_action": can_action,
                "action_level": "L1",
                "submitted_at": l["created_at"],
                "sort_date": l["created_at"]
            })

        # Sort combined list by date descending
        combined.sort(key=lambda x: x["sort_date"] or "", reverse=True)

        return jsonify({"success": True, "expenses": combined})
    finally:
        conn.close()

@approval_bp.route("/detail", methods=["GET"])
def get_approval_detail():
    user_id = getattr(request, 'user_id', None)
    target_id = request.args.get("id") or request.args.get("exp_id")
    type_str = request.args.get("type") or "Expense"

    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    if not target_id:
        return jsonify({"success": False, "message": "ID is required."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if type_str == "Limit":
            req_id = target_id.replace("REQ-", "")
            req = cursor.execute("""
                SELECT l.*, u.full_name, u.e_code, u.grade, u.district_name, u.mobile_number
                FROM limit_approval_requests l
                JOIN user u ON l.user_id = u.user_id
                WHERE l.id = ? AND l.manager_id = ?
            """, (req_id, user_id)).fetchone()

            if not req:
                return jsonify({"success": False, "message": "Request not found or access denied."}), 403

            return jsonify({
                "success": True,
                "type": "Limit",
                "request": dict(req),
                "can_action": (req["status"] or "").lower() == "pending" and req["manager_id"] == user_id
            })

        else:
            exp = cursor.execute("""
                SELECT m.*, 
                       m.level_first_approver_time as l1_action_date,
                       m.level_second_approver_time as l2_action_date,
                       u.full_name, u.e_code, u.grade, u.designation, u.district_name, u.mobile_number,
                       (SELECT full_name FROM user WHERE user_id = m.level_first_approver) as l1_name,
                       (SELECT full_name FROM user WHERE user_id = m.level_second_approver) as l2_name
                FROM expense_master m
                JOIN user u ON m.user_id = u.user_id
                WHERE m.exp_id = ?
            """, (target_id,)).fetchone()

            if not exp:
                return jsonify({"success": False, "message": "Expense not found."}), 404

            is_l1 = exp["level_first_approver"] == user_id
            is_l2 = exp["level_second_approver"] == user_id
            l2_cannot_see = is_l2 and exp["status"] in ["Pending L1", "Pending"] and not is_l1

            if (not is_l1 and not is_l2) or l2_cannot_see:
                return jsonify({
                    "success": False, 
                    "message": "Access Denied: You are not assigned to approve this expense at its current stage."
                }), 403

            can_action = False
            user_action_level = None
            if exp["status"] in ["Pending L1", "Pending"] and exp["level_first_approver"] == user_id:
                can_action = True
                user_action_level = "L1"
            elif exp["status"] == "Pending L2" and exp["level_second_approver"] == user_id:
                can_action = True
                user_action_level = "L2"

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
            """, (target_id,)).fetchall()

            itineraries_list = []
            for leg in itineraries:
                attachments = []
                if leg["attachments_raw"]:
                    for raw in leg["attachments_raw"].split("|||"):
                        if not raw:
                            continue
                        parts = raw.split("::")
                        url_val = parts[0]
                        bill_type = parts[1] if len(parts) > 1 else ""
                        proxied_url = f"/api/approval/image?url={url_val}&user_id={user_id}"
                        attachments.append({
                            "bill_type": bill_type,
                            "url": proxied_url,
                            "raw_url": url_val
                        })

                itineraries_list.append({
                    "itinerary_id": leg["itinerary_id"],
                    "exp_id": leg["exp_id"],
                    "leg_number": leg["leg_number"],
                    "from_location": leg["from_location"],
                    "to_location": leg["to_location"],
                    "from_district": leg["from_district"],
                    "to_district": leg["to_district"],
                    "travel_mode": leg["travel_mode"],
                    "distance_km": float(leg["distance_km"]) if leg["distance_km"] else 0.0,
                    "travel_amount": float(leg["travel_amount"]) if leg["travel_amount"] else 0.0,
                    "sub_mode": leg["sub_mode"],
                    "sub_km": float(leg["sub_km"]) if leg["sub_km"] else 0.0,
                    "sub_amount": float(leg["sub_amount"]) if leg["sub_amount"] else 0.0,
                    "da_amount": float(leg["da_amount"]) if leg["da_amount"] else 0.0,
                    "hotel_amount": float(leg["hotel_amount"]) if leg["hotel_amount"] else 0.0,
                    "other_desc": leg["other_desc"],
                    "other_amount": float(leg["other_amount"]) if leg["other_amount"] else 0.0,
                    "visit_purpose": leg["visit_purpose"],
                    "ws_assigned": leg["calls_assigned"] or 0,
                    "ws_closed": leg["calls_completed"] or 0,
                    "ws_pms": leg["pms_count"] or 0,
                    "ws_asset": leg["asset_tagging"] or 0,
                    "travel_type": "Outdoor" if leg["from_district"] != leg["to_district"] else "In-District",
                    "attachments": attachments
                })

            return jsonify({
                "success": True,
                "type": "Expense",
                "expense": {
                    **dict(exp),
                    "action_level": derive_action_level(exp)
                },
                "itineraries": itineraries_list,
                "can_action": can_action,
                "action_level": user_action_level
            })
    finally:
        conn.close()

def process_single_action(cursor, exp_id: str, type_str: str, action: str, reason: str, user_id: str, approver_name: str) -> bool:
    if type_str == "Limit":
        req_id = exp_id.replace("REQ-", "")
        req = cursor.execute("SELECT status FROM limit_approval_requests WHERE id = ? AND manager_id = ?", (req_id, user_id)).fetchone()
        if req and (req["status"] or "").lower() == "pending":
            cursor.execute(
                "UPDATE limit_approval_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (action, req_id)
            )
            return True
        return False
    else:
        exp = cursor.execute("SELECT status, level_first_approver, level_second_approver FROM expense_master WHERE exp_id = ?", (exp_id,)).fetchone()
        if not exp:
            return False

        current_status = exp["status"] or ""
        
        if action == "Rejected":
            final_reason = reason if reason else f"Rejected by {approver_name} on {datetime.now().strftime('%d/%m/%Y')}: No reason provided."
            
            if current_status in ["Pending L1", "Pending"]:
                if exp["level_first_approver"] == user_id:
                    cursor.execute("""
                        UPDATE expense_master 
                        SET status = 'Rejected', reject_reason = ?, approved_by = ?, level_first_approver_time = CURRENT_TIMESTAMP 
                        WHERE exp_id = ?
                    """, (final_reason, user_id, exp_id))
                    return True
            elif current_status == "Pending L2":
                if exp["level_second_approver"] == user_id:
                    cursor.execute("""
                        UPDATE expense_master 
                        SET status = 'Rejected', reject_reason = ?, approved_by = ?, level_second_approver_time = CURRENT_TIMESTAMP 
                        WHERE exp_id = ?
                    """, (final_reason, user_id, exp_id))
                    return True
            return False
        else:
            # Approval
            if current_status in ["Pending L1", "Pending"]:
                if exp["level_first_approver"] == user_id:
                    new_status = "Pending L2" if exp["level_second_approver"] and exp["level_second_approver"] != "None" else "Approved"
                    cursor.execute("""
                        UPDATE expense_master 
                        SET status = ?, approved_by = ?, level_first_approver_time = CURRENT_TIMESTAMP 
                        WHERE exp_id = ?
                    """, (new_status, user_id, exp_id))
                    return True
            elif current_status == "Pending L2":
                if exp["level_second_approver"] == user_id:
                    cursor.execute("""
                        UPDATE expense_master 
                        SET status = 'Approved', approved_by = ?, level_second_approver_time = CURRENT_TIMESTAMP 
                        WHERE exp_id = ?
                    """, (user_id, exp_id))
                    return True
            return False

@approval_bp.route("/action", methods=["POST"])
def take_action():
    body = request.get_json() or {}
    user_id = resolve_logged_in_user_id(request, body)
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    target_id = body.get("id") or body.get("exp_id")
    action = body.get("action")
    type_str = body.get("type", "Expense")
    reason = body.get("reason", "")

    if not target_id or not action:
        return jsonify({"success": False, "message": "Invalid payload."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT full_name, role FROM user WHERE user_id = ?", (user_id,)).fetchone()
        approver_name = f"{user['role']} {user['full_name']}" if user else "Manager"

        success = process_single_action(cursor, target_id, type_str, action, reason, user_id, approver_name)
        if not success:
            return jsonify({"success": False, "message": "Action not permitted or already processed."}), 400
        
        conn.commit()
        return jsonify({"success": True, "message": f"Successfully {action.lower()}."})
    finally:
        conn.close()

@approval_bp.route("/bulk-action", methods=["POST"])
def take_bulk_action():
    body = request.get_json() or {}
    user_id = resolve_logged_in_user_id(request, body)
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    ids = body.get("ids")
    action = body.get("action")
    reason = body.get("reason", "")

    if not ids or not isinstance(ids, list) or not action:
        return jsonify({"success": False, "message": "Invalid payload."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user = cursor.execute("SELECT full_name, role FROM user WHERE user_id = ?", (user_id,)).fetchone()
        approver_name = f"{user['role']} {user['full_name']}" if user else "Manager"

        success_count = 0
        fail_count = 0

        for item_id in ids:
            item_type = "Limit" if str(item_id).startswith("REQ-") else "Expense"
            success = process_single_action(cursor, item_id, item_type, action, reason, user_id, approver_name)
            if success:
                success_count += 1
            else:
                fail_count += 1

        conn.commit()
        return jsonify({
            "success": success_count > 0,
            "message": f"{success_count} items successfully {action.lower()}. {fail_count} failed."
        })
    finally:
        conn.close()

@approval_bp.route("/edit", methods=["POST"])
def edit_expense():
    body = request.get_json() or {}
    user_id = body.get("user_id") or resolve_logged_in_user_id(request, body)
    
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401

    type_str = body.get("type", "Expense")
    exp_id = body.get("exp_id")

    if not exp_id:
        return jsonify({"success": False, "message": "Missing exp_id."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if type_str == "Limit":
            req_id = exp_id.replace("REQ-", "")
            val = body.get("requested_value")
            
            if val is None:
                return jsonify({"success": False, "message": "Invalid amount."}), 400
                
            req = cursor.execute("SELECT * FROM limit_approval_requests WHERE id = ?", (req_id,)).fetchone()
            if not req:
                return jsonify({"success": False, "message": "Limit request not found."}), 404
            if req["manager_id"] != user_id:
                return jsonify({"success": False, "message": "Access Denied."}), 403

            cursor.execute("UPDATE limit_approval_requests SET requested_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (float(val), req_id))
            conn.commit()
            return jsonify({"success": True, "message": "Limit amount updated successfully."})

        # Overwrite Expense details
        exp = cursor.execute("SELECT * FROM expense_master WHERE exp_id = ?", (exp_id,)).fetchone()
        if not exp:
            return jsonify({"success": False, "message": "Expense not found."}), 404

        can_edit = False
        if exp["status"] in ["Pending L1", "Pending"] and exp["level_first_approver"] == user_id:
            can_edit = True
        if exp["status"] == "Pending L2" and exp["level_second_approver"] == user_id:
            can_edit = True

        if not can_edit:
            return jsonify({"success": False, "message": "Access Denied: You cannot edit this expense at its current stage."}), 403

        # Update Master
        cursor.execute("""
            UPDATE expense_master
            SET da_amount = ?, hotel_amount = ?, other_expense_amount = ?, total_amount = ?
            WHERE exp_id = ?
        """, (
            float(body.get("da_amount") or 0.0),
            float(body.get("hotel_amount") or 0.0),
            float(body.get("other_expense_amount") or 0.0),
            float(body.get("total_amount") or 0.0),
            exp_id
        ))

        legs = body.get("legs", [])
        for idx, leg in enumerate(legs):
            leg_number = idx + 1
            leg_id = leg.get("id")
            
            if str(leg_id).startswith("new_"):
                # Insert leg
                new_itinerary_id = f"{exp_id}-{leg_number}"
                cursor.execute("""
                    INSERT INTO expense_itinerary (
                        itinerary_id, exp_id, leg_number,
                        from_location, to_location, from_district, to_district,
                        travel_mode, distance_km, travel_amount, sub_mode, sub_amount, visit_purpose,
                        calls_assigned, calls_completed, pms_count, asset_tagging
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    new_itinerary_id, exp_id, leg_number,
                    leg.get("from_location"), leg.get("to_location"), leg.get("from_district"), leg.get("to_district"),
                    leg.get("travel_mode"), leg.get("distance_km"), leg.get("travel_amount"), leg.get("sub_mode"), leg.get("sub_amount"), leg.get("visit_purpose"),
                    leg.get("ws_assigned"), leg.get("ws_closed"), leg.get("ws_pms"), leg.get("ws_asset")
                ))
            else:
                # Update leg
                cursor.execute("""
                    UPDATE expense_itinerary
                    SET
                        leg_number = ?,
                        from_location = COALESCE(?, from_location),
                        to_location = COALESCE(?, to_location),
                        from_district = COALESCE(?, from_district),
                        to_district = COALESCE(?, to_district),
                        travel_mode = COALESCE(?, travel_mode),
                        distance_km = COALESCE(?, distance_km),
                        travel_amount = COALESCE(?, travel_amount),
                        sub_mode = COALESCE(?, sub_mode),
                        sub_amount = COALESCE(?, sub_amount),
                        visit_purpose = COALESCE(?, visit_purpose),
                        calls_assigned = COALESCE(?, calls_assigned),
                        calls_completed = COALESCE(?, calls_completed),
                        pms_count = COALESCE(?, pms_count),
                        asset_tagging = COALESCE(?, asset_tagging)
                    WHERE itinerary_id = ? AND exp_id = ?
                """, (
                    leg_number,
                    leg.get("from_location"), leg.get("to_location"), leg.get("from_district"), leg.get("to_district"),
                    leg.get("travel_mode"), leg.get("distance_km"), leg.get("travel_amount"), leg.get("sub_mode"), leg.get("sub_amount"), leg.get("visit_purpose"),
                    leg.get("ws_assigned"), leg.get("ws_closed"), leg.get("ws_pms"), leg.get("ws_asset"),
                    leg_id, exp_id
                ))

        conn.commit()
        return jsonify({"success": True, "message": "Expense amounts and details overwritten successfully."})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": "System Error: " + str(e)}), 500
    finally:
        conn.close()
