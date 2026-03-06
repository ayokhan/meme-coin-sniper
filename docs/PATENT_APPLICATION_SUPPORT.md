# NovaStaris — Patent Application Support

This document provides answers for patent application questions and a technical summary suitable for attachment as supporting material.

---

## Invention Name or Best Description (5 words or less)

**Unified AI Crypto Trading Analysis Platform**

*(Alternative: “AI-Powered Crypto Discovery and Alerts Platform”)*

---

## Abstract of the Invention (30 words or less)

A unified platform that uses AI to analyze meme and perpetual-futures markets, detects new perp listings and notifies users, and provides confluence-based screening and user-definable alerts via messaging.

---

## 1. Top Features of the Invention (at least 3)

**Feature 1 — Unified AI-Powered Token and Derivatives Analysis**  
A single platform that combines (a) AI analysis of meme and spot tokens (score 0–100, buy/no-buy signal, security checks, and trading levels) with (b) AI analysis of crypto perpetual futures (chart-based support/resistance, entry zone, take-profit and stop-loss, long/short bias). The system uses a large-language model (LLM) to ingest on-chain and market data (liquidity, volume, security, price action) and/or user-uploaded chart images and returns structured, tradeable outputs (score, signal, reasons, recommendations) in one response.

**Feature 2 — First-Seen New-Listing Detection and Instant Alerts for Perpetual Futures**  
A method and system that maintains a persistent record of known perpetual-futures symbols (e.g., in a database). On each run, the system fetches the current exchange universe, compares it to the stored set, and identifies symbols that have appeared for the first time. For each such “new listing,” the system sends an instant notification (e.g., Telegram, email, or in-app) with a direct link to trade, enabling subscribers to act on new perpetual markets before they are widely known.

**Feature 3 — Confluence-Based Screening and User-Definable Alerts for Derivatives**  
A screening and alerting system that (a) applies one-click “confluence” presets (e.g., “Short direction with positive funding,” “Long direction with negative funding,” “Strong 5-minute momentum”) to filter a live list of perpetual contracts without requiring a new data source, and (b) lets users define conditional alerts (e.g., “notify when symbol X’s 5-minute percentage move exceeds a threshold” or “notify on any new perp listing”). Alerts are evaluated on a schedule (e.g., cron), and notifications are sent via a configurable channel (e.g., Telegram), with limits applied by subscription tier (e.g., Pro vs VIP).

---

## 2. Summary of the Invention

**How it functions**  
NovaStaris is a software system that (1) aggregates cryptocurrency market data from multiple sources (blockchain APIs, DEX aggregators, exchange APIs for perpetual futures); (2) runs AI-powered analysis on that data (and optionally on user-uploaded chart images for futures) using a large-language model to produce scores, signals (buy/no-buy, long/short), reasons, and trading levels; (3) tracks “first-seen” perpetual-futures listings and sends instant notifications when new contracts appear; (4) provides confluence-based filters and user-definable alerts for derivatives, evaluated on a schedule and delivered via messaging channels; and (5) delivers periodic digest messages (e.g., hot new perps, top momentum) to keep users informed. Access to certain features (e.g., trending perps, AI analysis, alerts) is gated by subscription tier (Pro/VIP), and notifications use existing messaging infrastructure (e.g., Telegram Bot API).

**What it achieves**  
The invention gives retail and professional traders a single place to discover and evaluate meme/spot tokens and crypto perpetual futures, receive AI-generated scores and tradeable recommendations, get early notice of new perpetual listings, and filter or alert on specific market conditions (direction, funding, momentum) without manually monitoring multiple exchanges or tools. It reduces information asymmetry and latency around new listings and high-momentum moves by automating detection, analysis, and notification.

---

## 3. Background of the Invention

**Market conditions**  
Retail and semi-professional traders increasingly trade meme coins (often on Solana and BSC) and crypto perpetual futures. These markets are volatile, fragmented across many DEXs and CEXs, and subject to new listings and rapid moves. Traders typically must (a) monitor multiple dashboards and APIs for new tokens and new perpetual contracts, (b) manually assess liquidity, volume, and security (e.g., honeypot risk), and (c) interpret charts and funding data to decide entries and exits. No single platform has combined AI-driven token and futures analysis with first-seen new-listing detection and configurable confluence-based screening and alerts for perpetuals.

**Consumer situation / problem solved**  
Traders face (1) **information overload** — too many tokens and perps to evaluate manually; (2) **delayed awareness** of new perpetual listings, so they miss first-mover opportunities; (3) **lack of structured, tradeable output** from AI (scores, signals, support/resistance, entry/TP/SL) in one place for both spot/meme and futures; and (4) **no unified way** to screen for specific setups (e.g., short direction with positive funding) or to get notified when conditions are met. The invention addresses these by providing a unified discovery, AI analysis, new-listing alerting, and confluence/alert system for meme coins and crypto perpetual futures in a single subscription-based platform.

---

## 4. Attachment: Technical Summary and Architecture

The following section is suitable for attachment as a technical summary to assist in understanding the invention. An optional high-level architecture description for drawings is included at the end.

### 4.1 Technical Summary

**Platform type**  
Web application (Next.js/React) deployed on a serverless host (e.g., Vercel), with a PostgreSQL database (e.g., Supabase) and server-side API routes. Authentication and subscription tiers (Pro, VIP) are enforced via session and database checks.

**Data inputs**  
- **Token/meme:** On-chain and DEX data (DexScreener, Birdeye, Moralis, Helius); token security (e.g., GoPlus); optional social/CT data (e.g., Apify).  
- **Perpetual futures:** Exchange public API (e.g., Hyperliquid) for universe (symbol list), candles (OHLCV), and funding/mark data.

**AI analysis**  
- **Tokens:** Token metadata (liquidity, volume, security summary, socials) is formatted and sent to an LLM (e.g., Anthropic Claude). The model returns a numeric score (0–100), a buy/no-buy signal, short reasons, and optional trading levels (support/resistance, buy zone, TP/SL).  
- **Futures:** User uploads a chart image; the system sends the image plus trade context (symbol, margin, leverage, timeframe) to an LLM with vision capability. The model returns score, signal, trade direction (long/short), reasons, and price-based recommendations (support/resistance, entry zone, take-profit %, stop-loss %).  
- **On-demand perp signal:** For a given symbol, the system fetches recent candle data, builds a short market summary (e.g., last closes, current price, simple support/resistance), and sends it to the LLM to obtain a long/short/no_buy signal plus score and reason.

**New-listing detection for perpetuals**  
- A table stores “known” perp symbols and the time each was first seen.  
- A scheduled job (cron) fetches the current exchange universe, inserts any symbol not previously stored, and for each newly inserted symbol triggers a notification (e.g., Telegram message with trade link).  
- Optionally, the same job can be invoked more frequently by an external scheduler to approximate “instant” alerts within platform limits.

**Confluence presets and alerts**  
- **Presets:** The UI exposes filter options (e.g., “Short + positive funding,” “Long + negative funding,” “5m % ≥ 3%”). The client filters the in-memory list of perps (already loaded from the API) by these criteria; no separate API call is required.  
- **Alerts:** Users create alert rules (e.g., new_listing, 5m_pct_above, 5m_pct_below with symbol and threshold). Rules are stored in the database and associated with the user and subscription tier (with a cap per tier). A scheduled job evaluates rules (e.g., fetches current universe for new listings, fetches 5m candles for percentage thresholds), and when a condition is met, sends a message via the configured channel (e.g., Telegram). Cooldowns prevent duplicate notifications for the same rule within a set period.

**Digest**  
- A scheduled job assembles a short digest (e.g., “Hot new perps in last 7 days” and “Top momentum by 24h move”) from the same data sources, formats a message, and sends it via the same notification channel (e.g., Telegram).

### 4.2 Architecture Description (for drawings)

The following can be used to produce an architecture diagram.

**High-level components**

1. **User devices** — Browsers (and optionally mobile) accessing the web app over HTTPS.

2. **Web application (front end)**  
   - Dashboard with tabs/sections: token discovery (new, trending, surge), wallet tracker, CT Scan, NovaStaris AI Agent (token analysis), Crypto Futures (AI chart analysis, workflow, top altcoins, hot new perps, confluence presets), Trending perps, perp alerts management, narratives, trading bot, coach calls, BSC, watchlist.  
   - UI for entering contract address or uploading chart, viewing AI output (score, signal, reasons, recommendations), and managing perp alerts (add/remove rules).

3. **API layer (server)**  
   - REST API routes for: auth, subscription, token/perp data, AI analysis (token, BSC, futures, on-demand perp signal), perp alerts (CRUD), wallet tracker, cron-triggered jobs (new-listing check, digest, alert evaluation).  
   - Each route may call external APIs (DEX, chain, exchange) and/or the database and/or the LLM provider.

4. **Database**  
   - Stores: users, subscriptions, tokens, tracked wallets, alert rules, perp alerts, known perp symbols, analytics events, support tickets, etc.  
   - “Known perp symbols” and “perp alert rules” are central to new-listing detection and user-defined alerts.

5. **External services**  
   - **Market/chain:** DexScreener, Birdeye, Moralis, Helius, GoPlus; Hyperliquid (or similar) for perp universe and candles.  
   - **AI:** LLM provider (e.g., Anthropic) for text and vision.  
   - **Notifications:** Telegram Bot API (and/or email) for alerts and digest.  
   - **Payments:** Optional (e.g., Solana) for subscription verification.

6. **Scheduler (cron)**  
   - Single daily (or otherwise configured) job that invokes in sequence: new-listing check (fetch universe → diff with stored symbols → send notifications for new symbols), digest (build message from hot new + top momentum → send), alert evaluation (load rules → evaluate conditions → send notifications with cooldown).  
   - Optionally, an external scheduler can call the new-listing endpoint more frequently for nearer-to-instant alerts.

**Data flows (summary)**

- **Token AI analysis:** User submits contract address → API fetches token data from DEX/chain/security APIs → API sends structured summary to LLM → LLM returns score, signal, reasons, recommendations → API returns JSON to client → client displays result.  
- **Futures AI analysis:** User uploads chart and submits symbol/context → API sends image + context to LLM (vision) → LLM returns score, signal, direction, reasons, levels → API returns JSON to client → client displays result.  
- **New perp listing:** Cron calls new-listing routine → routine fetches current universe from exchange API → routine compares to “known perp symbols” in DB → for each new symbol, inserts into DB and sends notification (e.g., Telegram) with trade link.  
- **Perp alerts:** User creates rule (type, symbol, threshold) via API → stored in DB → cron loads rules, evaluates (universe for new_listing, candles for 5m thresholds), sends notification when condition met and cooldown allows.

**Optional diagram suggestion**  
A single-page diagram could show: **User** ↔ **Web App** ↔ **API Layer** ↔ **Database**; **API Layer** ↔ **External Services** (Market/Chain, LLM, Telegram); **Scheduler** → **API Layer** (cron triggers new-listing, digest, alert-eval routes). Arrows can be labeled with main data (e.g., “token summary,” “chart + context,” “score/signal,” “universe,” “notifications”).

---

*End of patent application support document.*
