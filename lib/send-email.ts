/**
 * Send a single email via Resend. Used for digest and other transactional mail.
 * Requires RESEND_API_KEY; optional RESEND_FROM, RESEND_REPLY_TO.
 */

const RESEND_API = "https://api.resend.com/emails";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const result = await sendEmailDetailed(to, subject, html);
  return result.ok;
}

export type BatchEmail = { to: string; subject: string; html: string; text?: string; headers?: Record<string, string> };

/** Resend batch API: up to 100 emails per call, each with its own HTML. Returns one result per input, in order. */
export async function sendEmailBatch(items: BatchEmail[]): Promise<Array<{ ok: true } | { ok: false; error: string }>> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return items.map(() => ({ ok: false as const, error: "RESEND_API_KEY is not configured on the server." }));
  if (items.length === 0) return [];
  if (items.length > 100) throw new Error("Resend batch accepts at most 100 emails per call.");
  const from = process.env.RESEND_FROM ?? "NovaStaris <onboarding@resend.dev>";
  const replyTo = process.env.RESEND_REPLY_TO?.trim() || undefined;
  try {
    const res = await fetch(`${RESEND_API}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(
        items.map((m) => ({ from, to: [m.to], reply_to: replyTo, subject: m.subject, html: m.html, text: m.text, headers: m.headers }))
      ),
    });
    if (!res.ok) {
      const err = (await res.text()).trim();
      let message = `Email provider error (${res.status}).`;
      try {
        const parsed = JSON.parse(err) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch {
        if (err) message = err.slice(0, 200);
      }
      console.error("Resend batch error:", res.status, message);
      return items.map(() => ({ ok: false as const, error: message }));
    }
    return items.map(() => ({ ok: true as const }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send email batch.";
    return items.map(() => ({ ok: false as const, error: message }));
  }
}

export async function sendEmailDetailed(
  to: string,
  subject: string,
  html: string,
  opts?: { headers?: Record<string, string> }
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
        headers: opts?.headers,
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
