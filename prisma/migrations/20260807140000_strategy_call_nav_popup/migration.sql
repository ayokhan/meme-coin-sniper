-- Nav button + one-time popup toggles for strategy call.
ALTER TABLE "StrategyCallConfig" ADD COLUMN IF NOT EXISTS "showNavButton" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StrategyCallConfig" ADD COLUMN IF NOT EXISTS "showOncePopup" BOOLEAN NOT NULL DEFAULT true;
