-- Trial desk daily limit: default 3 (was 5). Apply to existing config row too.
ALTER TABLE "VipTrialConfig" ALTER COLUMN "dailyLimitPerDesk" SET DEFAULT 3;
UPDATE "VipTrialConfig" SET "dailyLimitPerDesk" = 3 WHERE "id" = 'default';
