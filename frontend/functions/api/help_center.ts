interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

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
    const userIdHeader = request.headers.get("x-user-id") || url.searchParams.get("user_id") || "";
    const userId = userIdHeader.replace(/['"]/g, '').trim();

    if (!userId) {
      return new Response(JSON.stringify({ success: false, message: "Unauthorized. Missing User ID." }), { status: 401, headers });
    }

    // GET /api/help_center
    if (method === "GET") {
      const user: any = await env.DB.prepare("SELECT role, zone_name, district_name FROM user WHERE user_id = ?").bind(userId).first();
      if (!user) {
        return new Response(JSON.stringify({ success: false, message: "User not found." }), { status: 404, headers });
      }

      const role = user.role || "";
      let query = "";
      let params: any[] = [];

      if (role === "Admin" || role === "Superadmin" || role === "Accounts") {
        query = `
          SELECT c.*, u.full_name as submitter_name, u.e_code as submitter_ecode, u.role as submitter_role
          FROM help_concerns c
          JOIN user u ON c.user_id = u.user_id
          ORDER BY c.created_at DESC
        `;
      } else if (role === "Coordinator" || role === "Divisional Manager") {
        query = `
          SELECT c.*, u.full_name as submitter_name, u.e_code as submitter_ecode, u.role as submitter_role
          FROM help_concerns c
          JOIN user u ON c.user_id = u.user_id
          WHERE u.zone_name = ?
          ORDER BY c.created_at DESC
        `;
        params.push(user.zone_name || "");
      } else if (role === "Manager") {
        query = `
          SELECT c.*, u.full_name as submitter_name, u.e_code as submitter_ecode, u.role as submitter_role
          FROM help_concerns c
          JOIN user u ON c.user_id = u.user_id
          WHERE u.level_first_approver = ? OR u.level_second_approver = ? OR u.district_name = ? OR c.user_id = ?
          ORDER BY c.created_at DESC
        `;
        params.push(userId, userId, user.district_name || "", userId);
      } else {
        query = `
          SELECT c.*, u.full_name as submitter_name, u.e_code as submitter_ecode, u.role as submitter_role
          FROM help_concerns c
          JOIN user u ON c.user_id = u.user_id
          WHERE c.user_id = ?
          ORDER BY c.created_at DESC
        `;
        params.push(userId);
      }

      const { results } = await env.DB.prepare(query).bind(...params).all();
      return new Response(JSON.stringify({ success: true, concerns: results }), { headers });
    }

    // POST /api/help_center
    if (method === "POST") {
      const body: any = await request.json();
      const { exp_id, message } = body;

      if (!message || !message.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Concern message is required." }), { status: 400, headers });
      }

      await env.DB.prepare(`
        INSERT INTO help_concerns (user_id, exp_id, message, status, created_at, updated_at) 
        VALUES (?, ?, ?, 'Open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(userId, exp_id || null, message).run();

      // Get submitter name
      const submitter: any = await env.DB.prepare("SELECT full_name, zone_name FROM user WHERE user_id = ?").bind(userId).first();
      const name = submitter?.full_name || "Employee";

      // Notify Coordinator of that zone
      if (submitter?.zone_name) {
        const coord: any = await env.DB.prepare("SELECT user_id FROM user WHERE role = 'Coordinator' AND zone_name = ? LIMIT 1")
          .bind(submitter.zone_name).first();
        if (coord?.user_id) {
          const notifyMsg = `New Help concern raised by ${name} (${userId}) ${exp_id ? 'for claim ' + exp_id : ''}.`;
          await env.DB.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)")
            .bind(coord.user_id, notifyMsg).run();
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Concern submitted successfully." }), { status: 200, headers });
    }

    // PUT /api/help_center (Reply/Resolve)
    if (method === "PUT") {
      const body: any = await request.json();
      const { id, reply } = body;

      if (!id || !reply || !reply.trim()) {
        return new Response(JSON.stringify({ success: false, message: "Concern ID and reply message are required." }), { status: 400, headers });
      }

      const concern: any = await env.DB.prepare("SELECT user_id FROM help_concerns WHERE id = ?").bind(id).first();
      if (!concern) {
        return new Response(JSON.stringify({ success: false, message: "Concern not found." }), { status: 404, headers });
      }

      // Get replier name
      const replier: any = await env.DB.prepare("SELECT full_name FROM user WHERE user_id = ?").bind(userId).first();
      const replierName = replier?.full_name || "Manager";

      await env.DB.prepare(`
        UPDATE help_concerns 
        SET reply = ?, replied_by = ?, status = 'Resolved', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(reply, replierName, id).run();

      // Notify user
      const userNotifyMsg = `Your Help concern (ID: CON-${id}) has been answered by ${replierName}.`;
      await env.DB.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)")
        .bind(concern.user_id, userNotifyMsg).run();

      return new Response(JSON.stringify({ success: true, message: "Reply submitted and concern resolved." }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ success: false, message: "Method Not Allowed" }), { status: 405, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, message: "System Error: " + e.message }), { status: 500, headers });
  }
};
