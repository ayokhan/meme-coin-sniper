# NovaStaris — Product Requirements Document (PRD)

**Product name:** NovaStaris  
**Tagline:** Your Advanced AI Lightning Sniper  
**Domain:** novastaris.ai  
**Last updated:** 2025

---

## 1. Vision & goals

### 1.1 Vision

NovaStaris helps crypto traders discover new and trending meme coins early, follow “smart money” wallets, get alerts when multiple tracked wallets buy the same token, and analyze tokens with AI—on Solana and BSC. It also offers Crypto Futures tools and owner-run trading bot integrations. The product aims to be the go-to dashboard for meme coin discovery, wallet-led signals, and AI-backed token evaluation.

### 1.2 Goals

- **Discovery:** Surface new and trending meme coins on Solana and BSC (new pairs, final stretch, migrated, trending).
- **Signals:** Wallet Tracker alerts when N+ tracked wallets buy the same token; first-buy alerts; Telegram notifications.
- **AI:** NovaStaris AI Analysis for Solana and BSC tokens (viral score, signal, recommendations); BSC AI is Pro/VIP only.
- **Futures:** Crypto Futures tab and AI analysis for futures; optional trading bot (KuCoin, Blofin, Hyperliquid).
- **Monetization:** Free tier + Pro and VIP subscriptions (Solana USDC payment verification).
- **Operations:** Owner-only admin (customers, support tickets, live chat, Wallet Tracker config, feature flags, App Insights, Status, AI feedback).

---

## 2. User personas

| Persona | Description | Primary needs |
|--------|--------------|----------------|
| **Retail meme trader** | Active in meme coins on Solana/BSC; wants early entries. | New pairs, trending, surge, AI score, watchlist (pins). |
| **Wallet follower** | Tracks specific “smart money” wallets. | Wallet Tracker alerts, first-buy alerts, Telegram. |
| **Pro / VIP subscriber** | Willing to pay for edge (BSC AI, Coach Calls, VIP support). | BSC AI Analysis, Coach Calls, Telegram signals, support. |
| **Futures trader** | Trades crypto futures; wants signals or automation. | Futures tab, AI futures analysis, optional trading bot. |
| **Owner / operator** | You; runs the product and support. | Customers, support, chat, Wallet Tracker, insights, Status, feature flags. |

---

## 3. Current features (in scope)

### 3.1 Public / unauthenticated

- **Go Hunting (Solana):** New pairs (DexScreener, Birdeye, Moralis Pump.fun), Final Stretch, Migrated, Trending; view filters (New pairs / Final Stretch / Migrated).
- **Trending:** Tokens by viral/trending score (Solana).
- **Surge:** Volume / price surge tokens.
- **Transactions:** Live trades feed (from Wallet Tracker data when available).
- **NovaStaris AI Analysis:** Solana token analysis (viral score, signal, recommendations); run on any token.
- **Crypto Futures:** Futures tools and AI analysis.
- **Narratives:** Narrative-themed views (if configured).
- **CT Scan:** Token mentions from Crypto Twitter (Apify); Scan Twitter action.
- **Wallet Tracker:** View alerts (tokens where ≥ N tracked wallets bought) and first-buy context; live trades.
- **BSC tab:** Go Hunting (new pairs, final stretch, migrated, trending) for BSC; BSC AI Analysis is gated (Pro/VIP).
- **Pins / Watchlist:** Authenticated; pin tokens for re-analysis and quick access.
- **About, Chat, Support, Status (link):** About page; chat (NJA + optional live agent); support form; Status page and API are owner-only.
- **Theme:** Light / Dark / System (flap-style selector in header).
- **Auth:** Register, Sign in (email/password or Solana wallet), Forgot password, Reset password; Account (profile, change password).

### 3.2 Authenticated (all signed-in users)

- **Account:** Profile (name, phone, country, experience); change password (email/password accounts).
- **Pins:** Pin tokens, refresh analyses, remove pins.
- **Subscription:** View status; upgrade to Pro/VIP (Solana USDC); verify payment by tx signature.

### 3.3 Pro / VIP only

- **BSC AI Analysis:** Run AI analysis on BSC tokens.
- **Coach Calls:** VIP-only CA / call alerts; Telegram ID submission for signals.

### 3.4 Owner-only

- **Status:** Button in header and `/status` page; API health (DexScreener, Moralis). Non-owners get 403 / “Owner only.”
- **Customers:** List users, subscription status; delete customer.
- **Support tickets:** List and update ticket status.
- **Live chat:** View sessions, respond as agent; agent presence (“Live: online”).
- **Wallet Tracker admin:** Tracked wallets CRUD, alert rules, first-buy rules, import/seed config.
- **Feature flags:** Toggle Moralis, Telegram, etc.
- **App Insights:** Page views by country, city, device, path, browser, OS.
- **AI Feedback:** Submit good/bad + note on AI analyses for model improvement.
- **Trading bot:** Config and manual run (KuCoin, Blofin, Hyperliquid).

---

## 4. User stories (summary)

- As a **trader**, I want to see new and trending meme coins so that I can find early entries.
- As a **trader**, I want an AI score and recommendation on a token so that I can decide faster.
- As a **subscriber**, I want BSC AI and Coach Calls so that I get more edge and signals.
- As a **wallet follower**, I want alerts when several tracked wallets buy the same token so that I don’t miss coordinated moves.
- As a **user**, I want to reset my password via email so that I can recover access.
- As the **owner**, I want to see Status and Insights so that I can monitor integrations and audience.

---

## 5. Non-functional requirements

- **Performance:** Dashboard and API responses within reasonable latency; scan/refresh can be async.
- **Security:** Auth via NextAuth; owner actions gated by `OWNER_EMAIL` / `OWNER_WALLET_ADDRESSES`; no sensitive keys in client.
- **Availability:** Hosted on Vercel; DB (PostgreSQL) and external APIs (DexScreener, Moralis, etc.) are single points of dependency.
- **Scalability:** Serverless APIs; DB and API rate limits may constrain heavy concurrent use.
- **Compliance:** Subscription and futures features may be region-restricted (e.g. Ontario: Blofin for futures; KuCoin/Hyperliquid restrictions noted in docs).

---

## 6. Success metrics (suggested)

- **Engagement:** DAU/MAU; pins per user; AI analyses run per user.
- **Monetization:** Conversion to Pro/VIP; MRR; churn.
- **Operations:** Support ticket volume and resolution time; Status/API uptime.
- **Quality:** AI feedback ratio (good vs bad); user retention after first subscription.

---

## 7. Out of scope (current PRD)

- Native mobile app (web-only for now).
- On-chain trading execution from the app (read-only + optional external bot).
- Multi-tenant white-label.
- Formal compliance certifications (beyond documenting regional restrictions).

---

## 8. References

- **Implementation:** `TECH_STACK_AND_APIS.md` — tech stack, APIs, env vars, data flow.
- **Auth:** `AUTH_SETUP.md` — NextAuth, owner setup, Resend for password reset.
