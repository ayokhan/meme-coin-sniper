-- AlterTable
ALTER TABLE "PerpAlert" ADD COLUMN IF NOT EXISTS "venue" TEXT NOT NULL DEFAULT 'hyperliquid';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScanAlertCooldown" (
    "venue" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "lastTriggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanAlertCooldown_pkey" PRIMARY KEY ("venue","symbol","alertKey")
);
