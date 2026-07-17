"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendResetCodeEmail = sendResetCodeEmail;
/**
 * Transactional email via Resend (https://resend.com).
 *
 * Only needs the RESEND_API_KEY env var. Without it, sending is a no-op that
 * logs a warning — the app keeps working, the reset code just never leaves the
 * server (useful in local/dev). Set RESEND_FROM to a verified-domain sender
 * once a domain is configured; until then Resend's shared 'onboarding@resend.dev'
 * only delivers to the address that owns the Resend account.
 */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';
async function sendResetCodeEmail(to, code) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        console.warn(`[email] RESEND_API_KEY not set — reset code for ${to} is ${code} (not emailed).`);
        return false;
    }
    const from = process.env.RESEND_FROM || 'Priority Team Connect <onboarding@resend.dev>';
    const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <h2 style="color:#00408C;margin:0 0 12px">Priority Team Connect</h2>
      <p>We received a request to reset your password. Use this code:</p>
      <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#00408C;margin:18px 0">${code}</p>
      <p style="color:#555">This code expires in 15 minutes. If you didn't ask for it, you can ignore this email.</p>
    </div>`;
    try {
        const res = await fetch(RESEND_ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, subject: 'Your password reset code', html }),
        });
        if (!res.ok) {
            console.error('[email] Resend rejected the request:', res.status, await res.text().catch(() => ''));
            return false;
        }
        return true;
    }
    catch (e) {
        console.error('[email] send failed:', e?.message || e);
        return false;
    }
}
//# sourceMappingURL=email.js.map