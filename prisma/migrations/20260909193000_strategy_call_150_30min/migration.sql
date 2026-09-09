-- Align Strategy call + VIP promo session list price to $150 / 30 min.
ALTER TABLE "PaidStrategyCallConfig" ALTER COLUMN "priceUsd" SET DEFAULT 150;
UPDATE "PaidStrategyCallConfig" SET "priceUsd" = 150 WHERE "id" = 'default';

ALTER TABLE "VipStrategySessionPromoConfig" ALTER COLUMN "sessionListPriceUsd" SET DEFAULT 150;
UPDATE "VipStrategySessionPromoConfig" SET "sessionListPriceUsd" = 150 WHERE "id" = 'default';
