-- Extend 250 USDC giveaway draw to October 31, 2026
UPDATE "PromoBanner"
SET "drawAt" = '2026-10-31T23:59:59.000Z'
WHERE "id" = 'default';
