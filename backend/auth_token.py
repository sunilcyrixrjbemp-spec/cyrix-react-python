# auth_token.py
import hmac
import hashlib
import base64
import json
import time

SECRET_KEY = "cyrix_super_secret_key_change_in_prod"

def generate_token(user_id: str, role: str, allowed_menus: str, exp_hours: float = 24.0, action: str = "session") -> str:
    """Generates a secure URL-safe HMAC-signed token representing session or reset action."""
    payload = {
        "user_id": user_id,
        "role": role,
        "allowed_menus": allowed_menus,
        "action": action,
        "exp": time.time() + (exp_hours * 3600.0)
    }
    payload_str = base64.urlsafe_b64encode(json.dumps(payload).encode('utf-8')).decode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).digest()
    sig_str = base64.urlsafe_b64encode(signature).decode('utf-8')
    return f"{payload_str}.{sig_str}"

def verify_token(token: str) -> dict | None:
    """Verifies the token signature, structural validity, and expiration."""
    if not token:
        return None
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_str, sig_str = parts[0], parts[1]
        
        # Verify HMAC signature
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), payload_str.encode('utf-8'), hashlib.sha256).digest()
        expected_sig_str = base64.urlsafe_b64encode(expected_sig).decode('utf-8')
        if not hmac.compare_digest(sig_str, expected_sig_str):
            return None
            
        payload = json.loads(base64.urlsafe_b64decode(payload_str.encode('utf-8')).decode('utf-8'))
        
        # Check expiry
        if time.time() > payload.get("exp", 0):
            return None
            
        return payload
    except Exception:
        return None
