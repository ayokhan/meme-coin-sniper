# Where Moralis API Is Called

This document lists **every place** in the app that hits the Moralis API, so you can see why your daily 40k CPU limit is used so quickly.

---

## 1. Moralis endpoints we use

All Moralis calls go through `lib/api-clients/moralis.ts`:

| Function | Moralis API | When it runs |
|----------|-------------|--------------|
| **getPumpFunNewTokens(limit)** | `GET /token/mainnet/exchange/pumpfun/new` | 1 request per call. |
| **getWalletBuySwapsFromMoralis(wallet, limit, maxAgeMs)** | `GET /account/mainnet/:address/swaps` | **1 request per wallet** per call. |

So any code that uses “per wallet” logic will call Moralis **N times** (N = number of tracked wallets).

---

## 2. API routes that call Moralis

### A. `/api/new-pairs` (GET)

- **File:** `app/api/new-pairs/route.ts`
- **Calls:** `getPumpFunNewTokens(50)` when `view === 'new_pairs'`.
- **Triggered by:** **New** tab with **“Go Hunting”** and **“New pairs”** view.
- **Frequency:** Every time the New tab data is fetched, including **auto-refresh every 60 seconds** while the user stays on that tab.
- **Moralis cost per request:** **1** API call.

---

### B. `/api/scan` (GET)

- **File:** `app/api/scan/route.ts`
- **Calls:** `getPumpFunNewTokens(maxPairs * 2)` as a **fallback** when Birdeye returns 0 tokens.
- **Triggered by:** User runs **Scan** (e.g. “Scan” button that calls `/api/scan?type=new`).
- **Frequency:** Only when the user explicitly runs a scan (no auto-refresh).
- **Moralis cost per request:** **1** API call (only if Birdeye returns 0).

---

### C. `/api/test-moralis` (GET)

- **File:** `app/api/test-moralis/route.ts`
- **Calls:** `getPumpFunNewTokens(10)`.
- **Triggered by:** User clicks **“Test Moralis”** on the dashboard.
- **Frequency:** Manual only.
- **Moralis cost per request:** **1** API call.

---

### D. `/api/wallet-tracker` (GET) — **heavy**

- **File:** `app/api/wallet-tracker/route.ts` → uses `getWalletAlerts()` in `lib/get-wallet-alerts.ts`.
- **Calls:** For **each tracked wallet**, `getWalletAlerts()` calls `getWalletBuySwapsFromMoralis(address, ...)`. So **N wallets = N Moralis requests** per response.
- **Triggered by:**
  - User opens or refreshes the **Wallets** tab (alerts section).
  - **Auto-refresh every 60 seconds** while the user stays on the **Wallets** tab.
- **Frequency:** Every load of the Wallets tab + every 60s on that tab.
- **Moralis cost per request:** **N** API calls (N = number of tracked wallets, e.g. 17 → **17 calls per request**).

---

### E. `/api/wallet-tracker/trades` (GET) — **heavy**

- **File:** `app/api/wallet-tracker/trades/route.ts`
- **Calls:** For **each tracked wallet**, it calls `getRecentBuysForWallet()` which uses **getWalletBuySwapsFromMoralis** first. So **N wallets = N Moralis requests** per response.
- **Triggered by:**
  - User opens the **Wallets** tab (live trades section is loaded).
  - User clicks **“Refresh”** on “Live trades from tracked wallets”.
- **Frequency:** On Wallets tab load and on every manual refresh (no 60s timer on this one in the code, but it runs when the tab is first opened and when Refresh is clicked).
- **Moralis cost per request:** **N** API calls (N = number of tracked wallets).

---

### F. `/api/wallet-tracker/notify` (GET) — cron

- **File:** Called by **Vercel Cron** → `app/api/cron/route.ts` → `app/api/wallet-tracker/notify/route.ts` → `getWalletAlerts()` in `lib/get-wallet-alerts.ts`.
- **Calls:** Same as `/api/wallet-tracker`: **one Moralis request per tracked wallet** inside `getWalletAlerts()`.
- **Triggered by:** Vercel Cron (e.g. once per day with current `vercel.json`: `0 0 * * *`).
- **Frequency:** Once per day (or whatever your cron schedule is).
- **Moralis cost per request:** **N** API calls (N = number of tracked wallets).

---

## 3. Summary: which “pages” / actions call Moralis

| Page / action | API route(s) hit | Moralis calls per trigger |
|---------------|------------------|---------------------------|
| **New tab (Go Hunting – New pairs)** | `/api/new-pairs?view=new_pairs` | **1** (and every 60s while on tab) |
| **Scan (when Birdeye returns 0)** | `/api/scan` | **1** |
| **“Test Moralis” button** | `/api/test-moralis` | **1** |
| **Wallets tab – Alerts** | `/api/wallet-tracker` | **N** (N = tracked wallets) — and every 60s on tab |
| **Wallets tab – Live trades** | `/api/wallet-tracker/trades` | **N** (N = tracked wallets) |
| **Cron (Telegram alerts)** | `/api/cron` → `/api/wallet-tracker/notify` | **N** (N = tracked wallets) |

So the **main consumers** of your 40k CPU are:

1. **Wallets tab** – Each load or 60s refresh does **N** calls for alerts and **N** calls for trades when the user opens/refreshes. With 17 wallets, that’s **17 + 17 = 34** calls per “visit” to the Wallets tab, plus **17 more every 60 seconds** while they stay on that tab.
2. **New tab (New pairs)** – **1** call every 60 seconds while the user stays on that view.
3. **Scan** and **Test Moralis** – Only when used manually.

---

## 4. Files that contain Moralis logic (for reference)

- **`lib/api-clients/moralis.ts`** – Defines `getPumpFunNewTokens` and `getWalletBuySwapsFromMoralis` (all Moralis HTTP calls).
- **`lib/get-wallet-alerts.ts`** – Uses `getWalletBuySwapsFromMoralis` for each wallet when building alerts.
- **`app/api/new-pairs/route.ts`** – Uses `getPumpFunNewTokens`.
- **`app/api/scan/route.ts`** – Uses `getPumpFunNewTokens` (fallback).
- **`app/api/test-moralis/route.ts`** – Uses `getPumpFunNewTokens`.
- **`app/api/wallet-tracker/route.ts`** – Uses `getWalletAlerts()` (which uses Moralis per wallet).
- **`app/api/wallet-tracker/trades/route.ts`** – Uses `getWalletBuySwapsFromMoralis` per wallet.
- **`app/api/wallet-tracker/notify/route.ts`** – Uses `getWalletAlerts()` (which uses Moralis per wallet).

If you want to reduce CPU usage, the biggest levers are: **fewer or no Moralis calls on the Wallets tab** (e.g. use Helius/Birdeye first, or cache), and **less frequent auto-refresh** (or no auto-refresh on the Wallets tab).
