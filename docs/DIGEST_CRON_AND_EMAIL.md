# Perp digest / Daily Futures Wrap: when it runs and where email comes from

## Where does the Morning Futures Brief come from?

**Auto-generated once per day** (no per-user AI, no scraping loop):

1. Vercel Cron hits `/api/cron` at **00:00 UTC**.
2. That calls `/api/cron/perp-digest`, which:
   - Pulls live Hyperliquid perp data (majors, momentum, funding, new listings)
   - Builds **Hot Topics** + **Market Updates**
   - **Upserts** a `FuturesDailyWrap` row for today’s UTC date
   - Sends Telegram + Morning Futures Brief email

In-app **Crypto Futures → Daily Wrap** only **reads** the stored row (cheap).

## When does the digest run?

- **Vercel Cron** in `vercel.json`: path `/api/cron`, schedule **`0 0 * * *`** = **once per day at 00:00 UTC**.
- Master switch: **Admin → Feature flags → “Vercel scheduled cron (master)”** (`vercel_cron_enabled`).
  - When **OFF**, `/api/cron` returns `skipped: true` and the wrap is **not** built.
  - When **ON**, the full chain runs (including perp digest / Daily Wrap).

How to confirm cron is on:

1. **Admin → Feature flags** — ensure **Vercel scheduled cron (master)** is ON.
2. **Vercel Dashboard → Project → Settings → Cron Jobs** — `/api/cron` should be listed (`0 0 * * *`).
3. After midnight UTC (or a manual trigger), check **Crypto Futures → Daily Wrap** for today’s entry, or `DIGEST_EMAIL_TO` inbox for “Morning Futures Brief”.

## Where does the email come from?

- **Provider:** Resend (`RESEND_API_KEY`, `RESEND_FROM`).
- **Subject:** `Morning Futures Brief | <date>`
- **Who receives it:**
  1. **`DIGEST_EMAIL_TO`** — full wrap HTML
  2. **Newsletter subscribers** — if feature flag **“Send digest to newsletter subscribers”** is ON — teaser HTML with CTA into the app

Manual send: **Admin → Emails → preset “Morning Futures Brief”**.

## How to test without waiting for midnight UTC

```http
GET https://your-production-url.vercel.app/api/cron/perp-digest
Authorization: Bearer YOUR_CRON_SECRET
```

Or trigger the full master cron: `GET /api/cron` with the same header.
