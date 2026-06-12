import { getUserCreatedTemplate, sendResendEmail } from '../../utils/email';

interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

// PBKDF2 secure password hashing utility for backwards compatibility
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

async function getNextId(env: Env) {
  const result: any = await env.DB.prepare("SELECT user_id FROM user WHERE user_id LIKE 'RJ%' ORDER BY user_id DESC LIMIT 1").first();
  if (!result || !result.user_id) return "RJ001";
  const match = result.user_id.match(/RJ(\d+)/);
  return match ? `RJ${(parseInt(match[1], 10) + 1).toString().padStart(3, '0')}` : "RJ001";
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
    // Dropdown data retrieval
    if (path === "/api/admin/dropdowns") {
      const zones: any = await env.DB.prepare('SELECT DISTINCT zone_name FROM "Facily Details"').all();
      const roles: any = await env.DB.prepare('SELECT DISTINCT Role FROM Role').all();
      const grades: any = await env.DB.prepare('SELECT DISTINCT grade FROM allowance_master').all();
      const nextId = await getNextId(env);
      return new Response(JSON.stringify({ 
        success: true, 
        zones: zones.results.map((z: any) => z.zone_name), 
        roles: roles.results.map((r: any) => r.Role), 
        grades: grades.results.map((g: any) => g.grade), 
        next_id: nextId 
      }), { headers });
    }

    // District retrieval based on zone
    if (path === "/api/admin/districts") {
      const zone = url.searchParams.get('zone');
      const districts: any = await env.DB.prepare('SELECT DISTINCT district_name FROM "Facily Details" WHERE zone_name = ?').bind(zone).all();
      return new Response(JSON.stringify({ success: true, districts: districts.results.map((d: any) => d.district_name) }), { headers });
    }

    // Users directory
    if (path === "/api/admin/users") {
      if (method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT u.user_id, u.e_code, u.full_name, u.designation, u.mobile_number, u.mail_id, 
          u.e_upkaran_id, u.date_of_birth, u.date_joining, u.zone_name, u.district_name, 
          u.grade, u.role, u.level_first_approver, u.level_second_approver, u.account_status, u.failed_attempts,
          p.allowed_menus
          FROM user u
          LEFT JOIN user_permissions p ON u.user_id = p.user_id
          ORDER BY u.user_id DESC
        `).all();
        return new Response(JSON.stringify({ success: true, users: results }), { headers });
      }
      
      if (method === "POST") {
        const d: any = await request.json();
        const nextId = await getNextId(env);
        
        const salt = generateSalt();
        const plainPassword = d.password || '123456';
        const hashedPassword = await hashPassword(plainPassword, salt);

        await env.DB.prepare(`
          INSERT INTO user (
            user_id, e_code, full_name, designation, mobile_number, mail_id, 
            e_upkaran_id, date_of_birth, date_joining, zone_name, district_name, 
            grade, role, level_first_approver, level_second_approver, 
            password, password_salt, account_status, failed_attempts
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 0)
        `)
        .bind(
          nextId, d.e_code, d.full_name, d.designation, d.mobile_number, d.mail_id, 
          d.e_upkaran_id || null, d.date_of_birth, d.date_joining, d.zone_name, d.district_name, 
          d.grade, d.role, d.level_first_approver || null, d.level_second_approver || null, 
          hashedPassword, salt
        ).run();

        // Set page permissions
        const allowedMenus = d.allowed_menus || 'dashboard,expense,profile';
        await env.DB.prepare(`
          INSERT OR REPLACE INTO user_permissions (user_id, full_name, allowed_menus) 
          VALUES (?, ?, ?)
        `).bind(nextId, d.full_name, allowedMenus).run();

        // Send Welcome Email using Resend
        if (d.mail_id) {
          const emailHtml = getUserCreatedTemplate(d.full_name, nextId, plainPassword, d.role);
          try {
            await sendResendEmail(d.mail_id, "Welcome to Cyrix Healthcare - Account Created", emailHtml);
          } catch (emailErr) {
            console.error("Welcome email failed to send: ", emailErr);
          }
        }
        
        return new Response(JSON.stringify({ success: true }), { headers });
      }
    }

    if (path.startsWith("/api/admin/users/") && !path.endsWith("/status")) {
      const userId = decodeURIComponent(path.split('/').pop() || '');
      if (method === "PUT") {
        const d: any = await request.json();
        
        let query = `
          UPDATE user SET e_code=?, full_name=?, designation=?, mobile_number=?, mail_id=?, 
          e_upkaran_id=?, date_of_birth=?, date_joining=?, zone_name=?, district_name=?, 
          grade=?, role=?, level_first_approver=?, level_second_approver=?`;
        
        let params: any[] = [
          d.e_code, d.full_name, d.designation, d.mobile_number, d.mail_id, 
          d.e_upkaran_id || null, d.date_of_birth, d.date_joining, d.zone_name, d.district_name, 
          d.grade, d.role, d.level_first_approver || null, d.level_second_approver || null
        ];

        if (d.password && d.password.trim() !== "") {
          const newSalt = generateSalt();
          const newHash = await hashPassword(d.password, newSalt);
          query += `, password=?, password_salt=?`;
          params.push(newHash, newSalt);
        }

        query += ` WHERE user_id=?`;
        params.push(userId);

        await env.DB.prepare(query).bind(...params).run();

        // Update page permissions
        const allowedMenus = d.allowed_menus || 'dashboard,expense,profile';
        await env.DB.prepare(`
          INSERT OR REPLACE INTO user_permissions (user_id, full_name, allowed_menus) 
          VALUES (?, ?, ?)
        `).bind(userId, d.full_name, allowedMenus).run();

        return new Response(JSON.stringify({ success: true }), { headers });
      }
      
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM user WHERE user_id = ?").bind(userId).run();
        await env.DB.prepare("DELETE FROM user_permissions WHERE user_id = ?").bind(userId).run();
        return new Response(JSON.stringify({ success: true }), { headers });
      }
    }

    if (path.includes("/status") && method === "PUT") {
      const parts = path.split('/');
      const userId = decodeURIComponent(parts[parts.length - 2]); 
      const { status } = await request.json() as any;
      
      if (status === 'Active') {
        await env.DB.prepare("UPDATE user SET account_status = ?, failed_attempts = 0 WHERE user_id = ?").bind(status, userId).run();
      } else {
        await env.DB.prepare("UPDATE user SET account_status = ? WHERE user_id = ?").bind(status, userId).run();
      }
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // GET /api/admin/logs
    if (path === "/api/admin/logs" && method === "GET") {
      const type = url.searchParams.get("type") || "action";
      if (type === "error") {
        const { results } = await env.DB.prepare("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 200").all();
        return new Response(JSON.stringify({ success: true, logs: results }), { headers });
      } else {
        const { results } = await env.DB.prepare("SELECT * FROM user_action_logs ORDER BY created_at DESC LIMIT 200").all();
        return new Response(JSON.stringify({ success: true, logs: results }), { headers });
      }
    }

    // GET /api/admin/profile-requests
    if (path === "/api/admin/profile-requests" && method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT r.id, r.user_id, r.new_data, r.status, r.created_at, u.full_name, u.e_code 
        FROM profile_update_requests r
        JOIN user u ON r.user_id = u.user_id
        ORDER BY r.created_at DESC
      `).all();
      return new Response(JSON.stringify({ success: true, requests: results }), { headers });
    }

    // POST /api/admin/profile-requests/action
    if (path === "/api/admin/profile-requests/action" && method === "POST") {
      const body: any = await request.json();
      const { id, action } = body;
      if (!id || !action) {
        return new Response(JSON.stringify({ success: false, message: "Missing id or action." }), { status: 400, headers });
      }

      const req: any = await env.DB.prepare("SELECT * FROM profile_update_requests WHERE id = ?").bind(id).first();
      if (!req) {
        return new Response(JSON.stringify({ success: false, message: "Profile request not found." }), { status: 404, headers });
      }

      if (req.status !== 'Pending') {
        return new Response(JSON.stringify({ success: false, message: "Request has already been processed." }), { status: 400, headers });
      }

      if (action === 'Reject') {
        await env.DB.prepare("UPDATE profile_update_requests SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
        
        // Notify user
        const msg = `Your profile details update request (ID: ${id}) has been rejected by Admin.`;
        await env.DB.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)").bind(req.user_id, msg).run();

        return new Response(JSON.stringify({ success: true, message: "Request rejected successfully." }), { headers });
      } else if (action === 'Approve') {
        const newData = JSON.parse(req.new_data);
        
        // Update user table
        await env.DB.prepare(`
          UPDATE user SET 
            full_name = ?, date_of_birth = ?, date_joining = ?, designation = ?, 
            mobile_number = ?, mail_id = ?, e_upkaran_id = ?, zone_name = ?, 
            district_name = ?, grade = ?, role = ?
          WHERE user_id = ?
        `).bind(
          newData.full_name, newData.date_of_birth, newData.date_joining, newData.designation,
          newData.mobile_number, newData.mail_id, newData.e_upkaran_id || null, newData.zone_name,
          newData.district_name, newData.grade, newData.role, req.user_id
        ).run();

        // Update user_permissions name
        await env.DB.prepare("UPDATE user_permissions SET full_name = ? WHERE user_id = ?")
          .bind(newData.full_name, req.user_id).run();

        // Update request status
        await env.DB.prepare("UPDATE profile_update_requests SET status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();

        // Notify user
        const msg = `Your profile details update request (ID: ${id}) has been approved. Your profile is updated.`;
        await env.DB.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)").bind(req.user_id, msg).run();

        return new Response(JSON.stringify({ success: true, message: "Request approved and details updated." }), { headers });
      }
    }

    // POST /api/admin/error-log
    if (path === "/api/admin/error-log" && method === "POST") {
      const body: any = await request.json();
      const { user_id, error_message, stack_trace, path: errPath } = body;
      await env.DB.prepare(`
        INSERT INTO error_logs (user_id, error_message, stack_trace, path) 
        VALUES (?, ?, ?, ?)
      `).bind(user_id || 'Guest', error_message || 'Unknown', stack_trace || '', errPath || '').run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ success: false, message: "Route not found" }), { status: 404, headers });
  } catch (e: any) { 
    return new Response(JSON.stringify({ success: false, message: e.message }), { status: 500, headers }); 
  }
};
