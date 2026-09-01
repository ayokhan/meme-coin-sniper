-- GMGN VIP meme trading bot (per-user config + signals)
CREATE TABLE "GmgnVipBotUserConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerForceOff" BOOLEAN NOT NULL DEFAULT false,
    "tradingMode" TEXT NOT NULL DEFAULT 'semi_auto',
    "chains" JSONB NOT NULL DEFAULT '["sol","bsc","robinhood"]',
    "maxTradeUsd" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "maxDailyLossUsd" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "maxOpenTrades" INTEGER NOT NULL DEFAULT 3,
    "slippagePct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "stopLossPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "takeProfitPct" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "walletAddress" TEXT,
    "gmgnApiKeyEnc" TEXT,
    "gmgnPrivateKeyEnc" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmgnVipBotUserConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GmgnVipBotUserConfig_userId_key" ON "GmgnVipBotUserConfig"("userId");

CREATE TABLE "GmgnVipBotSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "action" TEXT NOT NULL DEFAULT 'buy',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "quoteJson" JSONB,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmgnVipBotSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GmgnVipBotSignal_userId_status_idx" ON "GmgnVipBotSignal"("userId", "status");
CREATE INDEX "GmgnVipBotSignal_userId_createdAt_idx" ON "GmgnVipBotSignal"("userId", "createdAt");

ALTER TABLE "GmgnVipBotUserConfig" ADD CONSTRAINT "GmgnVipBotUserConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmgnVipBotSignal" ADD CONSTRAINT "GmgnVipBotSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
