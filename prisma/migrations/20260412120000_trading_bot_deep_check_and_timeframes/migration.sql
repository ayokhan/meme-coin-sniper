-- AI Monitor Deep check: TP targets, optional timeframes JSON, deep cycle flags
ALTER TABLE "TradingBot" ADD COLUMN IF NOT EXISTS "monitorTpTargetsJson" TEXT;
ALTER TABLE "TradingBot" ADD COLUMN IF NOT EXISTS "monitorDeepTimeframesJson" TEXT;
ALTER TABLE "TradingBot" ADD COLUMN IF NOT EXISTS "aiMonitorRunDeepEachCycle" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TradingBot" ADD COLUMN IF NOT EXISTS "aiMonitorDeepCheckAutopilot" BOOLEAN NOT NULL DEFAULT false;
