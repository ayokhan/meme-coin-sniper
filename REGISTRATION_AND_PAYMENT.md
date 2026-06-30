# Registration & Payment – How It Works

## Registration options
1. **Email + password** – Classic form; password is hashed and stored.
2. **Sign in with Google** – One-click using Google OAuth (no password stored).
3. **Connect Solana wallet** – User connects Phantom (or other Solana wallet); they sign a one-time message to prove ownership; we create/link an account by wallet address.

## Free vs paid
- **Free (no account or not subscribed):** Can only see **5 New pairs** and **5 Trending** coins. All other tabs (Surge, Transactions, NovaStaris AI Analysis, CT Scan, Wallet Tracker) are locked or hidden.
- **Paid (active subscription):** Full access to all tabs and NovaStaris AI Analysis.

## Payment by Solana (USDC)
- Prices are in **USD**; we use **USDC on Solana** so the amount is stable.
- **Your wallet:** You provide your Solana wallet address (e.g. Phantom). All payments go to this address.
- **Flow:**
  1. User chooses a plan and sees: “Send **250 USDC** to `[your wallet address]`” (for 1 month).
  2. User sends USDC from their wallet to your wallet.
  3. **Detection:** Either (a) you run a small job that checks your wallet’s incoming USDC transfers (e.g. via Helius or Solana RPC) and matches amount + optional memo, or (b) user clicks “I’ve paid” and pastes the **transaction signature**; we verify the tx on-chain (correct recipient, amount, USDC) and then activate their subscription.
  4. When a valid payment is detected or verified, we grant access (store subscription in DB with expiry date).

## Pricing
| Plan        | Price (USDC) | Card (+$8) |
|------------|--------------|------------|
| Pro 1 month    | $70        | $78        |
| Pro 6 months   | $350       | $358       |
| Pro 12 months  | $700       | $708       |
| VIP 1-day trial| $20        | $20        |
| VIP 1 month    | $150       | $158       |
| VIP 6 months   | $750       | $758       |
| VIP 12 months  | $1,500     | $1,508     |

All USDC amounts are collected on Solana (e.g. “Send 70 USDC”).

## What you need to provide
- **Solana wallet address** – The public key that receives USDC (e.g. from your Phantom wallet). Set in env as `SOLANA_PAYMENT_WALLET`.
- (Optional) **USDC mint** on Solana – Default is the standard USDC mint; only change if you use a different stablecoin.

After implementation you’ll set this wallet in Vercel (or .env) so the app knows where to tell users to send USDC.
