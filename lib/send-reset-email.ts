/**
 * Send password reset email. Uses Resend if RESEND_API_KEY is set.
 * Set RESEND_FROM (e.g. "NovaStaris <noreply@yourdomain.com>") and optionally RESEND_REPLY_TO.
 */

const RESEND_API = 'https://api.resend.com/emails';

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? 'NovaStaris <onboarding@resend.dev>';
  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[dev] Password reset link (configure RESEND_API_KEY to send email):', resetUrl);
    }
    return false;
  }
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: process.env.RESEND_REPLY_TO ?? undefined,
        subject: 'Reset your NovaStaris password',
        html: `
          <p>You requested a password reset for NovaStaris.</p>
          <p><a href="${resetUrl}">Reset your password</a></p>
          <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
        `,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Send reset email error:', e);
    return false;
  }
}
