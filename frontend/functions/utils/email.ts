// frontend/functions/utils/email.ts

const DEFAULT_API_KEY = 're_i7WRWahS_GbcGT7C65PH4fkAvez4DyYiS';
const FROM_EMAIL = 'Sunil Bishnoi <noreply@sunilbishnoi.co.in>';

export async function sendResendEmail(to: string, subject: string, html: string, customApiKey?: string) {
  const apiKey = customApiKey || DEFAULT_API_KEY;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html
    })
  });
  
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend email failed: ${err}`);
  }
  return response.json();
}

export function getBaseTemplate(title: string, contentHtml: string): string {
  // Simple, clean template that renders well in all clients
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 30px; color: #333333; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
        <!-- Header -->
        <div style="background-color: #001f3f; padding: 25px; text-align: center; border-bottom: 2px solid #007bff;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">Cyrix Healthcare</h1>
          <p style="color: #c2c7d0; margin: 5px 0 0 0; font-size: 14px;">${title}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          ${contentHtml}
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #6c757d;">
          <p style="margin: 0 0 5px 0;">&copy; 2026 Cyrix Healthcare Pvt. Ltd. | Secure Enterprise Portal</p>
          <p style="margin: 0;">This is an automated system email. Please do not reply directly.</p>
        </div>
      </div>
    </div>
  `;
}

export function getOTPTemplate(fullName: string, otp: string, purpose: string): string {
  const content = `
    <p style="font-size: 15px; margin-top: 0;">Dear <b>${fullName}</b>,</p>
    <p style="font-size: 14px; color: #555555;">To complete your <b>${purpose}</b> verification request, please use the following security code:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <div style="display: inline-block; background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 15px 30px; border-radius: 8px;">
        <span style="font-size: 30px; font-weight: bold; color: #007bff; letter-spacing: 6px; font-family: monospace;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #6c757d; margin-top: 10px;">Valid for 5 minutes only. Do not share this code with anyone.</p>
    </div>
    
    <p style="font-size: 13px; color: #7f8c8d;">If you did not initiate this request, please contact the system administrator immediately.</p>
  `;
  return getBaseTemplate(purpose, content);
}

export function getUserCreatedTemplate(fullName: string, userId: string, plainPassword: string, role: string): string {
  // Build role-based instructions
  let roleManual = '';
  const roleLower = (role || '').toLowerCase();
  
  if (roleLower.includes('admin') || roleLower.includes('superadmin')) {
    roleManual = `
      <li><b>User Directory:</b> Add, edit, activate, lock, or delete user accounts.</li>
      <li><b>Profile Approvals:</b> Approve or reject personal detail updates requested by employees.</li>
      <li><b>Audit Logs:</b> View user tracking history and system errors for troubleshooting.</li>
    `;
  } else if (roleLower.includes('manager')) {
    roleManual = `
      <li><b>Approval Center:</b> Review expense claims and limit extension requests from your team. You can approve, reject, or edit details (requires a remark).</li>
      <li><b>Month Summary:</b> View and download consolidated reports of expenses.</li>
    `;
  } else if (roleLower.includes('coordinator')) {
    roleManual = `
      <li><b>Approval Center (L2):</b> Approve/reject claims escalated to Level 2. You can also override details with remarks.</li>
      <li><b>Month Summary:</b> Monitor team expense spreadsheets.</li>
    `;
  } else if (roleLower.includes('engineer')) {
    roleManual = `
      <li><b>Submit Claim:</b> Fill daily journey itineraries (locations, travel mode, km) and upload supporting bills.</li>
      <li><b>Dashboard:</b> View your personal claim status and approval progress.</li>
    `;
  } else {
    roleManual = `
      <li><b>Dashboard & Analytics:</b> Review and filter expenses and stats matching your role and district.</li>
    `;
  }

  const content = `
    <p style="font-size: 15px; margin-top: 0;">Dear <b>${fullName}</b>,</p>
    <p style="font-size: 14px; color: #555555;">Welcome to Cyrix Healthcare! An enterprise account has been created for you. Here are your credentials:</p>
    
    <div style="background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="padding: 5px 0; color: #6c757d; width: 35%;">User ID:</td>
          <td style="padding: 5px 0; font-weight: bold; color: #007bff;">${userId}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6c757d;">Temporary Password:</td>
          <td style="padding: 5px 0; font-weight: bold; font-family: monospace;">${plainPassword}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #6c757d;">Assigned Role:</td>
          <td style="padding: 5px 0; font-weight: bold;">${role}</td>
        </tr>
      </table>
    </div>
    
    <h3 style="font-size: 15px; color: #001f3f; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Your Role Quick Start Guide</h3>
    <ul style="font-size: 13px; color: #555555; padding-left: 20px; line-height: 1.8;">
      ${roleManual}
      <li><b>Profile:</b> Update personal details or change your password under My Profile.</li>
    </ul>

    <p style="font-size: 14px; font-weight: bold; text-align: center; margin: 30px 0;">
      <a href="https://cyrix-modern-app.pages.dev" style="background-color: #007bff; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Access Dashboard Portal</a>
    </p>
    
    <p style="font-size: 12px; color: #dc3545; font-weight: bold; background-color: #fff5f5; padding: 10px; border: 1px solid #fecaca; border-radius: 4px;">
      ⚠️ Security Rule: You will be required to change your temporary password immediately upon your first login before accessing dashboard data.
    </p>
  `;
  return getBaseTemplate("Welcome to Cyrix Healthcare", content);
}
