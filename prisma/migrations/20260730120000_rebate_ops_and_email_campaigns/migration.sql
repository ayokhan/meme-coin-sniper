-- AlterTable
ALTER TABLE "ForexPartnerRebatePayout" ADD COLUMN IF NOT EXISTS "lotsTraded" DOUBLE PRECISION;
ALTER TABLE "ForexPartnerRebatePayout" ADD COLUMN IF NOT EXISTS "suggestedAmountUsd" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ForexPartnerRebatePayout_userId_status_createdAt_idx" ON "ForexPartnerRebatePayout"("userId", "status", "createdAt" DESC);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnnouncementEmailCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'default',
    "format" TEXT NOT NULL DEFAULT 'rich',
    "audience" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "partnerBrand" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementEmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnnouncementEmailCampaign_createdAt_idx" ON "AnnouncementEmailCampaign"("createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnnouncementEmailCampaign_template_createdAt_idx" ON "AnnouncementEmailCampaign"("template", "createdAt" DESC);
