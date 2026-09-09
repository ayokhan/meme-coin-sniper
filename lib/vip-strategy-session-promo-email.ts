import {
  buildVipStrategySessionPromoCopy,
  DEFAULT_VIP_STRATEGY_SESSION_ENDS_ON,
  DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD,
  VIP_STRATEGY_SESSION_SUBSCRIBE_URL,
} from "@/lib/vip-strategy-session-promo";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const PAYMENT_TERMS_URL = `${APP_ORIGIN}/payment-terms`;

export function buildVipStrategySessionLaunchEmail(
  endsOnDate = DEFAULT_VIP_STRATEGY_SESSION_ENDS_ON,
  sessionListPriceUsd = DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD
) {
  const copy = buildVipStrategySessionPromoCopy(endsOnDate, sessionListPriceUsd);
  return {
    subject: `VIP through ${copy.endsShort}: $${copy.sessionListPriceUsd} strategy session free + satisfaction refund`,
    body: `Hi there,

Through ${copy.endsLabel}, every new VIP subscription includes a ${copy.sessionLengthMins}-minute strategy session with a NovaStaris coach — $${copy.sessionListPriceUsd} value, included free.

Value breakdown
• Strategy session (${copy.sessionLengthMins} min): $${copy.sessionListPriceUsd}
• With VIP this promo: $0
• You save: $${copy.sessionListPriceUsd}

How it works
1. Subscribe to VIP at novastaris.ai/subscribe
2. Book your strategy session within ${copy.bookWithinDays} days of subscription (we'll email you available times)
3. After your session, if you're not satisfied you can cancel VIP within ${copy.refundWithinDaysAfterSession} days for a 100% refund of the subscription fee

See Payment Terms for full details:
${PAYMENT_TERMS_URL}

See VIP plans:
${VIP_STRATEGY_SESSION_SUBSCRIBE_URL}

Questions? Use Chat or Support in the app at novastaris.ai — or reply to this email.

— The NovaStaris team
https://novastaris.ai`,
    ctaLabel: "See VIP plans",
    ctaUrl: VIP_STRATEGY_SESSION_SUBSCRIBE_URL,
  };
}

export function buildVipStrategySessionBookingEmail(
  endsOnDate = DEFAULT_VIP_STRATEGY_SESSION_ENDS_ON,
  sessionListPriceUsd = DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD
) {
  const copy = buildVipStrategySessionPromoCopy(endsOnDate, sessionListPriceUsd);
  return {
    subject: `Book your free ${copy.sessionLengthMins}-min VIP strategy session ($${copy.sessionListPriceUsd} value)`,
    body: `Hi {{FIRST_NAME}},

Thank you for going VIP — your subscription includes one ${copy.sessionLengthMins}-minute strategy session with a NovaStaris coach ($${copy.sessionListPriceUsd} value, included free with this promo).

Please reply with 2–3 time windows that work for you (include your timezone). We’ll confirm a slot.

Please book within ${copy.bookWithinDays} days of your VIP subscription.

After the session, if you’re not satisfied you may cancel VIP within ${copy.refundWithinDaysAfterSession} days for a 100% refund of the subscription fee. See Payment Terms for full details:
${PAYMENT_TERMS_URL}

Looking forward to working with you.

— Ayo Khan, MBA, PMP
Founder, NovaStaris
https://novastaris.ai`,
    ctaLabel: "Open NovaStaris",
    ctaUrl: APP_ORIGIN,
  };
}

/** Static defaults for preset registry (Admin reloads live copy when selecting the preset). */
export const VIP_STRATEGY_SESSION_LAUNCH_EMAIL = buildVipStrategySessionLaunchEmail();
export const VIP_STRATEGY_SESSION_BOOKING_EMAIL = buildVipStrategySessionBookingEmail();
