# seed.py
import json
import urllib.request
import sqlite3
import os
from db import get_db_connection, init_db

# Cloudflare Configuration
CF_EMAIL = os.environ.get("CF_EMAIL", "")
CF_KEY = os.environ.get("CF_KEY", "")
ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "")
DB_ID = os.environ.get("CF_DB_ID", "")

HEADERS = {
    "X-Auth-Email": CF_EMAIL,
    "X-Auth-Key": CF_KEY,
    "Content-Type": "application/json"
}

def run_d1_query(sql):
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/query"
    data = json.dumps({"sql": sql}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            resp = json.loads(res.read().decode("utf-8"))
            if resp.get("success"):
                return resp["result"][0]["results"]
            else:
                raise Exception(f"Query failed: {resp}")
    except Exception as e:
        print(f"Error fetching from D1: {e}")
        return None

def clean_val(val):
    if val is None:
        return None
    return val

def seed_from_d1():
    print("Attempting to clone data from Cloudflare D1...")
    tables = [
        'Role',
        'Facily Details',
        'user',
        'allowance_master',
        'user_permissions',
        'expense_master',
        'expense_itinerary',
        'expense_attachments',
        'revenue_report',
        'limit_approval_requests',
        'asset_report',
        'penalty_report',
        'upload_log'
    ]
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cloned_successfully = False
    
    for table in tables:
        print(f"Fetching data for '{table}'...")
        rows = run_d1_query(f"SELECT * FROM `{table}`")
        if rows is None:
            print(f"Skipping '{table}' D1 fetch (credentials incorrect or network offline).")
            continue
            
        cloned_successfully = True
        if not rows:
            print(f"Table '{table}' has 0 rows.")
            continue
            
        # Clean current table data first
        cursor.execute(f"DELETE FROM `{table}`")
        
        # Build dynamic insert statement
        columns = list(rows[0].keys())
        col_str = ", ".join([f"`{c}`" for c in columns])
        val_placeholders = ", ".join(["?" for _ in columns])
        insert_sql = f"INSERT INTO `{table}` ({col_str}) VALUES ({val_placeholders})"
        
        insert_data = []
        for r in rows:
            insert_data.append(tuple(clean_val(r[c]) for c in columns))
            
        cursor.executemany(insert_sql, insert_data)
        conn.commit()
        print(f"Cloned {len(rows)} rows into local `{table}` table.")
        
    conn.close()
    return cloned_successfully

def seed_defaults():
    print("Seeding default/mock reference data locally...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Seed Roles
    roles = [("Admin",), ("Superadmin",), ("Manager",), ("Coordinator",), ("Engineer",), ("Travel Desk",), ("Accounts",), ("Divisional Manager",)]
    cursor.execute("DELETE FROM Role")
    cursor.executemany("INSERT INTO Role (Role) VALUES (?)", roles)
    print("Seeded default roles.")
    
    # 2. Seed Allowance Master
    allowance_data = [
        ("Level 1", "Grade A", "Category 1", 2000, 2500, 3000, 3500, 400, 600, 500, 800, "Car", 9.0, 3000),
        ("Level 2", "Grade B", "Category 1", 1500, 2000, 2500, 3000, 300, 450, 400, 600, "Bike", 4.5, 2000),
        ("Level 3", "Grade C", "Category 2", 1200, 1500, 2000, 2500, 250, 400, 350, 600, "Bike", 4.5, 2000),
        ("Level 4", "Grade D", "Category 2", 1000, 1200, 1500, 2000, 250, 400, 350, 600, "Bike", 4.5, 2000),
        ("Level 5", "Grade E", "Category 2", 800, 1000, 1200, 1500, 250, 400, 350, 600, "Bike", 4.5, 2000)
    ]
    cursor.execute("DELETE FROM allowance_master")
    cursor.executemany("""
        INSERT INTO allowance_master (
            level, grade, category, hotel_in_state_s, hotel_in_state_d, 
            hotel_out_state_s, hotel_out_state_d, daily_in_district, 
            daily_out_district, daily_hotel, daily_out_state, vehicle_type, 
            rate_per_km, max_km_per_month
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, allowance_data)
    print("Seeded allowance tiers.")
    
    # 3. Seed Users
    # RJ001 - Admin (plain text password: "admin", legacy support password: "admin")
    # RJ002 - Manager (approver for RJ003)
    # RJ003 - Engineer (grade: Grade C)
    users = [
        ("RJ001", "E001", "Admin User", "1990-01-01", "2020-01-01", "System Administrator", "9999999991", "admin@cyrix.com", "UP001", "Zone A", "Jaipur", "admin", "active", "Grade A", "Admin", "0", None, None, None, None, None),
        ("RJ002", "E002", "Manager User", "1985-05-15", "2018-06-01", "Regional Manager", "9999999992", "manager@cyrix.com", "UP002", "Zone A", "Jaipur", "123456", "active", "Grade B", "Manager", "0", None, None, None, None, None),
        ("RJ003", "E003", "Engineer User", "1995-10-10", "2022-03-01", "Field Service Engineer", "9999999993", "engineer@cyrix.com", "UP003", "Zone A", "Jaipur", "123456", "active", "Grade C", "Engineer", "0", "RJ002", "RJ001", "RJ002", "RJ001", None),
    ]
    cursor.execute("DELETE FROM user")
    cursor.executemany("""
        INSERT INTO user (
            user_id, e_code, full_name, date_of_birth, date_joining, designation, 
            mobile_number, mail_id, e_upkaran_id, zone_name, district_name, password, 
            account_status, grade, role, failed_attempts, level_first_approver, 
            level_second_approver, monthly_level_first, monthly_level_second, password_salt
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, users)
    print("Seeded local test users (RJ001 - Admin, RJ002 - Manager, RJ003 - Engineer).")

    # 4. Seed User Permissions
    permissions = [
        ("RJ001", "Admin User", "Home,Admin,Profile,Dashboard,Upload,Month"),
        ("RJ002", "Manager User", "Home,Approval,Profile,Month"),
        ("RJ003", "Engineer User", "Home,Expense,Profile,Month"),
    ]
    cursor.execute("DELETE FROM user_permissions")
    cursor.executemany("INSERT INTO user_permissions (user_id, full_name, allowed_menus) VALUES (?, ?, ?)", permissions)
    print("Seeded user page access permissions.")
    
    # 5. Seed Facility Details
    facilities = [
        ("CH Jaipur", "Jaipur", "Manager User", "Manager User", "Manager User", "CH", "Zone A"),
        ("DH Jaipur", "Jaipur", "Manager User", "Manager User", "Manager User", "DH", "Zone A"),
        ("PHC Jaipur", "Jaipur", "Manager User", "Manager User", "Manager User", "PHC", "Zone A"),
    ]
    cursor.execute('DELETE FROM "Facily Details"')
    cursor.executemany('INSERT INTO "Facily Details" (facility_name, district_name, facility_incharge, dm_name, coordinator_name, facility_type, zone_name) VALUES (?,?,?,?,?,?,?)', facilities)
    print("Seeded mock facilities details.")
    
    conn.commit()
    conn.close()

def main():
    init_db()
    success = seed_from_d1()
    if not success:
        print("Falling back to local default seeding...")
        seed_defaults()
    print("Database seeding completed.")

if __name__ == "__main__":
    main()
