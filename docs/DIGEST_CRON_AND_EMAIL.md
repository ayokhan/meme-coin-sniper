# Perp digest / Daily Futures Wrap: when it runs and CPU

## Why you might not see content yet

1. Open the **Daily Wrap** top-level tab (`/?tab=daily-wrap`). Hard-refresh if needed.
2. Until the wrap cron runs once, the panel says “No wrap yet”.
3. **Master cron OFF does not block the wrap anymore** — wrap has its own light cron.

## CPU: does this increase usage?

**Barely**, if you keep the **heavy master cron OFF** and only enable the wrap cron:

| Job | When | Cost |
|-----|------|------|
| Master `/api/cron` | 00:00 UTC | Heavy (scans, wallets, bots…) — keep OFF to save CPU |
| **Daily Wrap** `/api/cron/perp-digest` | **00:05 UTC** | Light: ~1 Hyperliquid API call + DB upsert + optional emails |
| Emails `/api/cron/emails` | 00:15 UTC | Light VIP emails only |

Opening Daily Wrap in the app only **reads** stored JSON — no market fetch per visitor.

## Feature flags (Admin → Feature flags → “Vercel & usage”)

| Flag | Purpose |
|------|---------|
| **Daily Futures Wrap cron (lightweight)** (`futures_daily_wrap_cron`) | ON = build wrap daily. OFF = zero auto wrap CPU. **Default ON.** |
| **Send digest to newsletter subscribers** | ON = email teasers to opt-ins. OFF = only `DIGEST_EMAIL_TO` + Telegram. **Default OFF.** |
| **Vercel scheduled cron (master)** | Heavy chain — leave OFF for CPU. |

## Seed today without waiting

```http
GET https://novastaris.ai/api/cron/perp-digest
Authorization: Bearer <CRON_SECRET>
```

Requires `futures_daily_wrap_cron` ON.
