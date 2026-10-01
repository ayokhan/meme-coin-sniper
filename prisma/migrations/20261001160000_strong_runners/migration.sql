-- Strong Runners (Narratives → VIP)
CREATE TABLE IF NOT EXISTS "StrongRunnerConfig" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "vipDailyLimit" INTEGER NOT NULL DEFAULT 10,
  "minMarketCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 3000000,
  "maxMarketCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 150000000,
  "minLiquidityUsd" DOUBLE PRECISION NOT NULL DEFAULT 250000,
  "minLiquidityRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.04,
  "minVolume24hUsd" DOUBLE PRECISION NOT NULL DEFAULT 1000000,
  "minAgeHours" DOUBLE PRECISION NOT NULL DEFAULT 48,
  "minConvictionScore" INTEGER NOT NULL DEFAULT 55,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StrongRunnerConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StrongRunnerScan" (
  "id" TEXT NOT NULL,
  "chain" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StrongRunnerScan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StrongRunnerScan_chain_createdAt_idx" ON "StrongRunnerScan"("chain", "createdAt");

CREATE TABLE IF NOT EXISTS "StrongRunnerPick" (
  "id" TEXT NOT NULL,
  "chain" TEXT NOT NULL,
  "tokenAddress" TEXT NOT NULL,
  "pairAddress" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "convictionScore" INTEGER NOT NULL,
  "narrative" TEXT,
  "mcapAtFlag" DOUBLE PRECISION NOT NULL,
  "priceAtFlag" DOUBLE PRECISION NOT NULL,
  "liquidityAtFlag" DOUBLE PRECISION NOT NULL,
  "flaggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "peakMcap" DOUBLE PRECISION,
  "lastMcap" DOUBLE PRECISION,
  "lastCheckedAt" TIMESTAMP(3),
  "mcap1d" DOUBLE PRECISION,
  "mcap7d" DOUBLE PRECISION,
  "mcap30d" DOUBLE PRECISION,
  CONSTRAINT "StrongRunnerPick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StrongRunnerPick_chain_tokenAddress_flaggedAt_idx" ON "StrongRunnerPick"("chain", "tokenAddress", "flaggedAt");
CREATE INDEX IF NOT EXISTS "StrongRunnerPick_flaggedAt_idx" ON "StrongRunnerPick"("flaggedAt");
