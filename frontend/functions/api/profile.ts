interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// PBKDF2 secure password hashing utility
async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw', 
    encoder.encode(password), 
    { name: 'PBKDF2' }, 
    false, 
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );

  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)));
}

function generateSalt() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    /* ── POST /api/profile/change-password ── */
    if (path === "/api/profile/change-password" && method === "POST") {
      const data: any = await request.json();
      const { user_id, old_password, new_password } = data;

      if (!user_id || !old_password || !new_password) {
        return new Response(JSON.stringify({ success: false, message: "Missing required password fields." }), { status: 400, headers });
      }

      // Check password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(new_password)) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: "New password must be at least 8 characters long, containing uppercase, lowercase, digit, and special character." 
        }), { status: 400, headers });
      }

      const user: any = await env.DB.prepare(
        "SELECT password, password_salt FROM user WHERE user_id = ?"
      ).bind(user_id).first();

      if (!user) {
        return new Response(JSON.stringify({ success: false, message: "User not found." }), { status: 404, headers });
      }

      // Verify old password
      let isOldValid = (old_password === user.password);
      if (!isOldValid && user.password_salt) {
        const hashedOld = await hashPassword(old_password, user.password_salt);
        isOldValid = (hashedOld === user.password);
      }

      if (!isOldValid) {
        return new Response(JSON.stringify({ success: false, message: "Incorrect current password." }), { status: 400, headers });
      }

      // Hash and update new password
      const newSalt = generateSalt();
      const newHashed = await hashPassword(new_password, newSalt);

      await env.DB.prepare(
        "UPDATE user SET password = ?, password_salt = ?, is_temp_password = 0 WHERE user_id = ?"
      ).bind(newHashed, newSalt, user_id).run();

      return new Response(JSON.stringify({ success: true, message: "Password updated successfully!" }), { status: 200, headers });
    }

    /* ── GET /api/profile/update-request-check ── */
    if (path === "/api/profile/update-request-check" && method === "GET") {
      const userId = url.searchParams.get("user_id");
      if (!userId) {
        return new Response(JSON.stringify({ success: false, message: "User ID is required." }), { status: 400, headers });
      }

      const latestReq: any = await env.DB.prepare(
        "SELECT created_at, status FROM profile_update_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1"
      ).bind(userId).first();

      if (latestReq) {
        if (latestReq.status === "Pending") {
          return new Response(JSON.stringify({ 
            allowed: false, 
            message: "You already have a profile update request pending review." 
          }), { status: 200, headers });
        }

        const diffTime = Math.abs(Date.now() - new Date(latestReq.created_at).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 14) {
          return new Response(JSON.stringify({ 
            allowed: false, 
            message: `You can only submit a profile update request once every 14 days. Please wait ${14 - diffDays} more days.` 
          }), { status: 200, headers });
        }
      }

      return new Response(JSON.stringify({ allowed: true }), { status: 200, headers });
    }

    /* ── POST /api/profile/update-request ── */
    if (path === "/api/profile/update-request" && method === "POST") {
      const data: any = await request.json();
      const { user_id, new_data } = data;

      if (!user_id || !new_data) {
        return new Response(JSON.stringify({ success: false, message: "Missing request data." }), { status: 400, headers });
      }

      // Run check again to prevent bypasses
      const latestReq: any = await env.DB.prepare(
        "SELECT created_at, status FROM profile_update_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1"
      ).bind(user_id).first();

      if (latestReq) {
        if (latestReq.status === "Pending") {
          return new Response(JSON.stringify({ success: false, message: "You already have a pending request." }), { status: 400, headers });
        }
        const diffTime = Math.abs(Date.now() - new Date(latestReq.created_at).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 14) {
          return new Response(JSON.stringify({ success: false, message: "Constraint lock active. Resubmission allowed once every 14 days." }), { status: 400, headers });
        }
      }

      await env.DB.prepare(
        "INSERT INTO profile_update_requests (user_id, new_data, status, created_at, updated_at) VALUES (?, ?, 'Pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).bind(user_id, JSON.stringify(new_data)).run();

      return new Response(JSON.stringify({ success: true, message: "Profile update request submitted to admin for approval." }), { status: 200, headers });
    }

    /* ── DEFAULT GET /api/profile ── */
    if (method === "GET") {
      const pathParts = url.pathname.split('/');
      const pathUserId = pathParts[pathParts.length - 1];
      const userId = url.searchParams.get("user_id") || (pathUserId !== "profile" && pathUserId !== "team" ? pathUserId : null);

      if (!userId) {
        return new Response(JSON.stringify({ success: false, message: "User ID is required" }), { status: 400, headers });
      }

      const userProfile = await env.DB.prepare(
        `SELECT 
          u.user_id, u.e_code, u.full_name, u.date_of_birth, u.date_joining, 
          u.designation, u.mobile_number, u.mail_id, u.zone_name, u.district_name, 
          u.account_status, u.grade, u.role, p.allowed_menus,
          COALESCE((SELECT full_name FROM user l1 WHERE l1.user_id = u.level_first_approver), u.level_first_approver) as level_first_approver, 
          COALESCE((SELECT full_name FROM user l2 WHERE l2.user_id = u.level_second_approver), u.level_second_approver) as level_second_approver 
        FROM user u 
        LEFT JOIN user_permissions p ON u.user_id = p.user_id
        WHERE u.user_id = ?`
      ).bind(userId).first();

      if (!userProfile) {
        return new Response(JSON.stringify({ success: false, message: "User not found" }), { status: 404, headers });
      }

      return new Response(JSON.stringify({ success: true, profile: userProfile }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ success: false, message: "Route not found" }), { status: 404, headers });

  } catch (e: any) {
    console.error("Profile API error: ", e);
    return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500, headers });
  }
};
