/**
 * Send a single email via Resend. Used for digest and other transactional mail.
 * Requires RESEND_API_KEY; optional RESEND_FROM, RESEND_REPLY_TO.
 */

const RESEND_API = "https://api.resend.com/emails";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "NovaStaris <onboarding@resend.dev>";
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[dev] Email skipped (no RESEND_API_KEY):", subject);
    }
    return false;
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
        reply_to: process.env.RESEND_REPLY_TO ?? undefined,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Send email error:", e);
    return false;
  }
}
