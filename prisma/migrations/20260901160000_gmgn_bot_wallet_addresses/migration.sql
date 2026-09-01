ALTER TABLE "GmgnVipBotUserConfig" ADD COLUMN "walletAddresses" JSONB NOT NULL DEFAULT '[]';

UPDATE "GmgnVipBotUserConfig"
SET "walletAddresses" = jsonb_build_array("walletAddress")
WHERE "walletAddress" IS NOT NULL AND TRIM("walletAddress") <> '' AND "walletAddresses" = '[]'::jsonb;
