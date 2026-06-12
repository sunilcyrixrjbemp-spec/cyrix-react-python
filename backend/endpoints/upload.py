# endpoints/upload.py
from flask import Blueprint, request, jsonify
import csv
import io
from db import get_db_connection

upload_bp = Blueprint('upload', __name__)

def find_col(headers, candidates):
    for c in candidates:
        for idx, h in enumerate(headers):
            val = h.replace("  ", " ").strip().lower()
            if val == c or val.replace(" ", "") == c.replace(" ", ""):
                return idx
    return -1

def clean_date(val):
    if not val:
        return None
    v = str(val).strip()
    return None if v in ["", "-", "N/A"] else v

def parse_num(val):
    if not val:
        return 0.0
    try:
        s = str(val).replace(",", "").replace("%", "").strip()
        return float(s)
    except ValueError:
        return 0.0

@upload_bp.route("/asset", methods=["POST"])
def upload_asset():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part in the request."}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "No file selected."}), 400

    try:
        contents = file.read()
        csv_text = contents.decode("utf-8-sig", errors="ignore")
        reader = csv.reader(io.StringIO(csv_text))
        
        rows = list(reader)
        if len(rows) < 2:
            return jsonify({"success": False, "message": "CSV has no data rows."}), 400

        header = [h.strip().lower() for h in rows[0]]
        
        idx_district = find_col(header, ['district name', 'district'])
        idx_hospital = find_col(header, ['hospital name', 'hospital'])
        idx_equipment = find_col(header, ['equipment name', 'equipment'])
        idx_qr_code = find_col(header, ['qr code', 'qrcode', 'qr'])
        idx_asset_val = find_col(header, ['asset value', 'value'])

        missing = []
        if idx_district == -1: missing.append("district name")
        if idx_hospital == -1: missing.append("hospital name")
        if idx_equipment == -1: missing.append("equipment name")
        if idx_qr_code == -1: missing.append("qr code")
        if idx_asset_val == -1: missing.append("asset value")

        if missing:
            return jsonify({"success": False, "message": f"Missing columns: {', '.join(missing)}"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # Fetch existing QRs
            existing = cursor.execute("SELECT qr_code FROM asset_report").fetchall()
            existing_qrs = {r["qr_code"] for r in existing}

            inserted = 0
            updated = 0
            success_log = []
            fail_log = []

            upsert_data = []

            for i, row in enumerate(rows[1:]):
                row_num = i + 2
                if not row or len(row) < 2:
                    continue

                qr = row[idx_qr_code].strip()
                if not qr or qr.startswith("--"):
                    fail_log.append({"row": row_num, "id": qr or "(empty)", "reason": "Skipped — empty or starts with --"})
                    continue

                district = row[idx_district].strip()
                hospital = row[idx_hospital].strip()
                equipment = row[idx_equipment].strip()
                asset_val = parse_num(row[idx_asset_val])

                is_new = qr not in existing_qrs
                
                upsert_data.append((district, hospital, equipment, qr, asset_val))
                
                if is_new:
                    inserted += 1
                    success_log.append({"row": row_num, "id": qr, "status": "Inserted"})
                else:
                    updated += 1
                    success_log.append({"row": row_num, "id": qr, "status": "Updated"})

            # SQLite batch execution
            cursor.executemany("""
                INSERT INTO asset_report (district_name, hospital_name, equipment_name, qr_code, asset_value)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(qr_code) DO UPDATE SET
                    district_name = excluded.district_name,
                    hospital_name = excluded.hospital_name,
                    equipment_name = excluded.equipment_name,
                    asset_value = excluded.asset_value,
                    updated_at = datetime('now')
            """, upsert_data)
            conn.commit()

            return jsonify({
                "success": True,
                "inserted": inserted,
                "updated": updated,
                "skipped": len(fail_log),
                "errors": 0,
                "successLog": success_log,
                "failLog": fail_log
            })
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500

@upload_bp.route("/penalty", methods=["POST"])
def upload_penalty():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part in the request."}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "No file selected."}), 400

    try:
        contents = file.read()
        csv_text = contents.decode("utf-8-sig", errors="ignore")
        reader = csv.reader(io.StringIO(csv_text))
        
        rows = list(reader)
        if len(rows) < 2:
            return jsonify({"success": False, "message": "CSV has no data rows."}), 400

        header = [h.strip().lower() for h in rows[0]]
        
        idx_district = find_col(header, ['district name', 'district'])
        idx_hospital_type = find_col(header, ['hospital type'])
        idx_hospital = find_col(header, ['hospital name', 'hospital'])
        idx_bar_code = find_col(header, ['bar code', 'barcode'])
        idx_equipment = find_col(header, ['equipment name', 'equipment'])
        idx_complaint_id = find_col(header, ['complaint id', 'complaint_id'])
        idx_raise_date = find_col(header, ['complaint raise date', 'raise date'])
        idx_close_date = find_col(header, ['complaint close date', 'close date'])
        idx_status = find_col(header, ['complaint status', 'status'])
        idx_attend_date = find_col(header, ['attend date'])
        idx_attend_penalty = find_col(header, ['attend penalty'])
        idx_penalty = find_col(header, ['penalty'])
        idx_total_penalty = find_col(header, ['total penalty'])
        idx_attend_eng_id = find_col(header, ['attend engineer id', 'attend engineer'])
        idx_close_eng_id = find_col(header, ['close engineer id', 'close engineer'])
        idx_open_month = find_col(header, ['open month'])
        idx_close_month = find_col(header, ['close month'])

        missing = []
        if idx_district == -1: missing.append("district name")
        if idx_hospital == -1: missing.append("hospital name")
        if idx_complaint_id == -1: missing.append("complaint id")
        if missing:
            return jsonify({"success": False, "message": f"Missing columns: {', '.join(missing)}"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # Fetch existing IDs
            existing = cursor.execute("SELECT complaint_id FROM penalty_report").fetchall()
            existing_ids = {r["complaint_id"] for r in existing}

            inserted = 0
            updated = 0
            success_log = []
            fail_log = []

            upsert_data = []

            for i, row in enumerate(rows[1:]):
                row_num = i + 2
                if not row or len(row) < 2:
                    continue

                cid = row[idx_complaint_id].strip()
                if not cid or cid.startswith("--"):
                    fail_log.append({"row": row_num, "id": cid or "(empty)", "reason": "Skipped — empty or starts with --"})
                    continue

                district = row[idx_district].strip()
                h_type = row[idx_hospital_type].strip() if idx_hospital_type != -1 else None
                h_name = row[idx_hospital].strip()
                b_code = row[idx_bar_code].strip() if idx_bar_code != -1 else None
                equip = row[idx_equipment].strip() if idx_equipment != -1 else None
                raise_d = clean_date(row[idx_raise_date]) if idx_raise_date != -1 else None
                close_d = clean_date(row[idx_close_date]) if idx_close_date != -1 else None
                status_val = row[idx_status].strip() if idx_status != -1 else None
                attend_d = clean_date(row[idx_attend_date]) if idx_attend_date != -1 else None
                
                attend_pen = parse_num(row[idx_attend_penalty]) if idx_attend_penalty != -1 else 0.0
                pen = parse_num(row[idx_penalty]) if idx_penalty != -1 else 0.0
                tot_pen = parse_num(row[idx_total_penalty]) if idx_total_penalty != -1 else 0.0
                
                attend_eng = row[idx_attend_eng_id].strip() if idx_attend_eng_id != -1 else None
                close_eng = row[idx_close_eng_id].strip() if idx_close_eng_id != -1 else None
                open_m = row[idx_open_month].strip() if idx_open_month != -1 else None
                close_m = row[idx_close_month].strip() if idx_close_month != -1 else None

                is_new = cid not in existing_ids

                upsert_data.append((
                    district, h_type, h_name, b_code, equip, cid, raise_d, close_d, status_val,
                    attend_d, attend_pen, pen, tot_pen, attend_eng, close_eng, open_m, close_m
                ))

                if is_new:
                    inserted += 1
                    success_log.append({"row": row_num, "id": cid, "status": "Inserted"})
                else:
                    updated += 1
                    success_log.append({"row": row_num, "id": cid, "status": "Updated"})

            cursor.executemany("""
                INSERT INTO penalty_report (
                    district_name, hospital_type, hospital_name, bar_code,
                    equipment_name, complaint_id, complaint_raise_date,
                    complaint_close_date, complaint_status, attend_date,
                    attend_penalty, penalty, total_penalty,
                    attend_engineer_id, close_engineer_id, open_month, close_month
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(complaint_id) DO UPDATE SET
                    complaint_close_date = excluded.complaint_close_date,
                    complaint_status = excluded.complaint_status,
                    attend_date = excluded.attend_date,
                    attend_penalty = excluded.attend_penalty,
                    penalty = excluded.penalty,
                    total_penalty = excluded.total_penalty,
                    attend_engineer_id = excluded.attend_engineer_id,
                    close_engineer_id = excluded.close_engineer_id,
                    open_month = excluded.open_month,
                    close_month = excluded.close_month,
                    updated_at = datetime('now')
            """, upsert_data)
            conn.commit()

            return jsonify({
                "success": True,
                "inserted": inserted,
                "updated": updated,
                "skipped": len(fail_log),
                "errors": 0,
                "successLog": success_log,
                "failLog": fail_log
            })
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500

@upload_bp.route("/revenue", methods=["POST"])
def upload_revenue():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part in the request."}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "No file selected."}), 400

    try:
        contents = file.read()
        csv_text = contents.decode("utf-8-sig", errors="ignore")
        reader = csv.reader(io.StringIO(csv_text))
        
        rows = list(reader)
        if len(rows) < 2:
            return jsonify({"success": False, "message": "CSV has no data rows."}), 400

        header = [h.strip().lower() for h in rows[0]]

        idx_district = find_col(header, ['district name', 'district'])
        idx_dm_name = find_col(header, ['dm name', 'dm'])
        idx_facility_type = find_col(header, ['facility type', 'facility'])
        idx_di_name = find_col(header, ['di name', 'di'])
        idx_billing_amount = find_col(header, ['billing amount', 'billing'])
        idx_open_penalty_feb = find_col(header, ['open penalty feb', 'open penalty'])
        idx_purchase = find_col(header, ['purchase (spare + service)', 'purchase'])
        idx_camc = find_col(header, ['camc'])
        idx_total_ppc = find_col(header, ['total(penalty+purchase+camc)', 'total'])
        idx_rm_achieved = find_col(header, ['r/m achieved %', 'r/m achieved', 'rm achieved'])
        idx_rm_target = find_col(header, ['r & m traget', 'r & m target', 'rm target'])
        idx_eligibility_month = find_col(header, ['eligibility month', 'eligibility'])

        missing = []
        if idx_district == -1: missing.append("district name")
        if idx_di_name == -1: missing.append("di name")
        if idx_eligibility_month == -1: missing.append("eligibility month")
        if missing:
            return jsonify({"success": False, "message": f"Missing columns: {', '.join(missing)}"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # Fetch existing keys (di_name, eligibility_month)
            existing = cursor.execute("SELECT di_name, eligibility_month FROM revenue_report").fetchall()
            existing_keys = {f"{r['di_name']}||{r['eligibility_month']}" for r in existing}

            inserted = 0
            updated = 0
            success_log = []
            fail_log = []

            seen_in_batch = set()
            upsert_data = []

            for i, row in enumerate(rows[1:]):
                row_num = i + 2
                if not row or len(row) < 2:
                    continue

                month = row[idx_eligibility_month].strip()
                di_name = row[idx_di_name].strip()
                district = row[idx_district].strip()

                if not month or month.startswith("--"):
                    fail_log.append({"row": row_num, "id": month or "(empty)", "reason": "Skipped — empty or starts with --"})
                    continue

                composite_key = f"{di_name}||{month}"
                if composite_key in seen_in_batch:
                    fail_log.append({"row": row_num, "id": composite_key, "reason": f"Duplicate in CSV — DI: {di_name} / {month} already in this file"})
                    continue

                seen_in_batch.add(composite_key)

                dm_name = row[idx_dm_name].strip() if idx_dm_name != -1 else None
                fac_type = row[idx_facility_type].strip() if idx_facility_type != -1 else None
                billing = parse_num(row[idx_billing_amount]) if idx_billing_amount != -1 else 0.0
                open_pen = parse_num(row[idx_open_penalty_feb]) if idx_open_penalty_feb != -1 else 0.0
                purchase = parse_num(row[idx_purchase]) if idx_purchase != -1 else 0.0
                camc = parse_num(row[idx_camc]) if idx_camc != -1 else 0.0
                total_ppc = parse_num(row[idx_total_ppc]) if idx_total_ppc != -1 else 0.0
                rm_ach = parse_num(row[idx_rm_achieved]) if idx_rm_achieved != -1 else 0.0
                rm_tgt = parse_num(row[idx_rm_target]) if idx_rm_target != -1 else 0.0

                is_new = composite_key not in existing_keys

                upsert_data.append((
                    district, dm_name, fac_type, di_name, billing, open_pen, purchase, camc, total_ppc, rm_ach, rm_tgt, month
                ))

                if is_new:
                    inserted += 1
                    success_log.append({"row": row_num, "id": composite_key, "status": "Inserted"})
                else:
                    updated += 1
                    success_log.append({"row": row_num, "id": composite_key, "status": "Updated"})

            cursor.executemany("""
                INSERT INTO revenue_report (
                    district_name, dm_name, facility_type, di_name,
                    billing_amount, open_penalty_feb, purchase_spare_service,
                    camc, total_penalty_purchase_camc, rm_achieved_pct,
                    rm_target, eligibility_month
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(di_name, eligibility_month) DO UPDATE SET
                    district_name = excluded.district_name,
                    dm_name = excluded.dm_name,
                    facility_type = excluded.facility_type,
                    billing_amount = excluded.billing_amount,
                    open_penalty_feb = excluded.open_penalty_feb,
                    purchase_spare_service = excluded.purchase_spare_service,
                    camc = excluded.camc,
                    total_penalty_purchase_camc = excluded.total_penalty_purchase_camc,
                    rm_achieved_pct = excluded.rm_achieved_pct,
                    rm_target = excluded.rm_target,
                    updated_at = datetime('now')
            """, upsert_data)
            conn.commit()

            return jsonify({
                "success": True,
                "inserted": inserted,
                "updated": updated,
                "skipped": len(fail_log),
                "errors": 0,
                "successLog": success_log,
                "failLog": fail_log
            })
        finally:
            conn.close()
    except Exception as e:
        return jsonify({"success": False, "message": f"An error occurred: {str(e)}"}), 500
