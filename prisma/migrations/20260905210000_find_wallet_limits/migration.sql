-- Find Wallet daily limits (global + per-user overrides)
CREATE TABLE IF NOT EXISTS "FindWalletConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "vipDailyLimit" INTEGER NOT NULL DEFAULT 2,
    "freeDailyLimit" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindWalletConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FindWalletUserLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLimit" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindWalletUserLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FindWalletUserLimit_userId_key" ON "FindWalletUserLimit"("userId");

INSERT INTO "FindWalletConfig" ("id", "enabled", "vipDailyLimit", "freeDailyLimit", "updatedAt")
VALUES ('default', true, 2, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
