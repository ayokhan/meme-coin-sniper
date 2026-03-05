# NovaStaris

**AI-powered meme-coin discovery and trading intelligence.**

NovaStaris helps traders discover and evaluate volatile tokens with structured AI analysis (scores, signals, risk notes, and trading levels). It combines real-time data (DexScreener, GoPlus, Birdeye, Moralis) with **Anthropic Claude** for Solana/BSC token analysis and crypto futures workflow.

- **Live app:** [novastaris.ai](https://novastaris.ai)

---

## Features

- **AI token analysis** – Solana & BSC: score (0–100), buy/no_buy signal, reasons, support/resistance, take-profit/stop-loss suggestions
- **Crypto futures** – AI chart analysis and institutional-style workflow (Hyperliquid)
- **Wallet tracker** – Track smart-money wallets; alerts and live trades (Moralis/Helius/Birdeye)
- **Coach calls & Telegram** – VIP signals and Telegram ID linking
- **Subscriptions** – Pro/VIP via USDC (Solana); payment verification with dedicated RPC recommendation
- **Admin** – Hub (Insights, Metrics, Customers, Wallet Tracker, Feature flags, Support, AI Feedback), Vercel Analytics, feedback loop for AI quality

---

## Tech stack

- **App:** Next.js 16, React 19, TypeScript, Tailwind
- **Data:** PostgreSQL (Prisma), Vercel Postgres or compatible
- **AI:** Anthropic (Claude) for analysis and trading signals
- **Chains / data:** Solana, BSC; DexScreener, GoPlus, Birdeye, Moralis, Helius
- **Auth:** NextAuth (email + wallet)
- **Deploy:** Vercel

---

## Getting started

1. **Clone and install**
   ```bash
   git clone https://github.com/ayokhan/meme-coin-sniper.git
   cd meme-coin-sniper
   npm install
   ```

2. **Environment**
   - Copy `.env.example` to `.env.local` and fill in (see file for RPC, auth, and API keys).

3. **Database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

## Docs

- [AI PM roadmap](docs/AI_PM_ROADMAP.md) – Fine-tuning, eval, RAG, and GitHub profile setup for showcasing this project.

---

## License

Private. All rights reserved.
