-- Card-required VIP trial config, email logs, cancel surveys, subscription trial fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vipTrialUsedAt" TIMESTAMP(3);

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "isTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "trialReminderEmailSentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "VipTrialConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "trialDays" INTEGER NOT NULL DEFAULT 2,
    "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24,
    "planIdAfterTrial" TEXT NOT NULL DEFAULT '1month',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VipTrialConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VipTrialEmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "kind" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VipTrialEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VipTrialEmailLog_createdAt_idx" ON "VipTrialEmailLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "VipTrialEmailLog_email_idx" ON "VipTrialEmailLog"("email");
CREATE INDEX IF NOT EXISTS "VipTrialEmailLog_userId_idx" ON "VipTrialEmailLog"("userId");
CREATE INDEX IF NOT EXISTS "VipTrialEmailLog_kind_createdAt_idx" ON "VipTrialEmailLog"("kind", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "VipCancelSurvey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "reasons" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "wasTrial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VipCancelSurvey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VipCancelSurvey_subscriptionId_key" ON "VipCancelSurvey"("subscriptionId");
CREATE INDEX IF NOT EXISTS "VipCancelSurvey_createdAt_idx" ON "VipCancelSurvey"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "VipCancelSurvey_userId_idx" ON "VipCancelSurvey"("userId");

CREATE INDEX IF NOT EXISTS "Subscription_isTrial_trialEndsAt_idx" ON "Subscription"("isTrial", "trialEndsAt");

DO $$ BEGIN
  ALTER TABLE "VipCancelSurvey" ADD CONSTRAINT "VipCancelSurvey_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "VipCancelSurvey" ADD CONSTRAINT "VipCancelSurvey_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
