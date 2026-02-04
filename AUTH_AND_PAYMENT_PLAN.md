# NovaStaris Auth & Payment Plan

## Summary of Your Requirements

### Registration
- **Email + password** – classic form
- **Gmail OAuth** – quick sign-up
- **Solana wallet** – Phantom, MetaMask (Solana), etc.

### Tiers
- **Free:** 5 new pairs, 5 trending coins only
- **Paid:** Full dashboard

### Payment (Solana)
- **$250/month**
- **3 months:** $50 off → $700 total
- **6 months:** $100 off → $1,400 total

### Payment Flow (Your Assumption)
1. User provides their Solana wallet address.
2. You provide your payment wallet address + amount (SOL/USDC).
3. User sends payment.
4. System detects the payment and grants access.

---

## How Payment Detection Works on Solana

### Option A: Manual Tx Verification (Simplest)
- User pastes transaction signature (tx hash).
- Backend fetches tx via Solana RPC (Helius, QuickNode, etc.).
- Check: sender = user wallet, recipient = your wallet, amount ≥ required.
- If valid → mark user as paid, set expiry.

**Pros:** No webhooks, simple.  
**Cons:** User must paste tx; no automatic detection.

### Option B: Webhook (Helius / QuickNode)
- Use Helius or QuickNode webhook for incoming transfers.
- When a transfer hits your wallet from a known user wallet → verify amount → grant access.

**Pros:** Automatic.  
**Cons:** Needs webhook setup, webhook endpoint, and linking user wallet to account.

### Option C: Polling
- Periodically check your wallet’s recent transactions via RPC.
- Match sender wallet to user account and verify amount.

**Pros:** No webhook.  
**Cons:** Delay, extra RPC calls, not ideal at scale.

---

## Recommended Stack for Auth & Payment

### Auth
- **NextAuth.js** – email/password + Google OAuth
- **Wallet connect** – @solana/wallet-adapter for Phantom, etc.
- **Database** – Prisma `User` + `Subscription` models

### Payment
- **Phase 1:** Manual tx verification (paste tx hash).
- **Phase 2:** Helius webhook for automatic detection.

### Database Additions

```prisma
model User {
  id            String   @id @default(cuid())
  email         String?  @unique
  passwordHash  String?
  walletAddress String?  @unique  // Solana wallet for payments
  plan          String   @default("free")  // free | pro
  planExpiresAt DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Subscription {
  id        String   @id @default(cuid())
  userId    String
  txSignature String?  // Solana tx hash used for payment
  amount    Float    // USD paid
  months    Int      // 1, 3, or 6
  startsAt  DateTime
  expiresAt DateTime
}
```

---

## Implementation Steps (Suggested Order)

1. **Add User + Subscription models** to Prisma.
2. **Set up NextAuth** – credentials + Google provider.
3. **Add `/register` and `/login` pages.**
4. **Wallet connect** – connect Phantom/MetaMask, save `walletAddress` on user.
5. **Subscription page** – show pricing, your payment wallet, amount in SOL/USDC.
6. **Payment verification API** – POST `/api/verify-payment` with tx signature.
7. **Apply free-tier limits** – cap at 5 new pairs and 5 trending when `plan === "free"`.
8. **Protect routes** – redirect unauthenticated users to `/login`.
9. **Optional:** Helius webhook for automatic payment detection.

---

## Pricing Recap

| Plan     | Price        | Total   |
|----------|--------------|---------|
| 1 month  | $250         | $250    |
| 3 months | $250×3 − $50 | $700    |
| 6 months | $250×6 − $100| $1,400  |

---

## Next Steps

1. Run `npx prisma migrate dev` to add `source` column and any new models.
2. Decide whether to start with manual tx verification or a webhook-based flow.
3. Add auth (NextAuth + wallet) and then payment verification + plan enforcement.
