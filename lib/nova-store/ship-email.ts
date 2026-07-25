import { sendEmailDetailed } from "@/lib/send-email";
import { formatStoreMoney } from "@/lib/nova-store/constants";
import { parseOrderItems } from "@/lib/nova-store/metrics";

export async function sendStoreOrderShippedEmail(order: {
  email: string;
  shipName?: string | null;
  trackingNumber?: string | null;
  totalCents: number;
  currency: string;
  itemsJson: unknown;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const items = parseOrderItems(order.itemsJson);
  const lines = items
    .map(
      (i) =>
        `<li>${escapeHtml(i.productName)} (${escapeHtml(i.variantLabel)}) × ${i.quantity}</li>`
    )
    .join("");
  const greeting = order.shipName ? `Hi ${escapeHtml(order.shipName)},` : "Hi,";
  const tracking = order.trackingNumber?.trim()
    ? `<p style="margin:16px 0;"><strong>Tracking:</strong> ${escapeHtml(order.trackingNumber.trim())}</p>`
    : `<p style="margin:16px 0;color:#64748b;">Tracking details will follow if your carrier provides them.</p>`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <p style="font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#0891b2;margin:0 0 8px;">Nova Store</p>
      <h1 style="font-size:22px;margin:0 0 16px;">Your order is on its way</h1>
      <p>${greeting}</p>
      <p>Good news — your NovaStaris order has shipped from Canada.</p>
      ${tracking}
      <p style="margin:8px 0 4px;font-weight:600;">Items</p>
      <ul style="padding-left:18px;margin:0 0 16px;">${lines || "<li>Your Nova Store order</li>"}</ul>
      <p style="color:#64748b;font-size:14px;">Order total: ${escapeHtml(formatStoreMoney(order.totalCents, order.currency))}</p>
      <p style="margin-top:24px;">Thanks for supporting NovaStaris.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px;"><a href="https://novastaris.ai/?tab=nova-store" style="color:#0891b2;">novastaris.ai</a></p>
    </div>
  `;

  return sendEmailDetailed(order.email, "Your Nova Store order has shipped", html);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
