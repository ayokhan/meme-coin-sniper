# NovaStaris — Implementation Architecture (Study Guide)

**Purpose:** Single reference for understanding everything we built—stack, data, AI, product modules, and deployment. Use this to prep for AI PM / PM / PO interviews.

**Live product:** [novastaris.ai](https://novastaris.ai) · **Repo:** `meme-coin-sniper` · **Mobile:** Google Play (`ai.novastaris.app`)

---

## 1. Executive summary (30-second pitch)

NovaStaris is an **AI-native fintech SaaS** that helps crypto traders discover meme coins (Solana/BSC), analyze them with LLMs, track smart-money wallets, run futures/perps intelligence, and automate trading workflows. It is a **full-stack TypeScript product**: Next.js web app, PostgreSQL, Anthropic Claude for AI, Stripe + Solana for subscriptions, Telegram for alerts, and a Capacitor Android shell that loads the live web app.

**Your PM story:** You owned JTBD → PRD → build → GTM. You shipped structured AI outputs (score, signal, levels), feedback loops (good/bad), tiered access (Pro/VIP), admin ops (customers, feature flags), and mobile distribution (Play Store)—not just a demo.

---

## 2. Technology stack

### 2.1 Languages & runtime

| Layer | Technology |
|-------|------------|
| **Application language** | **TypeScript** (strict) — all app code, API routes, `lib/` |
| **UI** | **React 19** + **Next.js 16** (App Router) |
| **Server** | **Node.js 20** (Vercel serverless functions) |
| **Mobile shell** | **Capacitor 8** (Android); WebView loads `https://novastaris.ai` |
| **Native Android** | **Java/Kotlin + Gradle** (generated Capacitor project in `android/`) |
| **Config** | JavaScript/TS config (`next.config.ts`, `eslint.config.mjs`, `capacitor.config.ts`) |
| **Styling** | **Tailwind CSS 4**, Radix UI primitives, Lucide icons |

### 2.2 Database & ORM

| Item | Detail |
|------|--------|
| **Database** | **PostgreSQL** (hosted e.g. Supabase / Neon) |
| **ORM** | **Prisma 6** — schema in `prisma/schema.prisma`, migrations in `prisma/migrations/` |
| **Connection** | `DATABASE_URL` env var |
| **Key pattern** | Server-side only; API routes and cron jobs read/write via `lib/db.ts` |

**Major table groups (see §5):** Users & auth, Subscriptions, Tokens & scans, Wallet tracking, Perp alerts, AI feedback, Trading bots, NovaConnect community, Support/chat, Analytics.

### 2.3 Auth & identity

| Method | Implementation |
|--------|------------------|
| **Email/password** | NextAuth Credentials + bcrypt hashed passwords in `User.hashedPassword` |
| **Google OAuth** | NextAuth Google provider |
| **Solana wallet** | Sign message with nonce → verify with `@solana/web3.js` + `tweetnacl` → session |
| **Sessions** | **NextAuth.js 4** — JWT/session includes `isPaid`, `tier`, on-demand flags |
| **Owner access** | `OWNER_EMAIL` / `OWNER_WALLET_ADDRESSES` env → admin pages, insights, env API keys |
| **Password reset** | `PasswordResetToken` + **Resend** email API |

**Key files:** `lib/auth.ts`, `lib/auth-server.ts`, `app/api/auth/*`

### 2.4 Hosting & deployment

| Service | Role |
|---------|------|
| **Vercel** | Production hosting, serverless API, env secrets, geo headers for analytics |
| **Vercel Cron** | Daily job → `/api/cron` (`vercel.json`: `0 0 * * *` UTC) |
| **Vercel Blob** | Optional file uploads (e.g. avatars) |
| **Vercel Analytics** | Page analytics (`@vercel/analytics`) |
| **Google Play** | Android app distribution; WebView = live site (no native rebuild for most features) |

**Deploy flow:** `git push` → Vercel build (`prisma generate && next build`) → production at novastaris.ai. Schema changes: `npx prisma migrate deploy` against production `DATABASE_URL`.

### 2.5 Payments & monetization

| Channel | Flow |
|---------|------|
| **Stripe (card)** | `/api/stripe/create-checkout-session` → Checkout → webhook `/api/stripe/webhook` → `Subscription` row |
| **Solana USDC** | User pays on-chain → `/api/subscription` verifies tx → `Subscription` with `txSignature` |
| **Tiers** | **Pro** ($70/mo USDC): Surge, Transactions, AI Agent, Crypto Futures. **VIP** ($150/mo USDC): + CT Scan, Wallet Tracker, Coach Calls, bots on-demand. Card checkout +$8. |
| **On-demand access** | Owner toggles per user: trading bot, Polymarket bot, CT Scan, Meme Traders, Nova Ultimate, etc. |
| **Usage limits** | `UsageThisMonth` tracks AI analysis count per user/month |

**Key files:** `lib/subscription.ts`, `lib/usage.ts`, `app/subscribe/page.tsx`, `app/api/stripe/*`

---

## 3. System architecture diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                                      │
│  • Browser (desktop/mobile web)                                               │
│  • Android app (Capacitor WebView → https://novastaris.ai)                    │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ HTTPS
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  NEXT.JS APP (React 19)                                                       │
│  app/page.tsx — main dashboard (30+ product tabs)                             │
│  app/admin/* — owner hub (customers, flags, bots, support, insights)          │
│  components/* — feature panels (Futures, TradingBot, WalletTracker, etc.)     │
└────────────────────────────────────┬─────────────────────────────────────────┘
                                     │ REST (app/api/*)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  API LAYER (~190 route handlers)                                              │
│  Auth · Subscriptions · AI analyze · Wallet/perp alerts · Admin · Cron        │
└───┬──────────┬──────────┬──────────┬──────────┬──────────┬───────────────────┘
    │          │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐
│Postgres│ │Market  │ │Anthropic│ │Telegram │ │Stripe / │ │Vercel Cron      │
│Prisma  │ │APIs    │ │Claude   │ │Bot API  │ │Solana   │ │Daily batch jobs │
└────────┘ └────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘
```

---

## 4. External APIs & integrations

### 4.1 Blockchain & market data

| API | Env | Used for |
|-----|-----|----------|
| **DexScreener** | (public) | Pairs, liquidity, volume, trending; WebSocket live pairs |
| **Moralis** | `MORALIS_API_KEY` | Pump.fun new tokens, wallet swap history |
| **Helius** | `HELIUS_API_KEY` | Enhanced Solana txs, wallet PnL, discovery fallback |
| **Birdeye** | `BIRDEYE_API_KEY` | New listings, wallet tx list |
| **GoPlus** | (public) | Token security: honeypot, mint, holder concentration |
| **Hyperliquid** | SDK + API | Perps universe, trending, liquidation data, top traders |
| **Binance** | (public perps) | Futures candles, altcoin data |
| **Blofin** | User keys + owner env | Perps trading bot, open positions, Liquidation Map |
| **KuCoin Futures** | Env keys | Alternative bot provider |
| **Polymarket** | CLOB + data API | Prediction markets, copy bot, tracker |

### 4.2 AI & social

| API | Env | Used for |
|-----|-----|----------|
| **Anthropic Claude** | `ANTHROPIC_API_KEY` | Token analysis, futures/chart vision, trading signals, NovaSmart, Nova Eagle, etc. |
| **Apify** | `APIFY_API_TOKEN` | CT Scan — scrape Crypto Twitter accounts |
| **OpenAI** | (optional) | Some workflows; fine-tuning roadmap |

### 4.3 Comms & ops

| API | Env | Used for |
|-----|-----|----------|
| **Telegram Bot** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Wallet alerts, perp alerts, digests |
| **Resend** | `RESEND_API_KEY` | Password reset, support emails |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Card subscriptions |

---

## 5. Data model (PostgreSQL / Prisma)

### 5.1 Core product

| Model | Purpose |
|-------|---------|
| `User` | Account, profile, on-demand flags, NovaConnect, coach user |
| `Subscription` | Pro/VIP tier, expiry, Stripe session or Solana tx |
| `Token` | Discovered meme coins with viral score, security JSON |
| `PinnedToken` | User watchlist + cached AI re-analysis |
| `UsageThisMonth` | Monthly AI usage caps |

### 5.2 Discovery & alerts

| Model | Purpose |
|-------|---------|
| `TrackedWallet` | Admin smart-money wallets (Solana) |
| `UserMemeCoinWallet` | User-owned meme wallets (max 5) |
| `LeverageWallet` / `UserLeverageWallet` | Hyperliquid perp traders |
| `PolymarketTrackedWallet` | Polymarket proxy wallets |
| `AlertRule` | Min buyers, max age for wallet alerts |
| `WalletAlertSent` | Telegram dedupe |
| `KnownPerpSymbol` | First-seen perp symbols (Hot New Perps) |
| `PerpAlert` | User rules: new listing, 5m % above/below |

### 5.3 AI quality & feedback

| Model | Purpose |
|-------|---------|
| `AiAnalysisFeedback` | good/bad on token AI (eval dataset source) |
| `NovaSmartFeedback` | Futures/smart analysis feedback |
| `NovaFiveMinsOwnerFeedback` | Polymarket 5-min lean labels |

### 5.4 Trading & automation

| Model | Purpose |
|-------|---------|
| `TradingBot` | Owner bot config (Blofin/Hyperliquid/KuCoin) |
| `NovaScalperConfig` | Per-user Blofin scalper slots |
| `UserBlofinConfig` | Encrypted user API keys (AES-256-GCM) |
| `UserPolymarketConfig` | Encrypted Polymarket CLOB credentials |
| `TradingBotJournalEntry` | Closed trades, Nova Radar snapshots |

### 5.5 Platform ops

| Model | Purpose |
|-------|---------|
| `FeatureFlag` | Kill switches (Moralis, Telegram, NovaConnect, etc.) |
| `TabNewBadge` | “NEW” pills on nav tabs |
| `AnalyticsEvent` | App Insights (geo, device, path) |
| `SupportTicket` / `ChatSession` | Support + Nja chat + live agent |
| `CoachCall` / `UserTelegram` | VIP coach signals |

---

## 6. Product modules (what each tab does)

Main UI lives in `app/page.tsx` with tab IDs. Feature panels in `components/`.

### 6.1 Meme coin discovery (free + paid layers)

| Tab | Access | What it does |
|-----|--------|--------------|
| **Go Hunting** | Free (Solana new pairs) | Moralis/Birdeye/DexScreener new tokens |
| **Trending / Surge / Transactions** | Surge/Transactions = Pro | Volume spikes, on-chain activity |
| **BSC Go Hunting** | Free browse; BSC AI = Pro/VIP | BSC pairs via DexScreener |
| **NovaStaris AI Agent** | Pro/VIP | Paste CA → AI score/signal/levels |
| **CT Scan** | VIP (+ on-demand) | Apify Twitter scrape for token mentions |
| **Wallet Tracker** | VIP | Smart wallet buys, first-buy alerts, meme leaderboard |
| **Watchlist** | Session | Pinned tokens, auto re-analyze every ~3 min (cron) |

### 6.2 Crypto futures & perps (Pro/VIP)

| Tab | What it does |
|-----|--------------|
| **Crypto Futures** | AI chart analysis (Claude vision), top altcoins, hot new perps |
| **Trending perps** | Hyperliquid momentum list |
| **Perp Radar / Nova Radar** | Setup detection, funding/OI context |
| **Liquidation Map** | Market liq clusters + **user Blofin position** overlay |
| **Narratives** | AI-generated futures narrative themes |
| **Nova Eagle / Crypto Buddie / Meme Intelligence** | Specialized AI scoring agents |

### 6.3 Automation & advanced (VIP + on-demand)

| Tab | What it does |
|-----|--------------|
| **NovaStaris AI Trading Bots** | Owner + user bots: Blofin/Hyperliquid/KuCoin; AI monitor |
| **Nova Polymarket Pro** | Copilot, tracker, radar, 5-min lean, elite signals |
| **Nova Prop Firm Bot** | Prop-firm workflow (on-demand) |
| **Nova Ultimate** | Meme sniper terminal (on-demand) |
| **Nova Forecast / Nova Forex / Nova Investment** | VIP forecast agents, forex, portfolio pins |

### 6.4 Community & support

| Surface | What it does |
|---------|--------------|
| **NovaConnect** | Community chat, DMs, presence, moderation |
| **Coach Calls** | Owner/coach posts for VIP |
| **Support / Chat** | Tickets + Nja bot + live agent handoff |
| **Subscribe / Account** | Stripe checkout, profile, payment terms |

### 6.5 Admin hub (`/admin`)

| Page | Purpose |
|------|---------|
| **Customers** | User list, subscriptions, on-demand toggles |
| **Feature flags** | Enable/disable subsystems |
| **AI Feedback** | Review good/bad labels for eval |
| **Wallet / Leverage / Polymarket trackers** | Curate tracked wallets |
| **Trading bot / NovaScalper** | Bot config and manual runs |
| **Insights** | Page views by country, device, path |
| **Support / Chat** | Ticket and live chat management |

---

## 7. AI architecture (interview-critical)

### 7.1 Design pattern

All AI features follow the same PM-friendly pattern:

1. **Gather structured context** from APIs (DexScreener, GoPlus, chart image, position data).
2. **Prompt Claude** with JSON-only output schema (score, signal, reasons, levels).
3. **Parse & validate** response; show in UI with disclaimers.
4. **Collect feedback** (good/bad) → future eval set and RAG corpus.
5. **Gate by tier** and **usage limits** (`lib/usage.ts`).

### 7.2 Key AI modules

| Feature | Library | Model | Input → Output |
|---------|---------|-------|----------------|
| **Solana token AI** | `lib/ai-analyze.ts` | Claude Sonnet | CA → score 0–100, buy/no_buy, narrative, TP/SL |
| **BSC token AI** | `lib/ai-analyze-bsc.ts` | Claude | BSC CA → same schema |
| **Futures AI** | `lib/ai-analyze-futures.ts` | Claude (vision) | Chart image + symbol → long/short, levels |
| **Trading signal** | `lib/ai-trading-signal.ts` | Claude | OHLCV + indicators → trade decision |
| **NovaSmart** | `lib/nova-smart-logic.ts` | Claude | Multi-timeframe futures read |
| **Nova Eagle / Buddie / Q** | `lib/ai-nova-eagle.ts`, etc. | Claude | Domain-specific scoring |

**API routes:** `/api/ai-analyze`, `/api/ai-analyze-bsc`, `/api/ai-analyze-futures`, plus feature-specific routes under `/api/nova-*`, `/api/futures/*`.

### 7.3 AI quality roadmap (what you planned)

| Lever | Status | Interview line |
|-------|--------|----------------|
| **Prompt + few-shot** | Partial | “We iterate prompts using production feedback examples.” |
| **Evals** | Data exists (`AiAnalysisFeedback`) | “I defined eval metrics: signal accuracy vs good/bad labels, score calibration.” |
| **RAG** | Roadmap | “Retrieve similar past analyses before inference to reduce contradiction.” |
| **Fine-tuning** | Roadmap (OpenAI mini for scorer) | “Separate fast classifier from full Claude analysis for cost/latency.” |
| **Guardrails** | In prompts + security checks | “Honeypot/mint checks before any buy signal; mobile WebView edge cases fixed in prod.” |

See also: `docs/AI_PM_ROADMAP.md`

### 7.4 Example flow: Solana token analysis

```
User pastes contract address
    → POST /api/ai-analyze
    → lib/ai-analyze.runAiAnalysis()
        → Parallel fetch: DexScreener token + GoPlus security
        → Build tokenSummary JSON
        → Claude prompt (narrative-aware scoring rules)
        → Parse JSON → AnalysisResult
    → UI renders score, signal, reasons, recommendations
    → User/owner can submit good/bad → AiAnalysisFeedback
```

### 7.5 Example flow: Liquidation Map + Blofin position

```
User connects Blofin keys (encrypted in UserBlofinConfig)
    → GET /api/futures/liquidation-map/positions
    → lib/futures-blofin-session.ts resolves keys (user or owner env)
    → Blofin API → open positions
    → UI overlays position vs liquidation clusters
    → "Analyze my position" → AI context on liq buffer + market structure
```

---

## 8. Background jobs (Vercel Cron)

Daily `/api/cron` (protected by `CRON_SECRET`) orchestrates:

| Job | Purpose |
|-----|---------|
| Token scan | `/api/scan` — persist new tokens |
| CT Scan | `/api/scan-twitter` |
| Wallet notify | Telegram when N+ tracked wallets buy same token |
| Leverage notify | Hyperliquid wallet position changes |
| Pinned re-analyze | Up to 5 watchlist tokens → Claude refresh |
| Trading bot run | Owner bot cycle |
| Perp new listing | Detect new Hyperliquid perps → Telegram |
| Perp digest | Daily momentum digest |
| Perp alerts | Evaluate user alert rules |
| NovaScalper tick | User scalper bots |
| Meme leaderboard | Refresh PnL stats (if flag on) |

**PM point:** Cron is the “always-on product” layer—alerts and digests are features, not infra.

---

## 9. Mobile architecture (Android)

| Item | Detail |
|------|--------|
| **Framework** | Capacitor 8 — `capacitor.config.ts` |
| **App ID** | `ai.novastaris.app` |
| **Strategy** | **Remote WebView** — loads `https://novastaris.ai` (not bundled static export) |
| **Why** | Ship web features instantly via Vercel; only rebuild AAB for native shell changes |
| **Build** | `npm run cap:bundle:android` → signed AAB → Google Play |
| **Store** | Internal + closed testing; listing copy in `docs/PLAY_CONSOLE_SETUP.md` |

**Interview line:** “We chose a thin native shell over full React Native to optimize iteration speed while still meeting Play Store distribution needs.”

---

## 10. Security & compliance patterns

| Area | Approach |
|------|----------|
| **API keys (Blofin/Polymarket)** | AES-256-GCM encrypted at rest; decrypted server-side only |
| **Auth** | NextAuth sessions; owner routes check `isOwnerSession()` |
| **Cron** | Bearer `CRON_SECRET` |
| **Stripe webhooks** | Signature verification |
| **Tier gating** | Server-side checks in API routes, not UI-only |
| **Feature flags** | Owner can disable Moralis/Telegram/etc. without deploy |
| **Trading disclaimers** | Risk copy on bot/futures panels |

---

## 11. Repository map (where to look)

```
meme-coin-sniper/
├── app/
│   ├── page.tsx              # Main dashboard (all tabs)
│   ├── admin/                # Owner admin pages
│   ├── api/                  # ~190 REST endpoints
│   ├── subscribe/            # Pricing & checkout
│   └── account/              # User profile
├── components/               # Feature UI panels
├── lib/
│   ├── ai-analyze*.ts        # Claude prompts
│   ├── api-clients/          # DexScreener, Moralis, Helius, etc.
│   ├── auth.ts               # NextAuth config
│   ├── subscription.ts       # Pro/VIP plans
│   ├── feature-flags.ts      # Kill switches
│   ├── blofin.ts             # Exchange integration
│   └── trading-bot-run.ts    # Bot execution
├── prisma/schema.prisma      # Full data model
├── android/                  # Capacitor Android project
├── capacitor.config.ts
├── vercel.json               # Cron schedule
├── TECH_STACK_AND_APIS.md    # Detailed API route list
├── PRD.md / JOBS_TO_BE_DONE.md / GO_TO_MARKET.md
└── docs/AI_PM_ROADMAP.md     # Eval/RAG/fine-tuning plan
```

---

## 12. Interview cheat sheet

### “Walk me through NovaStaris.”

> NovaStaris is a subscription SaaS for crypto traders. We aggregate on-chain and market data from DexScreener, Moralis, Hyperliquid, and others, run it through Claude for structured analysis, and deliver alerts via Telegram and in-app workflows. I built the product end-to-end: JTBD, PRDs, tiered monetization (Pro/VIP), admin ops, AI feedback loops, and Google Play distribution via Capacitor.

### “How do you measure AI quality?”

> We capture explicit good/bad feedback on analyses, track score/signal at feedback time, and plan regression evals against that dataset. We also enforce guardrails in prompts and pre-LLM security checks (honeypot, liquidity). Next step is RAG over historical analyses for consistency.

### “How did you prioritize the roadmap?”

> JTBD framing: discovery jobs (free tabs) → conversion jobs (AI analysis, Pro) → retention jobs (wallet alerts, VIP bots) → expansion (mobile, Polymarket, community). Feature flags let us ship dark and enable for VIP/on-demand users first.

### “Tell me about a hard tradeoff.”

> **Mobile:** WebView vs native — we chose WebView so 95% of features deploy with `git push`, accepting Play Store policy constraints on billing and offline. **AI cost:** Structured JSON outputs and usage caps per tier; pinned re-analyze batched in cron with limits.

### Numbers you can cite

- **14+ years** product/QA experience; **500K+** Enercare customers; **22-person** team; **14M** healthcare residents (prior roles)
- **~190** API routes; **30+** product tabs; **Pro/VIP** subscription tiers
- **Daily cron** runs 10+ batch jobs (alerts, digests, bots, re-analysis)

---

## 13. Related documents

| Document | Use |
|----------|-----|
| `TECH_STACK_AND_APIS.md` | Full API route table, env vars |
| `docs/AI_PM_ROADMAP.md` | Eval, RAG, fine-tuning implementation plan |
| `PRD.md` | Product vision and user stories |
| `JOBS_TO_BE_DONE.md` | JTBD by feature area |
| `GO_TO_MARKET.md` | Pricing, positioning, launch |
| `docs/ANDROID_PLAY_STORE.md` | Mobile build & release |
| `docs/NOVASTARIS_ARCHITECTURE_FOR_PATENT.pdf.md` | Patent-oriented technical summary |

---

*Last updated: June 2026 — reflects production at novastaris.ai including Android Play testing, Stripe subscriptions, Blofin Liquidation Map, and expanded AI/futures modules.*
