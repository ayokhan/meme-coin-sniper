# NovaStaris — Architecture & Technical Summary (Patent Attachment)

**Document purpose:** Technical summary and architecture description for patent application attachment (drawings, photographs, or technical summary).

---

## System Overview

NovaStaris is a web-based platform that unifies (1) discovery and AI analysis of meme/spot tokens on Solana and BSC, (2) AI-powered analysis of crypto perpetual futures (chart + context → score, signal, levels), (3) detection and notification of new perpetual-futures listings, and (4) confluence-based screening and user-definable alerts for perpetuals. The system uses a subscription model (Pro/VIP) and delivers notifications via Telegram (and optionally email).

---

## Architecture Diagram (Text Reference)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER (Browser / Device)                            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEB APPLICATION (Next.js / React)                                          │
│  • Dashboard: Token discovery, Wallet Tracker, CT Scan, AI Agent, Futures   │
│  • Crypto Futures: AI Chart Analysis, Top Altcoins, Hot New Perps, Presets  │
│  • Trending perps, Perp alerts (list / add / remove)                        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API LAYER (Next.js API Routes)                                              │
│  • Auth, Subscription, Tokens, Perps, AI Analyze (token / BSC / futures)    │
│  • AI Perp Signal, Perp Alerts CRUD, Cron: new-listing, digest, alerts     │
└───┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬┘
    │                 │                 │                 │                 │
    ▼                 ▼                 ▼                 ▼                 ▼
┌────────┐    ┌──────────────┐   ┌─────────────┐   ┌─────────────┐   ┌──────────┐
│ DB     │    │ Market/Chain │   │ LLM (e.g.   │   │ Telegram    │   │ Scheduler│
│(Postgre│    │ APIs         │   │ Anthropic)  │   │ Bot API     │   │ (Cron)   │
│ SQL)   │    │ DexScreener, │   │ Text +      │   │ Notifications│   │ Daily    │
│ Users, │    │ Birdeye,     │   │ Vision      │   │             │   │ jobs     │
│ Tokens,│    │ Moralis,     │   │             │   │             │   │          │
│ Perp   │    │ Hyperliquid │   │             │   │             │   │          │
│ Alerts,│    │ GoPlus       │   │             │   │             │   │          │
│ Known  │    │              │   │             │   │             │   │          │
│ Perps  │    │              │   │             │   │             │   │          │
└────────┘    └──────────────┘   └─────────────┘   └─────────────┘   └──────────┘
```

---

## Key Data Flows

| Flow | Steps |
|------|--------|
| **Token AI** | User → contract address → API → DEX/security APIs → LLM (token summary) → score, signal, reasons, levels → API → User |
| **Futures AI** | User → chart image + symbol/context → API → LLM (vision) → score, signal, long/short, levels → API → User |
| **New perp alert** | Cron → fetch exchange universe → diff with DB (known symbols) → for each new symbol: store + send Telegram with trade link |
| **Perp alerts** | User → create rule (type, symbol, threshold) → DB; Cron → load rules → evaluate (universe / candles) → send Telegram when condition met |

---

## Core Technical Elements

- **First-seen perp detection:** Persistent table of perp symbols; each run compares current universe to table, inserts new symbols, notifies once per new symbol.  
- **Confluence presets:** Client-side filter on already-loaded perp list (e.g., short + positive funding, 5m % ≥ 3%).  
- **User perp alerts:** Stored rules (new_listing, 5m_pct_above, 5m_pct_below); cron evaluates and sends via Telegram with cooldown and tier limits (Pro/VIP).  
- **Digest:** Cron builds message (hot new perps + top momentum) from same data sources and sends via Telegram.

---

*This document may be attached to the patent application as a technical summary to assist in understanding the invention.*
