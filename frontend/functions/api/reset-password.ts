interface Env {
  DB: D1Database;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), { 
      status: 405, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const data: any = await request.json();
    const { token, new_password } = data;

    if (!token || !new_password) {
      return new Response(JSON.stringify({ success: false, message: "Token and new password are required." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (!token.startsWith("TEMP_")) {
      return new Response(JSON.stringify({ success: false, message: "Invalid reset token format." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = token.replace("TEMP_", "").trim();
    
    // Validate password strength: minimum 8 characters, upper, lower, digit, special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(new_password)) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Password does not meet strength requirements. It must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)." 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const user: any = await env.DB.prepare(
      "SELECT user_id, is_temp_password FROM user WHERE user_id = ?"
    ).bind(userId).first();

    if (!user) {
      return new Response(JSON.stringify({ success: false, message: "User not found." }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (user.is_temp_password !== 1) {
      return new Response(JSON.stringify({ success: false, message: "Reset token is invalid or expired." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const salt = generateSalt();
    const hashedPassword = await hashPassword(new_password, salt);

    await env.DB.prepare(
      "UPDATE user SET password = ?, password_salt = ?, is_temp_password = 0, failed_attempts = 0, account_status = 'Active' WHERE user_id = ?"
    ).bind(hashedPassword, salt, userId).run();

    return new Response(JSON.stringify({ success: true, message: "Password updated successfully! You can now log in." }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, message: "Server Error: " + e.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
};
