# NovaStaris (meme-coin-sniper) — Implementation & Tech Stack

This document describes the **current implementation** of **NovaStaris** (novastaris.ai): technologies, programming languages, data sources, external APIs, and main parts of the codebase, including **App Insights**.

---

## 1. Project overview

- **Purpose:** Discover new and trending meme coins on **Solana** and **BSC** (Binance Smart Chain), track “smart money” wallets, get alerts when multiple tracked wallets buy the same token, analyze tokens with AI (Solana and BSC; BSC AI Analysis is Pro/VIP only), **Crypto Futures** tools, and (owner-only) view app insights (visitor location, device, and pages).
- **Deployment:** Vercel (production), with optional Cron for Telegram alerts.
- **Database:** PostgreSQL (e.g. Supabase), accessed via Prisma.
- **Programming language:** TypeScript (app and API); Node.js on the server.

---

## 2. Programming languages & runtime

| Language / runtime | Where it’s used |
|--------------------|-----------------|
| **TypeScript**     | Entire app: Next.js pages, API routes, `lib/` helpers. |
| **JavaScript (ES6+)** | Config files (e.g. `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`). |
| **Node.js**        | Server-side: API routes, Prisma, server auth, cron. |
| **TSConfig**       | `tsconfig.json` — strict TypeScript for the app. |

---

## 3. Core framework & libraries

| Technology | Version (approx.) | Role |
|------------|-------------------|------|
| **Next.js** | 16.x | React framework: App Router, API routes, SSR, static generation. |
| **React**   | 19.x | UI components and dashboard (e.g. `app/page.tsx`). |
| **Prisma**  | 6.x  | ORM for PostgreSQL: schema, migrations, `prisma/schema.prisma`. |
| **NextAuth.js** | 4.x | Auth: email/password + Solana wallet login, session, `lib/auth.ts`. |
| **Tailwind CSS** | 4.x | Styling: utility classes, dark/light theme. |
| **Radix UI** (via shadcn-style) | — | Tabs, slots, accessible components in `components/ui/`. |
| **Lucide React** | — | Icons (e.g. Zap, etc.). |
| **Axios**   | 1.x  | HTTP client for external APIs (Moralis, Birdeye, DexScreener, etc.). |
| **ws**      | 8.x  | WebSockets (e.g. DexScreener live pairs in `lib/api-clients/dexscreener.ts`). |

---

## 4. External APIs and services

### 4.1 Blockchain & token data

| API / service | Env variable | Purpose |
|---------------|--------------|---------|
| **Moralis** (Solana) | `MORALIS_API_KEY` | New Pump.fun tokens; wallet swap history (buys). Used for “new pairs” and Wallet Tracker. [Docs](https://docs.moralis.com/web3-data-api/solana). |
| **Helius** | `HELIUS_API_KEY` | Enhanced transactions API: wallet buys (SWAP/BUY). Fallback for Wallet Tracker when Moralis isn’t used. [Docs](https://docs.helius.dev). |
| **Birdeye** | `BIRDEYE_API_KEY` | New listings, wallet `tx_list` (buys), token search. New pairs + Wallet Tracker fallback. [Docs](https://docs.birdeye.so). |
| **DexScreener** | (no key required for public endpoints) | Pairs search, token/pair details, liquidity, volume. Main source for surge/trending and token metadata. |
| **GoPlus (GoPlusLabs)** | (public, no key) | Token security: honeypot, mintability, holder concentration. `lib/api-clients/goplus.ts` (and `lib/lib/api-clients/goplus.ts`). |

### 4.2 Social & CT (Crypto Twitter)

| API / service | Env variable | Purpose |
|---------------|--------------|---------|
| **Apify (Tweet Scraper)** | `APIFY_API_TOKEN` | Scrape tweets from configured CT accounts for “CT Scan” and token mentions. Actor: `apidojo/tweet-scraper`. |
| **Anthropic (Claude)** | `ANTHROPIC_API_KEY` | NovaStaris AI Analysis of tokens and futures (viral score, sentiment, recommendations). `lib/ai-analyze.ts`, `lib/ai-analyze-futures.ts`. |

### 4.3 Notifications & auth

| API / service | Env variable | Purpose |
|---------------|--------------|---------|
| **Telegram Bot API** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Send Wallet Tracker alerts when N+ tracked wallets buy the same token. `lib/telegram.ts`. |
| **NextAuth** | `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Session and auth. Owner check via `OWNER_EMAIL`. |
| **Solana RPC** | `SOLANA_RPC_URL` or `HELIUS_API_KEY` | Verify subscription payments on-chain. `lib/verify-solana-payment.ts`. |

### 4.4 Database & deployment

| Service | Env variable | Purpose |
|---------|--------------|---------|
| **PostgreSQL** (e.g. Supabase) | `DATABASE_URL` | Prisma datasource; all app data (users, tokens, subscriptions, wallet tracker config, etc.). |
| **Vercel** | (project env) | Hosting, serverless functions, Cron (e.g. daily `/api/cron`). |

---

## 5. Environment variables summary

Set these in Vercel (or `.env.local` for local dev):

- **Auth:** `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OWNER_EMAIL` (optional, comma-separated for owner access).
- **Database:** `DATABASE_URL`.
- **Wallet Tracker / tokens:** `MORALIS_API_KEY`, `HELIUS_API_KEY` (optional), `BIRDEYE_API_KEY` (optional).
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- **CT Scan:** `APIFY_API_TOKEN`.
- **AI:** `ANTHROPIC_API_KEY`.
- **Payments / RPC:** `SOLANA_RPC_URL` or `HELIUS_API_KEY` (reused for RPC if needed).
- **Trading bot (Blofin):** `BLOFIN_API_KEY`, `BLOFIN_SECRET_KEY`, `BLOFIN_PASSPHRASE`; optional: `BLOFIN_DEMO_MODE` (true/false), `BLOFIN_BROKER_ID` (required if your API key is a broker/partner key).
- **Trading bot (Hyperliquid):** `HYPERLIQUID_PRIVATE_KEY` (wallet private key, 0x…); optional: `HYPERLIQUID_TESTNET` (true for testnet).
- **Trading bot (KuCoin Futures):** `KUCOIN_FUTURES_API_KEY`, `KUCOIN_FUTURES_SECRET`, `KUCOIN_FUTURES_PASSPHRASE` (create a Futures API key with Trade permission at KuCoin).

### 4.5 Crypto Futures bot — Blofin, Hyperliquid, KuCoin (Canada)

The Trading Bot supports three **providers**: **KuCoin Futures** (default), **Blofin**, and **Hyperliquid**. **Ontario:** KuCoin and Hyperliquid are restricted there; use **Blofin**.

| Provider | API? | Canada / Ontario | Note |
|----------|------|-------------------|------|
| **Kraken** | Yes (Kraken Futures API) | **No** — Kraken Futures is not available to clients in Canada. | Trusted brand; use Kraken for spot/margin in Canada, not perps. |
| **KuCoin Futures** | Yes. Full REST: klines, ticker, positions, leverage, place order. | **Not available in Ontario.** Restricted in Ontario (and some other regions). | Default for non‑Ontario users. Use Blofin if you are in Ontario. |
| **Blofin** | Yes. API key + secret + passphrase; optional broker ID. | Not listed as restricted; 150+ countries. | Use while waiting for Blofin broker/transaction API if needed. |
| **Hyperliquid** | Yes. Wallet-signed (EIP-712); no broker ID. | **Restricted** in some jurisdictions (user may see “restricted jurisdiction” banner). | Good where allowed; avoid from restricted regions. |

**Implementation:** Choose **provider** in the Trading Bot tab (KuCoin, Blofin, or Hyperliquid). Set the corresponding env vars; the bot uses the same strategies (simple, indicators, AI, hybrid) and places orders via the selected API. See `lib/kucoin-futures.ts`, `lib/blofin.ts`, `lib/hyperliquid.ts`, and `lib/trading-bot-run.ts`.

---

## 6. App Insights (owner-only analytics)

App Insights gives the owner a dashboard of where visitors are from, what device they use, and which pages they view. Only users whose email (or wallet) matches `OWNER_EMAIL` or `OWNER_WALLET_ADDRESSES` can access it. The **Status** page (`/status`) and **Status** button in the header are also owner-only; the API `/api/status` returns 403 for non-owners.

### 6.1 Data source and technology

| Item | Detail |
|------|--------|
| **Data store** | PostgreSQL via Prisma; table `AnalyticsEvent`. |
| **Location/city** | From request headers: **Vercel** (`x-vercel-ip-country`, `x-vercel-ip-city`) or **Cloudflare** (`cf-ipcountry`, `cf-ipcity`). City is only set on deployed Vercel requests, not locally. |
| **Device / browser / OS** | From `User-Agent` header, parsed in-app with **no external service** (`lib/ua-parse.ts`: regex-based, returns `deviceType`, `browser`, `os`). |
| **Page (path)** | Sent by the client on each route change (pathname). |

### 6.2 Flow

1. **Recording:** A client component (`components/AnalyticsPing.tsx`) runs on every page; on mount and when the path changes it sends one **POST** to `/api/analytics` with `{ path: pathname }`. No auth required.
2. **API** (`app/api/analytics/route.ts`): Reads path from body; country/city from headers; parses User-Agent via `parseUserAgent()`; optionally attaches `userId` from session; writes one row to `AnalyticsEvent`.
3. **Insights API** (`app/api/admin/insights/route.ts`): **GET**, guarded by `isOwnerSession()`. Query param `days` (1–90, default 30). Loads up to 50k events from DB, then aggregates in memory into: `byCountry`, `byCity` (labels like "City, Country"), `byDevice`, `byPath`, `byBrowser`, `byOs`. Returns JSON.
4. **UI** (`app/admin/insights/page.tsx`): Owner signs in → fetches `/api/admin/insights?days=...` → shows total page views and tables: By country, By city, By device, By page (path), By browser, By OS. Links to Customers and Wallet Tracker.

### 6.3 Relevant files

| Path | Purpose |
|------|--------|
| `prisma/schema.prisma` | Model `AnalyticsEvent`: `path`, `country`, `city`, `deviceType`, `browser`, `os`, `userId`, `createdAt`. |
| `lib/ua-parse.ts` | `parseUserAgent(ua)` → `{ deviceType, browser, os }` (no deps). |
| `app/api/analytics/route.ts` | POST: record one page view. |
| `app/api/admin/insights/route.ts` | GET: owner-only aggregated insights. |
| `app/admin/insights/page.tsx` | Owner-only App Insights dashboard UI. |
| `components/AnalyticsPing.tsx` | Client: pings POST `/api/analytics` on path change (used in `components/providers.tsx`). |

---

## 7. Main directories and files

| Path | Description |
|------|-------------|
| `app/page.tsx` | Main dashboard: tabs (New, Trending, Surge, CT, Wallets, etc.), wallet alerts table, live trades, NovaStaris AI Analysis UI. |
| `app/api/*` | Next.js API routes (REST). |
| `app/api/analytics/route.ts` | POST: record page view (path, country, city, device, browser, OS). |
| `app/api/admin/insights/route.ts` | GET: owner-only aggregated App Insights (by country, city, device, path, browser, OS). |
| `app/admin/insights/page.tsx` | Owner-only App Insights dashboard (tables + timeframe selector). |
| `app/api/wallet-tracker/route.ts` | GET wallet alerts (and `minBuyers` from rules). |
| `app/api/wallet-tracker/trades/route.ts` | GET live trades from tracked wallets (Moralis → Helius → Birdeye). |
| `app/api/wallet-tracker/notify/route.ts` | Called by cron; sends alerts to Telegram, uses `WalletAlertSent` for dedupe. |
| `app/api/cron/route.ts` | Vercel Cron entrypoint; triggers wallet-tracker notify. |
| `app/api/new-pairs/route.ts` | New pairs from DexScreener, Birdeye, Moralis (Pump.fun). |
| `app/api/scan/route.ts` | Scan and save tokens (Birdeye/Moralis/DexScreener) into DB. |
| `app/api/ct-tweets/route.ts` | CT tweets via Apify. |
| `app/api/ai-analyze/route.ts`, `app/api/ai-analyze-futures/route.ts` | AI token (Solana) and futures analysis (Anthropic). |
| `app/api/ai-analyze-bsc/route.ts` | BSC token AI analysis (Anthropic); Pro/VIP only. |
| `app/api/new-pairs-bsc/route.ts`, `app/api/trending-bsc/route.ts` | BSC new pairs and trending (DexScreener). |
| `lib/get-wallet-alerts.ts` | Core logic: which tokens have ≥ `minBuyers` tracked wallets that bought; returns alerts + `latestBuyAt`. |
| `lib/wallet-tracker-config.ts` | Tracked wallets and alert rules from DB (with fallback to `lib/config/ct-wallets.ts`). |
| `lib/telegram.ts` | Send wallet alerts to Telegram. |
| `lib/api-clients/moralis.ts` | Moralis: new Pump.fun tokens, wallet swaps (buys). |
| `lib/api-clients/helius.ts` | Helius: wallet transactions and token buys. |
| `lib/api-clients/birdeye.ts` | Birdeye: new listings, wallet tx list, search. |
| `lib/api-clients/dexscreener.ts` | DexScreener: search, token by mint, WebSocket pairs. |
| `lib/api-clients/goplus.ts` | GoPlus: token security checks. |
| `lib/api-clients/twitter.ts` | Apify tweet scraper + optional Anthropic for CT. |
| `lib/ai-analyze.ts`, `lib/ai-analyze-futures.ts`, `lib/ai-analyze-bsc.ts` | Claude prompts and scoring for Solana tokens, BSC tokens, and futures. |
| `lib/auth.ts`, `lib/auth-server.ts` | NextAuth config and server-side session/subscription checks. |
| `lib/ua-parse.ts` | User-Agent parsing for App Insights (device, browser, OS; no deps). |
| `lib/verify-solana-payment.ts` | Solana payment verification for subscriptions. |
| `components/AnalyticsPing.tsx` | Client: sends POST `/api/analytics` on path change (included in `components/providers.tsx`). |
| `prisma/schema.prisma` | Data models: User, Token, Subscription, TrackedWallet, AlertRule, WalletAlertSent, PinnedToken, AnalyticsEvent, etc. |
| `vercel.json` | Cron schedule (e.g. `0 0 * * *` = daily) for `/api/cron`. |

---

## 7b. API routes reference (complete list)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/account/profile` | GET, PATCH | Session | Get or update user profile (name, phone, country, experience). |
| `/api/analytics` | POST | — | Record page view (path, geo, device); used by AnalyticsPing. |
| `/api/auth/[...nextauth]` | * | — | NextAuth.js handlers (sign in, sign out, session). |
| `/api/auth/change-password` | POST | Session | Change password (current + new); email/password users only. |
| `/api/auth/forgot-password` | POST | — | Request password reset; creates token, sends email via Resend. |
| `/api/auth/register` | POST | — | Create account (email, password, optional name/phone/country). |
| `/api/auth/reset-password` | POST | — | Set new password with token from email. |
| `/api/auth/nonce` | GET | — | Nonce for Solana wallet sign-in. |
| `/api/auth/wallet-login` | POST | — | Wallet signature verification and session. |
| `/api/status` | GET | Owner | Health check for DexScreener, Moralis; owner-only. |
| `/api/new-pairs` | GET | — | New Solana pairs (DexScreener, Birdeye, Moralis Pump.fun). |
| `/api/new-pairs-bsc` | GET | — | New BSC pairs (DexScreener). |
| `/api/trending` | GET | — | Trending Solana tokens (DexScreener). |
| `/api/trending-bsc` | GET | — | Trending BSC tokens. |
| `/api/surge` | GET | — | Surge / volume spike tokens (DexScreener). |
| `/api/tokens` | GET | — | Tokens from DB (e.g. scan results). |
| `/api/scan` | POST | — | Scan and persist tokens (Birdeye/Moralis/DexScreener). |
| `/api/scan-twitter` | POST | — | Trigger CT Scan (Apify tweet scraper). |
| `/api/ct-tweets` | GET | — | CT tweets (Apify). |
| `/api/ct-accounts` | GET, PATCH | Owner | CT accounts list for scan. |
| `/api/ct-wallets` | GET | — | CT wallet config (for UI). |
| `/api/ai-analyze` | POST | — | NovaStaris AI Analysis (Solana token; Claude). |
| `/api/ai-analyze-bsc` | POST | Session (Pro/VIP) | BSC token AI analysis (Claude). |
| `/api/ai-analyze-futures` | POST | — | Crypto futures AI analysis (Claude). |
| `/api/pins` | GET, POST, DELETE | Session | Pinned tokens (watchlist, re-analysis). |
| `/api/pins/refresh` | POST | Session | Refresh pinned token analyses. |
| `/api/subscription` | GET, POST | Session | Subscription status, plans, verify Solana payment. |
| `/api/support` | POST | — | Submit support ticket (form). |
| `/api/chat/session` | GET, POST | — | Get or create chat session. |
| `/api/chat/message` | POST | — | Send chat message. |
| `/api/chat/messages` | GET | — | Get messages for session. |
| `/api/chat/presence` | POST | Owner | Ping agent presence (live indicator). |
| `/api/chat/request-live` | POST | — | Request live agent. |
| `/api/coach-calls` | GET | Session (VIP) | Coach Calls (CA / call alerts). |
| `/api/telegram-id` | GET, POST | Session | User Telegram ID for Coach Calls; owner can list. |
| `/api/wallet-tracker` | GET | — | Wallet Tracker alerts (tokens with ≥ N tracked wallet buys). |
| `/api/wallet-tracker/trades` | GET | — | Live trades from tracked wallets. |
| `/api/wallet-tracker/notify` | POST | — | Called by cron; send alerts to Telegram, dedupe. |
| `/api/wallet-tracker/first-buy` | GET | Session | First-buy alerts (tracked wallet bought token first time). |
| `/api/cron` | GET | Vercel Cron | Entrypoint; calls wallet-tracker notify. |
| `/api/admin/insights` | GET | Owner | App Insights aggregates (country, city, device, path, etc.). |
| `/api/admin/customers` | GET | Owner | List users and subscription status. |
| `/api/admin/customers/[userId]` | GET, DELETE | Owner | Customer detail or delete. |
| `/api/admin/support` | GET, PATCH | Owner | Support tickets list and status updates. |
| `/api/admin/feature-flags` | GET, PATCH | Owner | Feature toggles (Moralis, Telegram, etc.). |
| `/api/admin/ai-feedback` | GET, POST | Owner | AI analysis feedback (good/bad) for model improvement. |
| `/api/admin/chat/sessions` | GET, PATCH | Owner | Chat sessions (NJA/live). |
| `/api/admin/chat/message` | POST | Owner | Send message as agent. |
| `/api/admin/wallet-tracker/wallets` | GET, POST, DELETE | Owner | Tracked wallets CRUD. |
| `/api/admin/wallet-tracker/rules` | GET, PATCH | Owner | Alert rules (minBuyers, maxAgeHours, maxAlerts). |
| `/api/admin/wallet-tracker/first-buy-rules` | GET, PATCH | Owner | First-buy alert rules. |
| `/api/admin/wallet-tracker/import-config` | POST | Owner | Import wallet config. |
| `/api/admin/wallet-tracker/seed` | POST | Owner | Seed default wallets. |
| `/api/admin/trading-bot` | GET, PATCH | Owner | Trading bot config (provider, symbol, strategy, etc.). |
| `/api/admin/trading-bot/run` | POST | Owner | Run trading bot (manual trigger). |
| `/api/admin/solana-bot/quote` | GET | Owner | Solana bot quote (if used). |
| `/api/test-db` | GET | — | Test DB connection. |
| `/api/test-dexscreener` | GET | — | Test DexScreener. |
| `/api/test-moralis` | GET | — | Test Moralis. |
| `/api/test-twitter` | GET | — | Test Twitter/Apify. |

---

## 8. Data flow (high level)

- **New/trending/surge tokens:** DexScreener (and optionally Birdeye/Moralis) → aggregate in API routes → dashboard.
- **Wallet Tracker alerts:** Tracked wallets from DB → Moralis/Helius/Birdeye for recent buys → group by mint → filter by `minBuyers`/`maxAgeHours`/`maxAlerts` from `AlertRule` → return alerts with `latestBuyAt`; cron calls notify → Telegram + `WalletAlertSent` dedupe.
- **CT Scan:** Apify scrapes tweets from configured accounts → tokens mentioned → stored/displayed.
- **NovaStaris AI Analysis:** Solana or BSC token metadata + optional context → Anthropic Claude → viral score, signal, recommendations. BSC AI Analysis is Pro/VIP only. BSC tab (Go Hunting: New pairs, Final Stretch, Migrated, Trending) is available to all users.
- **App Insights:** Client sends path on navigation → POST `/api/analytics` → server adds country/city (Vercel/Cloudflare headers), device/browser/OS (User-Agent via `lib/ua-parse.ts`) → stored in `AnalyticsEvent`. Owner fetches GET `/api/admin/insights` → aggregated by country, city, device, path, browser, OS → dashboard at `/admin/insights`.

---

## 9. Cron and background jobs

- **Vercel Cron** (see `vercel.json`): one job that hits `/api/cron` (e.g. daily on Hobby plan).
- **Cron handler:** Calls `/api/wallet-tracker/notify` to send new wallet alerts to Telegram and record them in `WalletAlertSent`.

---

## 10. Theme, account, and password reset

- **Theme:** Light / Dark / System only (flap-style selector with “Theme” label in header). Implemented in `components/theme-provider.tsx` and `app/page.tsx`; no “Money” theme.
- **Account:** `/account` (link in header when signed in). Update profile (name, phone, country, experience); change password for email/password users. APIs: `GET/PATCH /api/account/profile`, `POST /api/auth/change-password`.
- **Forgot password:** `/forgot-password` → request reset → email with link to `/reset-password?token=...`. APIs: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`. Tokens stored in `PasswordResetToken` (Prisma), expiry 1 hour.
- **Reset emails:** Sent via Resend when `RESEND_API_KEY` is set. In Vercel: Settings → Environment Variables → add `RESEND_API_KEY` (from [resend.com](https://resend.com) API Keys). Optional: `RESEND_FROM` (e.g. `NovaStaris <onboarding@resend.dev>` or your verified domain), `RESEND_REPLY_TO`. Without the key, reset flow still creates the token but no email is sent (dev logs the link).

---

## 11. Quick reference

| Topic | Summary |
|-------|--------|
| **Language** | TypeScript (app + API); Node.js server. |
| **Framework** | Next.js 16 (App Router), React 19. |
| **Database** | PostgreSQL (e.g. Supabase); Prisma ORM. |
| **Auth** | NextAuth.js (email/password + Solana wallet); owner via `OWNER_EMAIL` or `OWNER_WALLET_ADDRESSES`. Account: `/account`; forgot/reset password: Resend (`RESEND_API_KEY`). Status: owner-only. |
| **Data sources** | DexScreener, Moralis, Birdeye, Helius, GoPlus, Apify, Anthropic; Vercel/Cloudflare headers for App Insights geo. |
| **Hosting** | Vercel (serverless + Cron). |

---

## Related documents

| Document | Purpose |
|----------|---------|
| **PRD.md** | Product vision, goals, personas, features, user stories, success metrics. |
| **GO_TO_MARKET.md** | Go-to-market strategy: target market, positioning, pricing, channels, launch phases. |
| **JOBS_TO_BE_DONE.md** | Jobs to be done: When / I want to / So that for discovery, wallet tracking, AI, account, support, owner. |
| **AUTH_SETUP.md** | Auth setup: NextAuth, owner config, Resend for password reset. |

---

This file is the single place to look for current implementation: language, framework, data sources, APIs, and where things live in the NovaStaris codebase.
