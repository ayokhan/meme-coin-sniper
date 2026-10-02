-- Email Studio campaigns + per-recipient tracking
CREATE TABLE IF NOT EXISTS "EmailStudioCampaign" (
    "id" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "cappedCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "EmailStudioCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailStudioCampaign_createdAt_idx" ON "EmailStudioCampaign"("createdAt" DESC);

CREATE TABLE IF NOT EXISTS "EmailStudioRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailStudioRecipient_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailStudioRecipient_campaignId_idx" ON "EmailStudioRecipient"("campaignId");
CREATE INDEX IF NOT EXISTS "EmailStudioRecipient_email_sentAt_idx" ON "EmailStudioRecipient"("email", "sentAt");

DO $$ BEGIN
  ALTER TABLE "EmailStudioRecipient"
    ADD CONSTRAINT "EmailStudioRecipient_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "EmailStudioCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
