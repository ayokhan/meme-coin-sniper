-- NovaStaris Affiliate Program

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx" ON "User"("referredByUserId");

DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey"
    FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ReferralCommission" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "refereeUserId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "subscriptionAmountUsd" INTEGER NOT NULL,
    "commissionRatePct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "commissionAmountUsd" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_verification',
    "paidAt" TIMESTAMP(3),
    "paidByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommission_subscriptionId_key" ON "ReferralCommission"("subscriptionId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_referrerUserId_idx" ON "ReferralCommission"("referrerUserId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_refereeUserId_idx" ON "ReferralCommission"("refereeUserId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_status_idx" ON "ReferralCommission"("status");
CREATE INDEX IF NOT EXISTS "ReferralCommission_createdAt_idx" ON "ReferralCommission"("createdAt");

DO $$ BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerUserId_fkey"
    FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_refereeUserId_fkey"
    FOREIGN KEY ("refereeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
