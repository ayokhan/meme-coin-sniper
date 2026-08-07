-- Free strategy call booking URL (Calendly etc.).
CREATE TABLE IF NOT EXISTS "StrategyCallConfig" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "bookingUrl" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StrategyCallConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StrategyCallConfig" ("id", "enabled", "bookingUrl", "updatedAt")
VALUES ('default', false, '', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
