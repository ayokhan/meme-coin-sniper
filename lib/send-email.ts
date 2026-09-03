/**
 * Send a single email via Resend. Used for digest and other transactional mail.
 * Requires RESEND_API_KEY; optional RESEND_FROM, RESEND_REPLY_TO.
 */

const RESEND_API = "https://api.resend.com/emails";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const result = await sendEmailDetailed(to, subject, html);
  return result.ok;
}

export async function sendEmailDetailed(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "NovaStaris <onboarding@resend.dev>";
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[dev] Email skipped (no RESEND_API_KEY):", subject);
    }
    return { ok: false, error: "RESEND_API_KEY is not configured on the server." };
  }
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: process.env.RESEND_REPLY_TO?.trim() || undefined,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", res.status, err);
      let message = `Email provider error (${res.status}).`;
      try {
        const parsed = JSON.parse(err) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (err.trim()) message = err.trim().slice(0, 200);
      }
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (e) {
    console.error("Send email error:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." };
  }
}
