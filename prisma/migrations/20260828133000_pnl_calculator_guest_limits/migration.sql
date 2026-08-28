-- AlterTable
ALTER TABLE "PnlCalculatorConfig" ADD COLUMN "guestDailyLimit" INTEGER NOT NULL DEFAULT 2;

-- Bump default free tier for existing row
UPDATE "PnlCalculatorConfig" SET "freeDailyLimit" = 4 WHERE "id" = 'default' AND "freeDailyLimit" = 2;

-- CreateTable
CREATE TABLE "PnlCalculatorGuestUse" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PnlCalculatorGuestUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PnlCalculatorGuestUse_visitorId_createdAt_idx" ON "PnlCalculatorGuestUse"("visitorId", "createdAt");
