# Perp digest: when it runs and where email comes from

## When does the digest run?

The **perp digest** (Telegram + email) is sent only when the **main cron** runs:

- **Vercel Cron** is configured in `vercel.json`: path `/api/cron`, schedule **`0 0 * * *`** = **once per day at 00:00 UTC** (midnight UTC).
- The main cron (`/api/cron`) calls `/api/cron/perp-digest`, which builds the digest, sends to Telegram, then sends email to `DIGEST_EMAIL_TO` and (if the feature flag is on) to newsletter subscribers.

So you will see at most **one digest per day**, shortly after midnight UTC. If you’re in a different timezone, that can be evening or early morning local time.

## Where does the email come from?

- **Provider:** All digest (and other app) emails are sent via **Resend** (https://resend.com).
- **“From” address:** Set by the **`RESEND_FROM`** env var in Vercel (e.g. `NovaStaris <noreply@yourdomain.com>` or, if you don’t set it, the default `NovaStaris <onboarding@resend.dev>`).  
  Resend usually requires a **verified domain** for custom “from” addresses; a plain Gmail address may be rejected.
- **Who receives the digest email:**
  1. **Fixed list:** Every address in **`DIGEST_EMAIL_TO`** (comma-separated), e.g. `novastaris.ai@gmail.com`.
  2. **Newsletter subscribers:** If the admin feature flag **“Send digest to newsletter subscribers”** is ON, every user with `newsletterOptIn: true` and an email also receives the digest.

## Why might no message be sent?

1. **Cron hasn’t run yet** — It only runs at 00:00 UTC each day.
2. **CRON_SECRET** — Must be set in Vercel. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` to `/api/cron`. If it’s missing or wrong, the cron returns 401 and the digest is never called.
3. **Telegram** — `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` must be set in Vercel; otherwise the Telegram send fails or is skipped.
4. **Email** — `RESEND_API_KEY` must be set. If `DIGEST_EMAIL_TO` is empty and the “newsletter subscribers” flag is OFF (or there are no subscribers), no digest email is sent. If `RESEND_FROM` is a Gmail address, Resend may reject it; use their default or a verified domain.

## How to test without waiting for midnight UTC

- Call the digest endpoint manually with the same auth Vercel uses:
  - `GET https://your-production-url.vercel.app/api/cron/perp-digest`
  - Header: `Authorization: Bearer YOUR_CRON_SECRET`
- Or trigger the full cron: `GET https://your-production-url.vercel.app/api/cron` with the same header (this runs the digest plus other cron jobs).
