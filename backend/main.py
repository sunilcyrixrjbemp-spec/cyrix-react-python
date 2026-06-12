# backend/main.py
from flask import Flask, request, jsonify, send_from_directory
import os

app = Flask(__name__)

# Ensure the uploads directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Register CORS headers globally
@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, x-user-id, x-userid"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, x-user-id, x-userid"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

from auth_token import verify_token

@app.before_request
def api_gateway_auth():
    # Bypass for preflight OPTIONS requests
    if request.method == "OPTIONS":
        return None
        
    path = request.path
    
    # Public endpoints
    public_paths = [
        "/",
        "/api/login",
        "/api/forgot",
        "/api/unlock",
        "/api/retrive",
        "/api/reset-password"
    ]
    if path in public_paths or path.startswith("/uploads/"):
        return None
        
    # Check token in cookies or Authorization header
    token = request.cookies.get("auth_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
            
    if not token:
        return jsonify({"success": False, "message": "Authentication required. Please log in."}), 401
        
    payload = verify_token(token)
    if not payload or payload.get("action") != "session":
        return jsonify({"success": False, "message": "Session expired or invalid. Please log in again."}), 401
        
    # Inject user details into request context
    request.user_id = payload["user_id"]
    request.user_role = payload["role"]
    request.allowed_menus = payload["allowed_menus"]
    
    # Route level authorization (RBAC and menu-based ACL)
    allowed_list = [m.strip().lower() for m in request.allowed_menus.split(",")]
    
    # 1. Admin paths check
    if path.startswith("/api/admin"):
        if request.user_role not in ["Admin", "Superadmin"]:
            return jsonify({"success": False, "message": "Access denied. Admin role required."}), 403
        if "admin" not in allowed_list:
            return jsonify({"success": False, "message": "Access denied. Admin Panel permission required."}), 403
            
    # 2. Approval paths check
    if path.startswith("/api/approval"):
        if "approval" not in allowed_list:
            return jsonify({"success": False, "message": "Access denied. Approval Center permission required."}), 403
            
    # 3. Upload paths check
    if path.startswith("/api/upload"):
        if "upload" not in allowed_list:
            return jsonify({"success": False, "message": "Access denied. Data Sync permission required."}), 403

    # 4. Month paths check
    if path.startswith("/api/month"):
        if "month" not in allowed_list:
            return jsonify({"success": False, "message": "Access denied. Month Summary permission required."}), 403

    # 5. Dashboard/Analytics paths check
    if path.startswith("/api/dashboard"):
        if "report" not in allowed_list:
            return jsonify({"success": False, "message": "Access denied. Analytics Reports permission required."}), 403

# Serve static uploads
@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)

# Root route
@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "success": True,
        "message": "Cyrix Healthcare Clone API Server is running."
    })

# Import and Register Blueprints
from endpoints.auth import auth_bp
from endpoints.admin import admin_bp
from endpoints.profile import profile_bp
from endpoints.expense import expense_bp
from endpoints.approval import approval_bp
from endpoints.month import month_bp
from endpoints.dashboard import dashboard_bp
from endpoints.upload import upload_bp
from endpoints.home import home_bp

app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api/admin')
app.register_blueprint(profile_bp, url_prefix='/api')
app.register_blueprint(expense_bp, url_prefix='/api/expense')
app.register_blueprint(approval_bp, url_prefix='/api/approval')
app.register_blueprint(month_bp, url_prefix='/api/month')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(upload_bp, url_prefix='/api/upload')
app.register_blueprint(home_bp, url_prefix='/api/home')

if __name__ == "__main__":
    # Run server on port 8000
    app.run(host="0.0.0.0", port=8000, debug=True)
