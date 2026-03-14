# Stripe card payment – troubleshooting

## Customer paid but subscription not upgraded

1. **Check Stripe webhook**
   - In Stripe Dashboard → Developers → Webhooks, confirm the endpoint is your production URL: `https://novastaris.ai/api/stripe/webhook` (or your domain).
   - Ensure the event **checkout.session.completed** is selected.
   - Check "Recent deliveries" for failures (wrong secret, timeout, 4xx/5xx). Fix the endpoint or `STRIPE_WEBHOOK_SECRET` if needed.

2. **Manually grant the subscription (one-off fix)**
   - Go to **Admin → Customers**, find the customer by email.
   - Use the subscription action to **set** a subscription:
     - For **$10 (VIP 1-day trial)**: tier `vip`, planId `1day`.
     - For **$50 (Pro 1 month)**: tier `pro`, planId `1month`.
     - For **$150 (VIP 1 month)**: tier `vip`, planId `1month`.
   - This uses the existing admin API `POST /api/admin/customers/[userId]/subscription` with body `{ "action": "set", "tier": "vip", "planId": "1day" }`.

3. **After code deploy**
   - The subscribe page now **polls** for up to 30 seconds after return from Stripe, so the subscription can appear even if the webhook is slightly delayed.
   - If the webhook was never received (e.g. wrong URL or secret), the subscription will still not be created; use step 2 to grant it and fix the webhook for future payments.
