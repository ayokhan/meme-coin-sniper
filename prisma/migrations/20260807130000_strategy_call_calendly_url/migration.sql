-- Seed NovaStaris Calendly booking URL (30‑min feature strategy call).
UPDATE "StrategyCallConfig"
SET
  "enabled" = true,
  "bookingUrl" = 'https://calendly.com/novastaris-ai/30min',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'default';

INSERT INTO "StrategyCallConfig" ("id", "enabled", "bookingUrl", "updatedAt")
VALUES ('default', true, 'https://calendly.com/novastaris-ai/30min', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
