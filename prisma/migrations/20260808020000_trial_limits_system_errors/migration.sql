-- Trial desk daily limits + system error log
ALTER TABLE "VipTrialConfig" ADD COLUMN IF NOT EXISTS "dailyLimitPerDesk" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS "TrialDeskUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "desk" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialDeskUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrialDeskUsage_userId_desk_dayKey_key" ON "TrialDeskUsage"("userId", "desk", "dayKey");
CREATE INDEX IF NOT EXISTS "TrialDeskUsage_userId_dayKey_idx" ON "TrialDeskUsage"("userId", "dayKey");
CREATE INDEX IF NOT EXISTS "TrialDeskUsage_desk_dayKey_idx" ON "TrialDeskUsage"("desk", "dayKey");

CREATE TABLE IF NOT EXISTS "SystemErrorLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemErrorLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SystemErrorLog_createdAt_idx" ON "SystemErrorLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "SystemErrorLog_source_createdAt_idx" ON "SystemErrorLog"("source", "createdAt" DESC);
