-- Per-user scan filter thresholds for GMGN VIP bot
ALTER TABLE "GmgnVipBotUserConfig" ADD COLUMN "minLiquidityUsd" DOUBLE PRECISION NOT NULL DEFAULT 15000;
ALTER TABLE "GmgnVipBotUserConfig" ADD COLUMN "minMomentum1hPct" DOUBLE PRECISION NOT NULL DEFAULT 5;
