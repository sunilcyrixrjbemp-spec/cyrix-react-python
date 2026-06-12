interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    // GET /api/notifications
    if (method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 50
      `).bind(userId).all();
      
      return new Response(JSON.stringify({ success: true, notifications: results }), { headers });
    }

    // POST /api/notifications/clear
    if (method === "POST") {
      await env.DB.prepare("DELETE FROM notifications WHERE user_id = ?").bind(userId).run();
      return new Response(JSON.stringify({ success: true, message: "Notifications cleared." }), { headers });
    }

    return new Response(JSON.stringify({ success: false, message: "Method Not Allowed" }), { status: 405, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, message: "System Error: " + e.message }), { status: 500, headers });
  }
};
