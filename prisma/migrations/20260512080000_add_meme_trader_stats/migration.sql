-- CreateTable
CREATE TABLE "MemeTraderStats" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "label" TEXT,
    "realizedPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unrealizedHoldingsUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnlUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volumeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "winRatePct" DOUBLE PRECISION,
    "biggestWinMint" TEXT,
    "biggestWinSymbol" TEXT,
    "biggestWinPnlUsd" DOUBLE PRECISION,
    "notes" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemeTraderStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemeTraderStats_walletAddress_periodKey_key" ON "MemeTraderStats"("walletAddress", "periodKey");

-- CreateIndex
CREATE INDEX "MemeTraderStats_periodKey_totalPnlUsd_idx" ON "MemeTraderStats"("periodKey", "totalPnlUsd");

-- CreateIndex
CREATE INDEX "MemeTraderStats_periodKey_computedAt_idx" ON "MemeTraderStats"("periodKey", "computedAt");
