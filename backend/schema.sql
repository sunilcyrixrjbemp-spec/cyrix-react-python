-- schema.sql
CREATE TABLE IF NOT EXISTS "Role" ("Role" TEXT);

CREATE TABLE IF NOT EXISTS "Facily Details" (
    facility_name VARCHAR(71) NOT NULL PRIMARY KEY,
    district_name VARCHAR(11) NOT NULL,
    facility_incharge VARCHAR(20) NOT NULL,
    dm_name VARCHAR(14) NOT NULL,
    coordinator_name VARCHAR(13) NOT NULL,
    facility_type VARCHAR(6) NOT NULL,
    zone_name VARCHAR(7) NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
    user_id TEXT PRIMARY KEY,
    e_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    date_joining DATE,
    designation TEXT,
    mobile_number TEXT UNIQUE,
    mail_id TEXT UNIQUE,
    e_upkaran_id TEXT,
    zone_name TEXT,
    district_name TEXT,
    password TEXT NOT NULL,
    account_status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    grade TEXT,
    role TEXT,
    failed_attempts TEXT,
    level_first_approver TEXT,
    level_second_approver TEXT,
    monthly_level_first TEXT,
    monthly_level_second TEXT,
    password_salt TEXT
);

CREATE TABLE IF NOT EXISTS allowance_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT,
    grade TEXT,
    category TEXT,
    hotel_in_state_s INTEGER,
    hotel_in_state_d INTEGER,
    hotel_out_state_s INTEGER,
    hotel_out_state_d INTEGER,
    daily_in_district INTEGER,
    daily_out_district INTEGER,
    daily_hotel INTEGER,
    daily_out_state INTEGER,
    vehicle_type TEXT,
    rate_per_km REAL,
    max_km_per_month INTEGER
);

CREATE TABLE IF NOT EXISTS otp_verifications (
    user_id TEXT PRIMARY KEY,
    otp TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INTEGER DEFAULT 1,
    sender_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    allowed_menus TEXT DEFAULT "Home"
);

CREATE TABLE IF NOT EXISTS expense_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exp_id VARCHAR(50),
    itinerary_id VARCHAR(50) NULL,
    bill_type VARCHAR(50),
    file_url TEXT
);

CREATE TABLE IF NOT EXISTS expense_master (
    exp_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    expense_date DATE,
    working_district VARCHAR(100),
    da_amount DECIMAL(10,2),
    hotel_amount DECIMAL(10,2),
    local_purchase_desc TEXT,
    local_purchase_amount DECIMAL(10,2),
    other_expense_desc TEXT,
    other_expense_amount DECIMAL(10,2),
    visit_purpose TEXT,
    calls_assigned INT,
    calls_completed INT,
    pms_count INT,
    asset_tagging INT,
    total_amount DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'Pending Level 1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level_first_approver VARCHAR(50),
    level_second_approver VARCHAR(50),
    reject_reason TEXT,
    approved_by TEXT,
    level_first_approver_time TEXT,
    level_second_approver_time TEXT
);

CREATE TABLE IF NOT EXISTS expense_itinerary (
    itinerary_id VARCHAR(50) PRIMARY KEY,
    exp_id VARCHAR(50),
    leg_number INT,
    from_location VARCHAR(200),
    to_location VARCHAR(200),
    travel_mode VARCHAR(50),
    distance_km DECIMAL(10,2),
    travel_amount DECIMAL(10,2),
    working_district VARCHAR(100),
    da_amount DECIMAL(10,2),
    hotel_amount DECIMAL(10,2),
    other_desc TEXT,
    other_amount DECIMAL(10,2),
    calls_assigned INT,
    calls_completed INT,
    pms_count INT,
    asset_tagging INT,
    sub_mode VARCHAR(50),
    sub_km DECIMAL(10,2),
    sub_amount DECIMAL(10,2),
    to_district VARCHAR(100),
    from_district VARCHAR(100),
    expense_itinerary TEXT,
    visit_purpose TEXT
);

CREATE TABLE IF NOT EXISTS asset_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_name TEXT NOT NULL,
    hospital_name TEXT NOT NULL,
    equipment_name TEXT NOT NULL,
    qr_code TEXT NOT NULL UNIQUE,
    asset_value REAL DEFAULT 0,
    uploaded_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS penalty_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_name TEXT NOT NULL,
    hospital_type TEXT,
    hospital_name TEXT NOT NULL,
    bar_code TEXT,
    equipment_name TEXT,
    complaint_id TEXT NOT NULL UNIQUE,
    complaint_raise_date TEXT,
    complaint_close_date TEXT,
    complaint_status TEXT,
    attend_date TEXT,
    attend_penalty REAL DEFAULT 0,
    penalty REAL DEFAULT 0,
    total_penalty REAL DEFAULT 0,
    attend_engineer_id TEXT,
    close_engineer_id TEXT,
    open_month TEXT,
    close_month TEXT,
    uploaded_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upload_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type TEXT NOT NULL CHECK(report_type IN ('asset','penalty','revenue')),
    filename TEXT,
    total_rows INTEGER DEFAULT 0,
    inserted INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    uploaded_by TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS revenue_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_name TEXT NOT NULL,
    dm_name TEXT,
    facility_type TEXT,
    di_name TEXT NOT NULL,
    billing_amount REAL DEFAULT 0,
    open_penalty_feb REAL DEFAULT 0,
    purchase_spare_service REAL DEFAULT 0,
    camc REAL DEFAULT 0,
    total_penalty_purchase_camc REAL DEFAULT 0,
    rm_achieved_pct REAL DEFAULT 0,
    rm_target REAL DEFAULT 0,
    eligibility_month TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(di_name, eligibility_month)
);

CREATE TABLE IF NOT EXISTS limit_approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    manager_id TEXT NOT NULL,
    request_type TEXT NOT NULL,
    requested_value REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    for_month TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(user_id),
    FOREIGN KEY (manager_id) REFERENCES user(user_id)
);
