-- List price for complimentary VIP strategy session (value / savings messaging).
ALTER TABLE "VipStrategySessionPromoConfig"
ADD COLUMN IF NOT EXISTS "sessionListPriceUsd" INTEGER NOT NULL DEFAULT 250;
