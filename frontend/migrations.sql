-- migrations.sql

-- Add columns to user table (ignore if they fail due to duplicate column name)
ALTER TABLE user ADD COLUMN session_version INTEGER DEFAULT 1;
ALTER TABLE user ADD COLUMN is_temp_password INTEGER DEFAULT 0;

-- Add columns to expense_master
ALTER TABLE expense_master ADD COLUMN original_amount DECIMAL(10,2);
ALTER TABLE expense_master ADD COLUMN is_edited INTEGER DEFAULT 0;
ALTER TABLE expense_master ADD COLUMN manager_edit_remark TEXT;
ALTER TABLE expense_master ADD COLUMN original_details TEXT;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create profile_update_requests table
CREATE TABLE IF NOT EXISTS profile_update_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    new_data TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_action_logs table
CREATE TABLE IF NOT EXISTS user_action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    full_name TEXT,
    action TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    error_message TEXT,
    stack_trace TEXT,
    path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create help_concerns table
CREATE TABLE IF NOT EXISTS help_concerns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    exp_id TEXT,
    message TEXT NOT NULL,
    reply TEXT,
    replied_by TEXT,
    status TEXT DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
