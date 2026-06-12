interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const managerId = url.searchParams.get("manager_id");
    if (!managerId) {
      return new Response(JSON.stringify({ success: false, message: "Manager ID is required" }), { 
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const managerUser: any = await env.DB.prepare("SELECT role FROM user WHERE user_id = ?").bind(managerId).first();
    const rawRole = (managerUser && managerUser.role) ? String(managerUser.role).trim().toUpperCase() : '';
    
    const isAdmin = rawRole === 'ADMIN' || rawRole === 'SUPERADMIN' || rawRole === 'HR';
    const isManager = rawRole.includes('MANAGER') || rawRole.includes('INCHARGE');
    const isCoordinator = rawRole.includes('COORDINATOR');

    let teamQuery = `
      SELECT u.user_id, u.full_name, u.designation, u.role, u.e_code, u.account_status,
             COALESCE((SELECT full_name FROM user l1 WHERE l1.user_id = u.level_first_approver), 'No Manager Assigned') as manager_name
      FROM user u
      WHERE 1=1
    `;
    let bindings: any[] = [];

    if (isAdmin) {
      // Admin gets everyone to display the organogram
    } else if (isManager && isCoordinator) {
      teamQuery += ` AND (u.level_first_approver = ? OR u.level_second_approver = ?)`;
      bindings.push(managerId, managerId);
    } else if (isManager) {
      teamQuery += ` AND u.level_first_approver = ?`;
      bindings.push(managerId);
    } else if (isCoordinator) {
      teamQuery += ` AND u.level_second_approver = ?`;
      bindings.push(managerId);
    } else {
      teamQuery += ` AND (u.level_first_approver = ? OR u.level_second_approver = ?)`;
      bindings.push(managerId, managerId);
    }

    teamQuery += ` ORDER BY manager_name ASC, u.full_name ASC`;

    const { results } = await env.DB.prepare(teamQuery).bind(...bindings).all();

    return new Response(JSON.stringify({ success: true, team: results || [] }), { 
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    console.error("Team API Error:", e);
    return new Response(JSON.stringify({ success: false, message: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
