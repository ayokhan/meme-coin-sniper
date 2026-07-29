import { sendEmailDetailed } from "@/lib/send-email";
import { publicDemoUrl } from "@/lib/demo-sessions";

export type DemoConfirmationInput = {
  to: string;
  name: string;
  sessionTitle: string;
  slug: string;
  sessionAt: Date | null;
  timezone: string | null;
  locationNote: string | null;
  meetingUrl: string | null;
  /** Include meeting link now (typically yes for free; optional for paid until closer). */
  includeMeetingLink?: boolean;
  paid?: boolean;
  amountUsd?: number | null;
  pageEyebrow?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Auto confirmation after free register or successful Stripe payment. */
export async function sendDemoRegistrationConfirmation(
  input: DemoConfirmationInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const when = input.sessionAt
    ? input.sessionAt.toLocaleString("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: input.timezone || undefined,
      })
    : null;
  const whenLine = when
    ? `<p style="margin:0 0 12px;color:#3f3f46;"><strong>When:</strong> ${escapeHtml(when)}${
        input.timezone ? ` (${escapeHtml(input.timezone)})` : ""
      }</p>`
    : "";
  const locationLine = input.locationNote
    ? `<p style="margin:0 0 12px;color:#3f3f46;"><strong>Where:</strong> ${escapeHtml(input.locationNote)}</p>`
    : "";
  const paidLine =
    input.paid && input.amountUsd != null && input.amountUsd > 0
      ? `<p style="margin:0 0 12px;color:#3f3f46;"><strong>Payment:</strong> $${escapeHtml(
          input.amountUsd.toFixed(2)
        )} USD received via Stripe.</p>`
      : "";
  const meetingBlock =
    input.includeMeetingLink && input.meetingUrl
      ? `<p style="margin:16px 0 8px;color:#18181b;"><strong>Join link</strong></p>
         <p style="margin:0 0 16px;"><a href="${escapeHtml(input.meetingUrl)}" style="color:#d97706;">${escapeHtml(
           input.meetingUrl
         )}</a></p>`
      : `<p style="margin:16px 0;color:#71717a;">We'll email the meeting link closer to the session if it isn't included yet.</p>`;

  const eyebrow = (input.pageEyebrow || "Session registration").trim();
  const subject = `You're registered: ${input.sessionTitle}`;
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;color:#18181b;">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#a1a1aa;">${escapeHtml(eyebrow)}</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">You're registered</h1>
      <p style="margin:0 0 16px;color:#3f3f46;">Hi ${escapeHtml(input.name.split(" ")[0] || input.name)},</p>
      <p style="margin:0 0 16px;color:#3f3f46;">Thanks for registering for <strong>${escapeHtml(input.sessionTitle)}</strong>.</p>
      ${whenLine}
      ${locationLine}
      ${paidLine}
      ${meetingBlock}
      <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;">
        Session page: <a href="${publicDemoUrl(input.slug)}" style="color:#d97706;">${publicDemoUrl(input.slug)}</a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;">— NovaStaris</p>
    </div>
  `;

  return sendEmailDetailed(input.to, subject, html);
}
