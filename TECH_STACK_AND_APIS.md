# NovaStaris (meme-coin-sniper) — Tech Stack & APIs

This document describes the technologies, programming languages, external APIs, and main parts of the codebase for **NovaStaris** (novastaris.ai), a Solana meme-coin discovery and wallet-tracking dashboard.

---

## 1. Project overview

- **Purpose:** Discover new and trending Solana meme coins, track “smart money” wallets, get alerts when multiple tracked wallets buy the same token, and analyze tokens with AI.
- **Deployment:** Vercel (production), with optional Cron for Telegram alerts.
- **Database:** PostgreSQL (e.g. Supabase), accessed via Prisma.

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

---

## 6. Main directories and files

| Path | Description |
|------|-------------|
| `app/page.tsx` | Main dashboard: tabs (New, Trending, Surge, CT, Wallets, etc.), wallet alerts table, live trades, NovaStaris AI Analysis UI. |
| `app/api/*` | Next.js API routes (REST). |
| `app/api/wallet-tracker/route.ts` | GET wallet alerts (and `minBuyers` from rules). |
| `app/api/wallet-tracker/trades/route.ts` | GET live trades from tracked wallets (Moralis → Helius → Birdeye). |
| `app/api/wallet-tracker/notify/route.ts` | Called by cron; sends alerts to Telegram, uses `WalletAlertSent` for dedupe. |
| `app/api/cron/route.ts` | Vercel Cron entrypoint; triggers wallet-tracker notify. |
| `app/api/new-pairs/route.ts` | New pairs from DexScreener, Birdeye, Moralis (Pump.fun). |
| `app/api/scan/route.ts` | Scan and save tokens (Birdeye/Moralis/DexScreener) into DB. |
| `app/api/ct-tweets/route.ts` | CT tweets via Apify. |
| `app/api/ai-analyze/route.ts`, `app/api/ai-analyze-futures/route.ts` | AI token and futures analysis (Anthropic). |
| `lib/get-wallet-alerts.ts` | Core logic: which tokens have ≥ `minBuyers` tracked wallets that bought; returns alerts + `latestBuyAt`. |
| `lib/wallet-tracker-config.ts` | Tracked wallets and alert rules from DB (with fallback to `lib/config/ct-wallets.ts`). |
| `lib/telegram.ts` | Send wallet alerts to Telegram. |
| `lib/api-clients/moralis.ts` | Moralis: new Pump.fun tokens, wallet swaps (buys). |
| `lib/api-clients/helius.ts` | Helius: wallet transactions and token buys. |
| `lib/api-clients/birdeye.ts` | Birdeye: new listings, wallet tx list, search. |
| `lib/api-clients/dexscreener.ts` | DexScreener: search, token by mint, WebSocket pairs. |
| `lib/api-clients/goplus.ts` | GoPlus: token security checks. |
| `lib/api-clients/twitter.ts` | Apify tweet scraper + optional Anthropic for CT. |
| `lib/ai-analyze.ts`, `lib/ai-analyze-futures.ts` | Claude prompts and scoring for tokens/futures. |
| `lib/auth.ts`, `lib/auth-server.ts` | NextAuth config and server-side session/subscription checks. |
| `lib/verify-solana-payment.ts` | Solana payment verification for subscriptions. |
| `prisma/schema.prisma` | Data models: User, Token, Subscription, TrackedWallet, AlertRule, WalletAlertSent, PinnedToken, etc. |
| `vercel.json` | Cron schedule (e.g. `0 0 * * *` = daily) for `/api/cron`. |

---

## 7. Data flow (high level)

- **New/trending/surge tokens:** DexScreener (and optionally Birdeye/Moralis) → aggregate in API routes → dashboard.
- **Wallet Tracker alerts:** Tracked wallets from DB → Moralis/Helius/Birdeye for recent buys → group by mint → filter by `minBuyers`/`maxAgeHours`/`maxAlerts` from `AlertRule` → return alerts with `latestBuyAt`; cron calls notify → Telegram + `WalletAlertSent` dedupe.
- **CT Scan:** Apify scrapes tweets from configured accounts → tokens mentioned → stored/displayed.
- **NovaStaris AI Analysis:** Token metadata + optional context → Anthropic Claude → viral score, signal, recommendations.

---

## 8. Cron and background jobs

- **Vercel Cron** (see `vercel.json`): one job that hits `/api/cron` (e.g. daily on Hobby plan).
- **Cron handler:** Calls `/api/wallet-tracker/notify` to send new wallet alerts to Telegram and record them in `WalletAlertSent`.

---

This file is the single place to look for “what language, what framework, what APIs, and where things live” in the NovaStaris codebase.
