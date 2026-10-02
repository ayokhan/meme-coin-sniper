-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "founding" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "NovaProConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sharedDailyLimit" INTEGER NOT NULL DEFAULT 7,
    "pulseDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "refundMaxRuns" INTEGER NOT NULL DEFAULT 2,
    "foundingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "foundingSeats" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovaProConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_tier_expiresAt_idx" ON "Subscription"("tier", "expiresAt");
