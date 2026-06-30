# Stripe card payment – troubleshooting

## Do I need to configure subscription types in Stripe?

**No.** The app uses Stripe Checkout in **one-time payment** mode with **inline price data**. Plan names, amounts, and tiers (Pro/VIP) come from the app (PRO_PLANS and VIP_PLANS in code), not from Stripe Products or Prices. You only need:

- **Stripe Dashboard:** Create an account and get your **Secret key** and (for webhooks) **Webhook signing secret**.
- **Environment variables:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (see below).
- **Webhook:** In Stripe → Developers → Webhooks, add your endpoint and subscribe to **checkout.session.completed** (see below).

No need to create Products, Prices, or Subscriptions in Stripe for the current flow.

---

## Vercel env vars vs Stripe Dashboard (important)

| Where | What to set | Value |
|-------|-------------|--------|
| **Stripe Dashboard** → Developers → Webhooks → Add destination | **Endpoint URL** | `https://novastaris.ai/api/stripe/webhook` |
| **Stripe Dashboard** → same webhook → “Signing secret” (Reveal) | Copy the secret | Starts with `whsec_...` |
| **Vercel** → Project Settings → Environment Variables | `STRIPE_WEBHOOK_SECRET` | Paste the **signing secret** (`whsec_...`), **not** the URL |
| **Vercel** → same | `STRIPE_SECRET_KEY` | Your Stripe **Secret key** (`sk_live_...` or `sk_test_...`) |

- **STRIPE_WEBHOOK_SECRET** must be the **signing secret** from Stripe (e.g. `whsec_xxxxxxxx`). It is used to verify that webhook requests really come from Stripe. Do **not** put the webhook URL here.
- The **URL** `https://novastaris.ai/api/stripe/webhook` is only set **in Stripe** as the webhook “Destination” that Stripe will call.

---

## Where to add “checkout.session.completed”

You add it **in Stripe**, not in Vercel:

1. Go to **Stripe Dashboard** → **Developers** → **Webhooks**.
2. Click your webhook (e.g. “sophisticated-finesse”) that has destination `https://novastaris.ai/api/stripe/webhook`.
3. Under **“Events to send”** (or “Listening to”), click **“Add events”** or **“Update details”**.
4. Find and select **`checkout.session.completed`**.
5. Save. Stripe will then send that event to your endpoint when a customer completes payment.

---

## Customer paid but subscription not upgraded

1. **Check Stripe webhook**
   - In Stripe Dashboard → Developers → Webhooks, confirm the endpoint is your production URL: `https://novastaris.ai/api/stripe/webhook` (or your domain).
   - Ensure the event **checkout.session.completed** is selected.
   - Check "Recent deliveries" for failures (wrong secret, timeout, 4xx/5xx). Fix the endpoint or `STRIPE_WEBHOOK_SECRET` if needed.

2. **Manually grant the subscription (one-off fix)**
   - Go to **Admin → Customers**, find the customer by email.
   - Use the subscription action to **set** a subscription:
     - For **$20 (VIP 1-day trial)**: tier `vip`, planId `1day` ($20 card, no fee).
     - For **$70 (Pro 1 month)**: tier `pro`, planId `1month` ($78 card).
     - For **$150 (VIP 1 month)**: tier `vip`, planId `1month` ($158 card).
   - This uses the existing admin API `POST /api/admin/customers/[userId]/subscription` with body `{ "action": "set", "tier": "vip", "planId": "1day" }`.

3. **After code deploy**
   - The subscribe page now **polls** for up to 30 seconds after return from Stripe, so the subscription can appear even if the webhook is slightly delayed.
   - If the webhook was never received (e.g. wrong URL or secret), the subscription will still not be created; use step 2 to grant it and fix the webhook for future payments.
