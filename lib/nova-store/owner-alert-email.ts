import { sendEmailDetailed } from "@/lib/send-email";
import { formatStoreMoney } from "@/lib/nova-store/constants";
import { parseOrderItems } from "@/lib/nova-store/metrics";

/** Owner inboxes from OWNER_EMAIL (comma-separated), same as admin access. */
export function getStoreOwnerAlertEmails(): string[] {
  const raw = process.env.OWNER_EMAIL ?? "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatShipBlock(order: {
  shipName?: string | null;
  shipLine1?: string | null;
  shipLine2?: string | null;
  shipCity?: string | null;
  shipState?: string | null;
  shipPostal?: string | null;
  shipCountry?: string | null;
  shipPhone?: string | null;
}): string {
  const lines = [
    order.shipName,
    order.shipLine1,
    order.shipLine2,
    [order.shipCity, order.shipState, order.shipPostal].filter(Boolean).join(", "),
    order.shipCountry,
    order.shipPhone ? `Phone: ${order.shipPhone}` : null,
  ]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  if (lines.length === 0) return "<p style=\"color:#64748b;\">No shipping address on file.</p>";
  return `<p style="margin:0;white-space:pre-line;">${escapeHtml(lines.join("\n"))}</p>`;
}

/**
 * Email owner(s) when a Nova Store order becomes paid.
 * Safe to call only after a successful pending → paid transition (avoid webhook retries).
 */
export async function sendStoreOrderOwnerAlert(order: {
  id: string;
  email: string;
  totalCents: number;
  currency: string;
  itemsJson: unknown;
  shipName?: string | null;
  shipLine1?: string | null;
  shipLine2?: string | null;
  shipCity?: string | null;
  shipState?: string | null;
  shipPostal?: string | null;
  shipCountry?: string | null;
  shipPhone?: string | null;
}): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const recipients = getStoreOwnerAlertEmails();
  if (recipients.length === 0) {
    return { ok: false, error: "OWNER_EMAIL is not configured." };
  }

  const items = parseOrderItems(order.itemsJson);
  const lines = items
    .map(
      (i) =>
        `<li>${escapeHtml(i.productName)} — ${escapeHtml(i.variantLabel)} × ${i.quantity} (${escapeHtml(
          formatStoreMoney(i.unitPriceCents * i.quantity, order.currency)
        )})</li>`
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <p style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#0891b2;margin:0 0 8px;">Nova Store</p>
      <h1 style="font-size:22px;margin:0 0 16px;">New paid order</h1>
      <p style="margin:0 0 12px;"><strong>Customer:</strong> ${escapeHtml(order.email)}</p>
      <p style="margin:0 0 4px;font-weight:600;">Ship to</p>
      ${formatShipBlock(order)}
      <p style="margin:16px 0 4px;font-weight:600;">Items</p>
      <ul style="padding-left:18px;margin:0 0 16px;">${lines || "<li>See admin for details</li>"}</ul>
      <p style="color:#64748b;font-size:14px;">Total: ${escapeHtml(formatStoreMoney(order.totalCents, order.currency))}</p>
      <p style="margin-top:20px;"><a href="https://novastaris.ai/admin/nova-store" style="color:#0891b2;">Open Nova Store admin</a></p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Order ID: ${escapeHtml(order.id)}</p>
    </div>
  `;

  let sent = 0;
  let lastError = "";
  for (const to of recipients) {
    const result = await sendEmailDetailed(to, "Nova Store: new paid order", html);
    if (result.ok) sent += 1;
    else lastError = result.error;
  }

  if (sent === 0) {
    return { ok: false, error: lastError || "Failed to send owner alert." };
  }
  return { ok: true, sent };
}
