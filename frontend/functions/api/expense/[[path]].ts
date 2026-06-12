interface Env {
  DB: D1Database;
  BILLS_BUCKET: R2Bucket;
  R2_PUBLIC_DOMAIN?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
};

function isMissing(value: any) {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" || normalized === "null" || normalized === "undefined";
}

function getCookieValue(cookieHeader: string | null, key: string) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function resolveLoggedInUserId(request: Request, url: URL, body: any = null, formData: FormData | null = null) {
  const candidates = [
    url.searchParams.get("user_id"),
    url.searchParams.get("userId"),
    request.headers.get("x-user-id"),
    request.headers.get("x-userid"),
    request.headers.get("x-user"),
    request.headers.get("cf-user-id")
  ];

  if (body) {
    candidates.push(body.user_id);
    candidates.push(body.userId);
  }

  if (formData) {
    candidates.push(formData.get("user_id"));
    candidates.push(formData.get("userId"));
  }

  const cookieHeader = request.headers.get("cookie") || "";
  candidates.push(getCookieValue(cookieHeader, "user_id"));
  candidates.push(getCookieValue(cookieHeader, "userId"));

  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const payload = decodeJwtPayload(authHeader.slice(7).trim());
    if (payload) {
      candidates.push(payload.user_id, payload.userId, payload.uid, payload.sub);
    }
  }

  const userId = candidates.find((v) => !isMissing(v));
  return isMissing(userId) ? null : String(userId).trim();
}

async function saveR2File(file: File, expId: string, typeStr: string, env: Env): Promise<string> {
  if (!file || !file.name || file.size === 0) return "";
  const safeName = file.name.replace(/\s+/g, "_");
  const filename = `${expId}_${typeStr}_${Date.now()}_${safeName}`;
  const arrayBuffer = await file.arrayBuffer();
  await env.BILLS_BUCKET.put(filename, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    }
  });
  return `/uploads/${filename}`;
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
    /* ── GET /api/expense/init ── */
    if (path === "/api/expense/init" && method === "GET") {
      const userId = await resolveLoggedInUserId(request, url);
      if (!userId) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized: Please login first." }), { status: 401, headers });
      }

      const reqMonth = url.searchParams.get("month") || new Date().toISOString().slice(0, 7);

      const [user, kmRes, autoRes, facResList, submittedRes, approvedKmReq, approvedAutoReq, existingKmMonth, existingAutoMonth]: any[] = await Promise.all([
        env.DB.prepare("SELECT full_name, e_code, grade, district_name as home_district, level_first_approver, level_second_approver FROM user WHERE user_id = ?").bind(userId).first(),
        env.DB.prepare(`SELECT SUM(distance_km) as total_km FROM expense_itinerary i JOIN expense_master m ON i.exp_id = m.exp_id WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? AND (i.travel_mode = 'Bike' OR i.travel_mode = 'Car')`).bind(userId, reqMonth).first().catch(() => ({ total_km: 0 })),
        env.DB.prepare(`SELECT COALESCE(SUM(i.travel_amount), 0) + COALESCE(SUM(i.sub_amount), 0) as total_auto FROM expense_itinerary i JOIN expense_master m ON i.exp_id = m.exp_id WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? AND (i.travel_mode = 'Auto' OR i.sub_mode = 'Auto')`).bind(userId, reqMonth).first().catch(() => ({ total_auto: 0 })),
        env.DB.prepare('SELECT district_name, facility_name FROM "Facily Details"').all().catch(() => ({ results: [] })),
        env.DB.prepare("SELECT expense_date FROM expense_master WHERE user_id = ? AND strftime('%Y-%m', expense_date) = ?").bind(userId, reqMonth).all().catch(() => ({ results: [] })),
        env.DB.prepare(`SELECT COALESCE(SUM(requested_value), 0) as approved_km FROM limit_approval_requests WHERE user_id = ? AND request_type = 'KM' AND LOWER(status) = 'approved' AND for_month = ?`).bind(userId, reqMonth).first().catch(() => ({ approved_km: 0 })),
        env.DB.prepare(`SELECT COALESCE(SUM(requested_value), 0) as approved_auto FROM limit_approval_requests WHERE user_id = ? AND request_type = 'AUTO' AND LOWER(status) = 'approved' AND for_month = ?`).bind(userId, reqMonth).first().catch(() => ({ approved_auto: 0 })),
        env.DB.prepare(`SELECT status, requested_value FROM limit_approval_requests WHERE user_id = ? AND request_type = 'KM' AND for_month = ? ORDER BY id DESC LIMIT 1`).bind(userId, reqMonth).first().catch(() => null),
        env.DB.prepare(`SELECT status, requested_value FROM limit_approval_requests WHERE user_id = ? AND request_type = 'AUTO' AND for_month = ? ORDER BY id DESC LIMIT 1`).bind(userId, reqMonth).first().catch(() => null)
      ]);

      if (!user) {
        return new Response(JSON.stringify({ success: false, message: "Invalid User: You don't have access to submit expenses." }), { status: 403, headers });
      }

      let allowance: any = await env.DB.prepare("SELECT * FROM allowance_master WHERE grade = ?").bind(user.grade).first().catch(() => null);
      if (!allowance) {
        allowance = {
          daily_in_district: 250,
          daily_out_district: 400,
          daily_hotel: 350,
          daily_out_state: 600,
          hotel_in_state_s: 1500,
          max_km_per_month: 2000,
          rate_bike: 4.5,
          rate_car: 9.0,
          vehicle_type: "Bike"
        };
      }

      allowance.current_month_km = kmRes ? (kmRes.total_km || 0) : 0;
      allowance.current_month_auto = autoRes ? (autoRes.total_auto || 0) : 0;
      allowance.max_auto_per_month = 1000;

      const facilities: Record<string, string[]> = {};
      if (facResList && facResList.results) {
        facResList.results.forEach((f: any) => {
          if (!facilities[f.district_name]) facilities[f.district_name] = [];
          facilities[f.district_name].push(f.facility_name);
        });
      }

      const submitted_dates = submittedRes && submittedRes.results
        ? submittedRes.results.map((r: any) => r.expense_date)
        : [];

      const dateObj = new Date();
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const yy = String(dateObj.getFullYear()).slice(-2);

      return new Response(JSON.stringify({
        success: true,
        user,
        allowance,
        facilities,
        submitted_dates,
        approved_km: approvedKmReq ? approvedKmReq.approved_km : 0,
        approved_auto: approvedAutoReq ? approvedAutoReq.approved_auto : 0,
        existing_km_req: existingKmMonth || null,
        existing_auto_req: existingAutoMonth || null,
        next_exp_id: `RJ-${mm}/${yy}-PENDING`
      }), { status: 200, headers });
    }

    /* ── GET /api/expense/edit ── */
    if (path === "/api/expense/edit" && method === "GET") {
      const userId = await resolveLoggedInUserId(request, url);
      const expId = url.searchParams.get("exp_id");

      if (!userId) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized." }), { status: 401, headers });
      }
      if (!expId) {
        return new Response(JSON.stringify({ success: false, message: "exp_id is required." }), { status: 400, headers });
      }

      const expense: any = await env.DB.prepare(`
        SELECT m.*, u.full_name, u.e_code, u.grade, u.district_name as home_district
        FROM expense_master m
        JOIN user u ON m.user_id = u.user_id
        WHERE m.exp_id = ?
      `).bind(expId).first();

      if (!expense) {
        return new Response(JSON.stringify({ success: false, message: "Expense not found." }), { status: 404, headers });
      }

      if (expense.user_id !== userId) {
        return new Response(JSON.stringify({ success: false, message: "Access Denied." }), { status: 403, headers });
      }

      const { results: itineraries }: any = await env.DB.prepare(`
        SELECT i.*,
            COALESCE(
                (SELECT GROUP_CONCAT(a.file_url || '::' || a.bill_type, '|||')
                 FROM expense_attachments a
                 WHERE a.itinerary_id = i.itinerary_id),
                ''
            ) as attachments_raw
        FROM expense_itinerary i
        WHERE i.exp_id = ?
        ORDER BY i.leg_number ASC
      `).bind(expId).all();

      const enrichedItineraries = (itineraries || []).map((leg: any) => {
        const attachments: any[] = [];
        if (leg.attachments_raw) {
          leg.attachments_raw.split("|||").filter(Boolean).forEach((raw: any) => {
            const [url_val, bill_type] = raw.split("::");
            if (url_val) attachments.push({ url: url_val, bill_type: bill_type || "" });
          });
        }
        return {
          ...leg,
          leg: leg.leg_number,
          from: leg.from_location,
          to: leg.to_location,
          mode: leg.travel_mode,
          km: leg.distance_km,
          amount: leg.travel_amount,
          district: leg.to_district,
          district_from: leg.from_district,
          travel_type: leg.from_district !== leg.to_district ? "Outdoor" : "In-District",
          ws_assigned: leg.calls_assigned,
          ws_closed: leg.calls_completed,
          ws_pms: leg.pms_count,
          ws_asset: leg.asset_tagging,
          da: leg.da_amount,
          hotel: leg.hotel_amount,
          oth_desc: leg.other_desc,
          oth_amount: leg.other_amount,
          attachments
        };
      });

      return new Response(JSON.stringify({
        success: true,
        expense,
        itineraries: enrichedItineraries
      }), { status: 200, headers });
    }

    /* ── POST /api/expense/limit-request ── */
    if (path === "/api/expense/limit-request" && method === "POST") {
      let userId = null;
      let type = null;
      let amount = null;
      let reqMonth = null;

      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body: any = await request.json().catch(() => ({}));
        userId = body.user_id || body.userId;
        type = body.type;
        amount = body.amount;
        reqMonth = body.month;
      } else {
        const formData = await request.formData().catch(() => null);
        if (formData) {
          userId = formData.get("user_id") || formData.get("userId");
          type = formData.get("type");
          amount = formData.get("amount");
          reqMonth = formData.get("month");
        }
      }

      if (!reqMonth) {
        reqMonth = new Date().toISOString().slice(0, 7);
      }

      if (!userId) {
        userId = await resolveLoggedInUserId(request, url);
      }

      if (!userId) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized: Please login first." }), { status: 401, headers });
      }

      if (isMissing(type) || isMissing(amount)) {
        return new Response(JSON.stringify({ success: false, message: "Type and amount are required." }), { status: 400, headers });
      }

      const parsedAmount = parseFloat(String(amount));
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return new Response(JSON.stringify({ success: false, message: "Invalid amount." }), { status: 400, headers });
      }

      const user: any = await env.DB.prepare("SELECT level_first_approver FROM user WHERE user_id = ?").bind(userId).first();
      if (!user) {
        return new Response(JSON.stringify({ success: false, message: "User not found." }), { status: 404, headers });
      }

      const managerId = user.level_first_approver;
      if (isMissing(managerId)) {
        return new Response(JSON.stringify({ success: false, message: "No manager mapped to your profile." }), { status: 400, headers });
      }
      
      const existingReq: any = await env.DB.prepare(`
        SELECT id, status FROM limit_approval_requests 
        WHERE user_id = ? AND request_type = ? AND for_month = ?
      `).bind(userId, type, reqMonth).first().catch(() => null);

      if (existingReq) {
        return new Response(JSON.stringify({ 
          success: false, 
          message: `Request for ${type} already exists this month (Status: ${existingReq.status}).` 
        }), { status: 400, headers });
      }

      await env.DB.prepare(`
        INSERT INTO limit_approval_requests (user_id, manager_id, request_type, requested_value, status, for_month, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'Pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(userId, managerId, type, parsedAmount, reqMonth).run();

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Limit approval request submitted to manager ${managerId}.` 
      }), { status: 200, headers });
    }

    /* ── POST /api/expense ── */
    if (path === "/api/expense" && method === "POST") {
      const formData = await request.formData();
      const userId = await resolveLoggedInUserId(request, url, null, formData);
      if (!userId) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized: Please login first." }), { status: 401, headers });
      }

      const expDate = formData.get("exp_date") as string;
      const totalAmount = parseFloat(formData.get("total_amount") as string || "0");
      const itinerariesStr = formData.get("itineraries") as string;

      if (!expDate || !itinerariesStr) {
        return new Response(JSON.stringify({ success: false, message: "Expense date and itineraries are required." }), { status: 400, headers });
      }

      // Date Limit Verification (3rd of current month check)
      const kolkataDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const currentDay = kolkataDate.getDate();
      const currentYear = kolkataDate.getFullYear();
      const currentMonth = kolkataDate.getMonth();

      const expDateObj = new Date(expDate);
      const expYear = expDateObj.getFullYear();
      const expMonth = expDateObj.getMonth();

      if (currentDay > 3) {
        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
          return new Response(JSON.stringify({
            success: false,
            message: "Submission Locked: Expense claims for the previous month cannot be submitted after the 3rd of the current month."
          }), { status: 400, headers });
        }
      }

      const existing: any = await env.DB.prepare(
        "SELECT exp_id FROM expense_master WHERE user_id = ? AND expense_date = ?"
      ).bind(userId, expDate).first();
      if (existing) {
        return new Response(JSON.stringify({ success: false, message: `For this date (${expDate}) expense is already submitted.` }), { status: 400, headers });
      }

      const user: any = await env.DB.prepare(
        "SELECT level_first_approver, level_second_approver, full_name FROM user WHERE user_id = ?"
      ).bind(userId).first();
      if (!user) {
        return new Response(JSON.stringify({ success: false, message: "User profile not found." }), { status: 403, headers });
      }

      const l1App = user.level_first_approver;
      const l2App = user.level_second_approver;

      const itineraries = JSON.parse(itinerariesStr);
      let totalDa = 0, totalHotel = 0, totalOther = 0;
      let totalAssigned = 0, totalCompleted = 0, totalPms = 0, totalAsset = 0;
      let incomingKm = 0, incomingAuto = 0;

      for (const iti of itineraries) {
        totalDa += parseFloat(iti.da || 0);
        totalHotel += parseFloat(iti.hotel || 0);
        totalOther += parseFloat(iti.oth_amount || 0);
        totalAssigned += parseInt(iti.ws_assigned || 0, 10);
        totalCompleted += parseInt(iti.ws_closed || 0, 10);
        totalPms += parseInt(iti.ws_pms || 0, 10);
        totalAsset += parseInt(iti.ws_asset || 0, 10);

        if (["Bike", "Car"].includes(iti.mode)) {
          incomingKm += parseFloat(iti.km || 0);
        } else if (iti.mode === "Auto") {
          incomingAuto += parseFloat(iti.amount || 0);
        }
        if (iti.sub_mode === "Auto") {
          incomingAuto += parseFloat(iti.sub_amount || 0);
        }
      }

      const currentMonthStr = expDate.slice(0, 7);

      const kmRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(i.distance_km), 0) as total_km 
        FROM expense_itinerary i 
        JOIN expense_master m ON i.exp_id = m.exp_id 
        WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
          AND (i.travel_mode = 'Bike' OR i.travel_mode = 'Car')
      `).bind(userId, currentMonthStr).first();
      const accumKm = kmRes ? kmRes.total_km : 0;

      const autoRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(i.travel_amount), 0) + COALESCE(SUM(i.sub_amount), 0) as total_auto 
        FROM expense_itinerary i 
        JOIN expense_master m ON i.exp_id = m.exp_id 
        WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
          AND (i.travel_mode = 'Auto' OR i.sub_mode = 'Auto')
      `).bind(userId, currentMonthStr).first();
      const accumAuto = autoRes ? autoRes.total_auto : 0;

      const allowance: any = await env.DB.prepare(
        "SELECT max_km_per_month FROM allowance_master WHERE grade = (SELECT grade FROM user WHERE user_id = ?)"
      ).bind(userId).first();
      const maxKm = allowance ? allowance.max_km_per_month : 2000;
      const maxAuto = 1000;

      const appKmRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(requested_value), 0) as approved_km 
        FROM limit_approval_requests 
        WHERE user_id = ? AND request_type = 'KM' AND LOWER(status) = 'approved' AND for_month = ?
      `).bind(userId, currentMonthStr).first();
      const approvedKm = appKmRes ? appKmRes.approved_km : 0;

      const appAutoRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(requested_value), 0) as approved_auto 
        FROM limit_approval_requests 
        WHERE user_id = ? AND request_type = 'AUTO' AND LOWER(status) = 'approved' AND for_month = ?
      `).bind(userId, currentMonthStr).first();
      const approvedAuto = appAutoRes ? appAutoRes.approved_auto : 0;

      if ((accumKm + incomingKm) > maxKm) {
        const excessKm = (accumKm + incomingKm) - maxKm;
        if (approvedKm < excessKm) {
          return new Response(JSON.stringify({
            success: false,
            message: `Submission Locked: You have exceeded your monthly KM limit by ${(excessKm - approvedKm).toFixed(2)} km. You must request approval from your Level 1 Manager to proceed.`
          }), { status: 400, headers });
        }
      }

      if ((accumAuto + incomingAuto) > maxAuto) {
        const excessAuto = (accumAuto + incomingAuto) - maxAuto;
        if (approvedAuto < excessAuto) {
          return new Response(JSON.stringify({
            success: false,
            message: `Submission Locked: You have exceeded your monthly Auto limit by ₹ ${(excessAuto - approvedAuto).toFixed(2)}. You must request approval from your Level 1 Manager to proceed.`
          }), { status: 400, headers });
        }
      }

      // Generate sequence-based exp_id
      const dateParts = expDate.split("-");
      const mmStr = dateParts[1];
      const yyStr = dateParts[0].slice(-2);
      const monthPrefix = `${mmStr}/${yyStr}`;

      const maxRes: any = await env.DB.prepare(
        "SELECT exp_id FROM expense_master WHERE exp_id LIKE ?"
      ).bind(`RJ-${monthPrefix}-%`).all();

      let maxSeq = 0;
      if (maxRes && maxRes.results) {
        maxRes.results.forEach((r: any) => {
          const parts = r.exp_id.split("-");
          if (parts.length === 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        });
      }
      const seqNum = maxSeq + 1;
      const finalExpId = `RJ-${monthPrefix}-${String(seqNum).padStart(6, "0")}`;

      // Insert to expense_master
      await env.DB.prepare(`
        INSERT INTO expense_master (
          exp_id, user_id, expense_date, total_amount, status,
          level_first_approver, level_second_approver,
          da_amount, hotel_amount, other_expense_amount,
          calls_assigned, calls_completed, pms_count, asset_tagging
        ) VALUES (?, ?, ?, ?, 'Pending L1', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        finalExpId, userId, expDate, totalAmount,
        l1App || null, l2App || null,
        totalDa, totalHotel, totalOther,
        totalAssigned, totalCompleted, totalPms, totalAsset
      ).run();

      // Insert Itineraries and upload attachments
      for (const iti of itineraries) {
        const legNum = parseInt(iti.leg || 1, 10);
        const itiId = `${finalExpId}-${legNum}`;
        const fromDist = iti.district_from || iti.district;
        const toDist = iti.district;

        await env.DB.prepare(`
          INSERT INTO expense_itinerary (
            itinerary_id, exp_id, leg_number,
            from_district, to_district,
            from_location, to_location,
            travel_mode, distance_km, travel_amount,
            sub_mode, sub_amount,
            da_amount, hotel_amount,
            other_desc, other_amount,
            calls_assigned, calls_completed, pms_count, asset_tagging,
            visit_purpose
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          itiId, finalExpId, legNum,
          fromDist, toDist,
          iti.from, iti.to,
          iti.mode, iti.km, iti.amount,
          iti.sub_mode || null, iti.sub_amount || 0,
          iti.da || 0, iti.hotel || 0,
          iti.oth_desc || null, iti.oth_amount || 0,
          iti.ws_assigned || 0, iti.ws_closed || 0, iti.ws_pms || 0, iti.ws_asset || 0,
          iti.visit_purpose || null
        ).run();

        // Files
        const commFile = formData.get(`comm_mail_${legNum}`) as File | null;
        if (commFile && commFile.size > 0) {
          const urlPath = await saveR2File(commFile, finalExpId, "Communication_Mail", env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(finalExpId, itiId, "Communication_Mail", urlPath).run();
          }
        }

        const mainFile = formData.get(`main_bill_${legNum}`) as File | null;
        if (mainFile && mainFile.size > 0) {
          const urlPath = await saveR2File(mainFile, finalExpId, iti.mode, env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(finalExpId, itiId, iti.mode, urlPath).run();
          }
        }

        const subFile = formData.get(`sub_bill_${legNum}`) as File | null;
        if (subFile && subFile.size > 0 && iti.sub_mode) {
          const urlPath = await saveR2File(subFile, finalExpId, iti.sub_mode, env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(finalExpId, itiId, iti.sub_mode, urlPath).run();
          }
        }

        if (legNum === 1) {
          const hotelFile = formData.get("hotel_bill_1") as File | null;
          if (hotelFile && hotelFile.size > 0) {
            const urlPath = await saveR2File(hotelFile, finalExpId, "Hotel", env);
            if (urlPath) {
              await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
                .bind(finalExpId, itiId, "Hotel", urlPath).run();
            }
          }
        }

        const othFile = formData.get(`oth_bill_${legNum}`) as File | null;
        if (othFile && othFile.size > 0) {
          const urlPath = await saveR2File(othFile, finalExpId, "Other_Expense", env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(finalExpId, itiId, "Other_Expense", urlPath).run();
          }
        }
      }

      // Add Notification in DB
      if (l1App) {
        const notifyMsg = `New expense claim ${finalExpId} submitted by ${user.full_name} for ₹${totalAmount.toFixed(2)} on ${expDate}.`;
        await env.DB.prepare("INSERT INTO notifications (user_id, message) VALUES (?, ?)")
          .bind(l1App, notifyMsg).run();
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Expense submitted successfully.",
        exp_id: finalExpId
      }), { status: 200, headers });
    }

    /* ── PUT /api/expense/edit ── */
    if (path === "/api/expense/edit" && method === "PUT") {
      const formData = await request.formData();
      const userId = await resolveLoggedInUserId(request, url, null, formData);
      if (!userId) {
        return new Response(JSON.stringify({ success: false, message: "Unauthorized: Please login first." }), { status: 401, headers });
      }

      const expId = formData.get("exp_id") as string;
      if (!expId) {
        return new Response(JSON.stringify({ success: false, message: "exp_id is required." }), { status: 400, headers });
      }

      const existing: any = await env.DB.prepare(
        "SELECT user_id, status, expense_date FROM expense_master WHERE exp_id = ?"
      ).bind(expId).first();

      if (!existing) {
        return new Response(JSON.stringify({ success: false, message: "Expense not found." }), { status: 404, headers });
      }

      if (existing.user_id !== userId) {
        return new Response(JSON.stringify({ success: false, message: "Access Denied: You can only edit your own expenses." }), { status: 403, headers });
      }

      if (!String(existing.status).toLowerCase().includes("pending")) {
        return new Response(JSON.stringify({ success: false, message: `Cannot edit: Expense is already ${existing.status}.` }), { status: 409, headers });
      }

      const expDate = (formData.get("exp_date") || formData.get("expense_date") || existing.expense_date) as string;
      const totalAmount = parseFloat(formData.get("total_amount") as string || "0");
      const itinerariesStr = formData.get("itineraries") as string;

      // Date Limit Verification (3rd of current month check)
      const kolkataDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const currentDay = kolkataDate.getDate();
      const currentYear = kolkataDate.getFullYear();
      const currentMonth = kolkataDate.getMonth();

      const expDateObj = new Date(expDate);
      const expYear = expDateObj.getFullYear();
      const expMonth = expDateObj.getMonth();

      if (currentDay > 3) {
        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
          return new Response(JSON.stringify({
            success: false,
            message: "Submission Locked: Expense claims for the previous month cannot be edited after the 3rd of the current month."
          }), { status: 400, headers });
        }
      }

      const itineraries = JSON.parse(itinerariesStr || "[]");
      let totalDa = 0, totalHotel = 0, totalOther = 0;
      let totalAssigned = 0, totalCompleted = 0, totalPms = 0, totalAsset = 0;
      let incomingKm = 0, incomingAuto = 0;

      for (const iti of itineraries) {
        totalDa += parseFloat(iti.da || 0);
        totalHotel += parseFloat(iti.hotel || 0);
        totalOther += parseFloat(iti.oth_amount || 0);
        totalAssigned += parseInt(iti.ws_assigned || 0, 10);
        totalCompleted += parseInt(iti.ws_closed || 0, 10);
        totalPms += parseInt(iti.ws_pms || 0, 10);
        totalAsset += parseInt(iti.ws_asset || 0, 10);

        if (["Bike", "Car"].includes(iti.mode)) {
          incomingKm += parseFloat(iti.km || 0);
        } else if (iti.mode === "Auto") {
          incomingAuto += parseFloat(iti.amount || 0);
        }
        if (iti.sub_mode === "Auto") {
          incomingAuto += parseFloat(iti.sub_amount || 0);
        }
      }

      const oldKmRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(distance_km), 0) as total_km 
        FROM expense_itinerary 
        WHERE exp_id = ? AND (travel_mode = 'Bike' OR travel_mode = 'Car')
      `).bind(expId).first();
      const oldKm = oldKmRes ? oldKmRes.total_km : 0;

      const oldAutoRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(travel_amount), 0) + COALESCE(SUM(sub_amount), 0) as total_auto 
        FROM expense_itinerary 
        WHERE exp_id = ? AND (travel_mode = 'Auto' OR sub_mode = 'Auto')
      `).bind(expId).first();
      const oldAuto = oldAutoRes ? oldAutoRes.total_auto : 0;

      const currentMonthStr = expDate.slice(0, 7);
      const accumKmRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(i.distance_km), 0) as total_km 
        FROM expense_itinerary i 
        JOIN expense_master m ON i.exp_id = m.exp_id 
        WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
          AND (i.travel_mode = 'Bike' OR i.travel_mode = 'Car')
      `).bind(userId, currentMonthStr).first();
      const accumKm = accumKmRes ? accumKmRes.total_km : 0;

      const accumAutoRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(i.travel_amount), 0) + COALESCE(SUM(i.sub_amount), 0) as total_auto 
        FROM expense_itinerary i 
        JOIN expense_master m ON i.exp_id = m.exp_id 
        WHERE m.user_id = ? AND strftime('%Y-%m', m.expense_date) = ? 
          AND (i.travel_mode = 'Auto' OR i.sub_mode = 'Auto')
      `).bind(userId, currentMonthStr).first();
      const accumAuto = accumAutoRes ? accumAutoRes.total_auto : 0;

      const allowance: any = await env.DB.prepare(
        "SELECT max_km_per_month FROM allowance_master WHERE grade = (SELECT grade FROM user WHERE user_id = ?)"
      ).bind(userId).first();
      const maxKm = allowance ? allowance.max_km_per_month : 2000;
      const maxAuto = 1000;

      const appKmRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(requested_value), 0) as approved_km 
        FROM limit_approval_requests 
        WHERE user_id = ? AND request_type = 'KM' AND LOWER(status) = 'approved' AND for_month = ?
      `).bind(userId, currentMonthStr).first();
      const approvedKm = appKmRes ? appKmRes.approved_km : 0;

      const appAutoRes: any = await env.DB.prepare(`
        SELECT COALESCE(SUM(requested_value), 0) as approved_auto 
        FROM limit_approval_requests 
        WHERE user_id = ? AND request_type = 'AUTO' AND LOWER(status) = 'approved' AND for_month = ?
      `).bind(userId, currentMonthStr).first();
      const approvedAuto = appAutoRes ? appAutoRes.approved_auto : 0;

      const currentAccumKm = Math.max(0, accumKm - oldKm);
      const projectedKm = currentAccumKm + incomingKm;

      if (projectedKm > maxKm) {
        const excessKm = projectedKm - maxKm;
        if (approvedKm < excessKm) {
          return new Response(JSON.stringify({
            success: false,
            message: `Submission Locked: You have exceeded your monthly KM limit by ${(excessKm - approvedKm).toFixed(2)} km. You must request approval from your Level 1 Manager to proceed.`
          }), { status: 400, headers });
        }
      }

      const currentAccumAuto = Math.max(0, accumAuto - oldAuto);
      const projectedAuto = currentAccumAuto + incomingAuto;

      if (projectedAuto > maxAuto) {
        const excessAuto = projectedAuto - maxAuto;
        if (approvedAuto < excessAuto) {
          return new Response(JSON.stringify({
            success: false,
            message: `Submission Locked: You have exceeded your monthly Auto limit by ₹ ${(excessAuto - approvedAuto).toFixed(2)}. You must request approval from your Level 1 Manager to proceed.`
          }), { status: 400, headers });
        }
      }

      // Update Master
      await env.DB.prepare(`
        UPDATE expense_master
        SET total_amount = ?,
            da_amount = ?,
            hotel_amount = ?,
            other_expense_amount = ?,
            calls_assigned = ?,
            calls_completed = ?,
            pms_count = ?,
            asset_tagging = ?
        WHERE exp_id = ?
      `).bind(
        totalAmount,
        totalDa, totalHotel, totalOther,
        totalAssigned, totalCompleted, totalPms, totalAsset,
        expId
      ).run();

      // Insert/Update Legs
      for (const iti of itineraries) {
        const legNum = parseInt(iti.leg || 1, 10);
        const itiId = `${expId}-${legNum}`;
        const fromDist = iti.district_from || iti.district;
        const toDist = iti.district;

        const existingLeg = await env.DB.prepare("SELECT itinerary_id FROM expense_itinerary WHERE itinerary_id = ?").bind(itiId).first();

        if (existingLeg) {
          await env.DB.prepare(`
            UPDATE expense_itinerary
            SET from_district = ?, to_district = ?,
                from_location = ?, to_location = ?,
                travel_mode = ?, distance_km = ?, travel_amount = ?,
                sub_mode = ?, sub_amount = ?,
                da_amount = ?, hotel_amount = ?,
                other_desc = ?, other_amount = ?,
                calls_assigned = ?, calls_completed = ?,
                pms_count = ?, asset_tagging = ?,
                visit_purpose = ?
            WHERE itinerary_id = ?
          `).bind(
            fromDist, toDist,
            iti.from, iti.to,
            iti.mode, iti.km, iti.amount,
            iti.sub_mode || null, iti.sub_amount || 0,
            iti.da || 0, iti.hotel || 0,
            iti.oth_desc || null, iti.oth_amount || 0,
            iti.ws_assigned || 0, iti.ws_closed || 0, iti.ws_pms || 0, iti.ws_asset || 0,
            iti.visit_purpose || null,
            itiId
          ).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO expense_itinerary (
              itinerary_id, exp_id, leg_number,
              from_district, to_district,
              from_location, to_location,
              travel_mode, distance_km, travel_amount,
              sub_mode, sub_amount,
              da_amount, hotel_amount,
              other_desc, other_amount,
              calls_assigned, calls_completed, pms_count, asset_tagging,
              visit_purpose
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            itiId, expId, legNum,
            fromDist, toDist,
            iti.from, iti.to,
            iti.mode, iti.km, iti.amount,
            iti.sub_mode || null, iti.sub_amount || 0,
            iti.da || 0, iti.hotel || 0,
            iti.oth_desc || null, iti.oth_amount || 0,
            iti.ws_assigned || 0, iti.ws_closed || 0, iti.ws_pms || 0, iti.ws_asset || 0,
            iti.visit_purpose || null
          ).run();
        }

        // Uploads
        const commFile = formData.get(`comm_mail_${legNum}`) as File | null;
        if (commFile && commFile.size > 0) {
          const urlPath = await saveR2File(commFile, expId, "Communication_Mail", env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(expId, itiId, "Communication_Mail", urlPath).run();
          }
        }

        const mainFile = formData.get(`main_bill_${legNum}`) as File | null;
        if (mainFile && mainFile.size > 0) {
          const urlPath = await saveR2File(mainFile, expId, iti.mode, env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(expId, itiId, iti.mode, urlPath).run();
          }
        }

        const subFile = formData.get(`sub_bill_${legNum}`) as File | null;
        if (subFile && subFile.size > 0 && iti.sub_mode) {
          const urlPath = await saveR2File(subFile, expId, iti.sub_mode, env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(expId, itiId, iti.sub_mode, urlPath).run();
          }
        }

        if (legNum === 1) {
          const hotelFile = formData.get("hotel_bill_1") as File | null;
          if (hotelFile && hotelFile.size > 0) {
            const urlPath = await saveR2File(hotelFile, expId, "Hotel", env);
            if (urlPath) {
              await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
                .bind(expId, itiId, "Hotel", urlPath).run();
            }
          }
        }

        const othFile = formData.get(`oth_bill_${legNum}`) as File | null;
        if (othFile && othFile.size > 0) {
          const urlPath = await saveR2File(othFile, expId, "Other_Expense", env);
          if (urlPath) {
            await env.DB.prepare("INSERT INTO expense_attachments (exp_id, itinerary_id, bill_type, file_url) VALUES (?, ?, ?, ?)")
              .bind(expId, itiId, "Other_Expense", urlPath).run();
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Expense claim updated successfully.",
        exp_id: expId
      }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ success: false, message: "Route not found" }), { status: 404, headers });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500, headers });
  }
};
