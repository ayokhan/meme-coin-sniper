-- AlterTable User: when user accepted Payment Terms and Conditions (required before payment)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paymentTermsAcceptedAt" TIMESTAMP(3);

-- AlterTable Subscription: Stripe Checkout session id for card payments (idempotent webhook)
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT;

-- CreateIndex: unique on stripeSessionId for idempotent webhook handling
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSessionId_key" ON "Subscription"("stripeSessionId");
