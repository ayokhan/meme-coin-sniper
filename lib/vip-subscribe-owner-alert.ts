import { sendEmailDetailed } from "@/lib/send-email";
import { getStoreOwnerAlertEmails } from "@/lib/nova-store/owner-alert-email";
import { buildNovaBrandedEmailHtml } from "@/lib/announcement-email";
import { isVipStrategySessionPromoActive } from "@/lib/vip-strategy-session-promo";
import { prisma } from "@/lib/db";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Email owner(s) when a paid VIP subscription is newly activated (not trial).
 * Call only after a successful create / trial→paid transition (avoid webhook spam).
 */
export async function sendVipSubscribeOwnerAlert(args: {
  userId: string;
  planId: string;
  amountUsd: number;
  paymentMethod: "card" | "usdc";
  stripeSessionId?: string | null;
  subscriptionId?: string | null;
}): Promise<{ ok: true; sent: number; skipped?: string } | { ok: false; error: string }> {
  const promoOn = await isVipStrategySessionPromoActive();
  if (!promoOn) {
    return { ok: true, sent: 0, skipped: "promo_off" };
  }

  const recipients = getStoreOwnerAlertEmails();
  if (recipients.length === 0) {
    return { ok: false, error: "OWNER_EMAIL is not configured." };
  }

  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { email: true, name: true },
  });
  const email = user?.email ?? "(no email)";
  const name = (user?.name ?? "").trim() || "—";

  const body = `New paid VIP — strategy session promo

Name: ${name}
Email: ${email}
Plan: ${args.planId}
Amount: $${args.amountUsd} USD
Payment: ${args.paymentMethod}
${args.stripeSessionId ? `Stripe session: ${args.stripeSessionId}` : ""}
${args.subscriptionId ? `Subscription: ${args.subscriptionId}` : ""}

Next steps
1. Email the customer available times for their free 30-min strategy session (Admin → Emails → VIP strategy session — book slot).
2. They should book within 7 days of subscription.
3. After the session, they may cancel within 3 days for a 100% satisfaction refund (see Payment Terms).`;

  const html = buildNovaBrandedEmailHtml({
    body,
    eyebrow: "VIP promo alert",
    ctaLabel: "Open Admin Emails",
    ctaUrl: "https://novastaris.ai/admin/emails?preset=vip-strategy-session-booking",
  });

  const subject = `New VIP + strategy session — ${email}`;
  let sent = 0;
  let lastError = "";
  for (const to of recipients) {
    const result = await sendEmailDetailed(to, subject, html);
    if (result.ok) sent += 1;
    else lastError = result.error;
  }

  if (sent === 0) {
    return { ok: false, error: lastError || "Failed to send owner alert." };
  }

  // Light audit in server logs (customer PII already known to owner inbox).
  console.info("VIP subscribe owner alert sent", {
    userId: args.userId,
    email: escapeHtml(email),
    planId: args.planId,
    sent,
  });

  return { ok: true, sent };
}
