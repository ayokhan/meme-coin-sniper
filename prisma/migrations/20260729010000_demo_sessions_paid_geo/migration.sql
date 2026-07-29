-- AlterTable DemoSession
ALTER TABLE "DemoSession" ADD COLUMN IF NOT EXISTS "pageEyebrow" TEXT DEFAULT 'Session registration';
ALTER TABLE "DemoSession" ADD COLUMN IF NOT EXISTS "submitLabel" TEXT DEFAULT 'Complete registration';
ALTER TABLE "DemoSession" ADD COLUMN IF NOT EXISTS "priceUsdCents" INTEGER;

-- AlterTable DemoRegistration
ALTER TABLE "DemoRegistration" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "DemoRegistration" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "DemoRegistration" ADD COLUMN IF NOT EXISTS "amountPaidCents" INTEGER;
ALTER TABLE "DemoRegistration" ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT;
ALTER TABLE "DemoRegistration" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "DemoRegistration" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DemoRegistration_paymentStatus_idx" ON "DemoRegistration"("paymentStatus");
CREATE INDEX IF NOT EXISTS "DemoRegistration_stripeCheckoutSessionId_idx" ON "DemoRegistration"("stripeCheckoutSessionId");
