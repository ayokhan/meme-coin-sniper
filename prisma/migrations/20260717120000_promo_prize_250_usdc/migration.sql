-- Switch giveaway prize default from 1 SOL to 250 USDC
ALTER TABLE "PromoBanner" ALTER COLUMN "prizeLabel" SET DEFAULT '250 USDC';

UPDATE "PromoBanner"
SET "prizeLabel" = '250 USDC'
WHERE "id" = 'default' AND "prizeLabel" = '1 SOL';
