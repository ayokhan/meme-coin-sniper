import { sendEmailDetailed } from "@/lib/send-email";
import { getStoreOwnerAlertEmails } from "@/lib/nova-store/owner-alert-email";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Email owner(s) when a VIP requests Coach Calls (or other on-demand) access. */
export async function sendFeatureAccessRequestOwnerAlert(opts: {
  featureLabel: string;
  userName: string | null;
  userEmail: string | null;
  userId: string;
}): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const recipients = getStoreOwnerAlertEmails();
  if (recipients.length === 0) {
    return { ok: false, error: "OWNER_EMAIL is not configured." };
  }

  const who =
    opts.userEmail?.trim() ||
    opts.userName?.trim() ||
    opts.userId;
  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://novastaris.ai";
  const customersUrl = `${base}/admin/customers`;

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
      <h2 style="margin:0 0 12px;">${escapeHtml(opts.featureLabel)} access request</h2>
      <p style="margin:0 0 8px;"><strong>${escapeHtml(who)}</strong> requested access to <strong>${escapeHtml(opts.featureLabel)}</strong>.</p>
      <p style="margin:0 0 16px;color:#64748b;font-size:14px;">User id: ${escapeHtml(opts.userId)}</p>
      <p style="margin:0;">
        <a href="${escapeHtml(customersUrl)}" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">
          Open Customers to grant
        </a>
      </p>
    </div>
  `;

  let sent = 0;
  let lastError = "";
  for (const to of recipients) {
    const result = await sendEmailDetailed(
      to,
      `[NovaStaris] ${opts.featureLabel} access request — ${who}`,
      html
    );
    if (result.ok) sent += 1;
    else lastError = result.error;
  }

  if (sent === 0) {
    return { ok: false, error: lastError || "Failed to send owner alert." };
  }
  return { ok: true, sent };
}
