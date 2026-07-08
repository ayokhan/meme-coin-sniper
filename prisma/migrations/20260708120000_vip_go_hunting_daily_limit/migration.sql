-- AlterTable
ALTER TABLE "GoHuntingRefreshConfig" ADD COLUMN IF NOT EXISTS "vipDailyLimit" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "GoHuntingRefreshConfig" ADD COLUMN IF NOT EXISTS "vipAutoRefreshEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GoHuntingRefreshConfig" ADD COLUMN IF NOT EXISTS "vipAutoRefreshMinutes" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "GoHuntingRefreshCooldown" ADD COLUMN IF NOT EXISTS "refreshCount" INTEGER NOT NULL DEFAULT 0;
