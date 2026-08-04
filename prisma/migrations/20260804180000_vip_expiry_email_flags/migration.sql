-- One-shot VIP expiry reminder tracking (pre + post).
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "expiryPreEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "expiryPostEmailSentAt" TIMESTAMP(3);
