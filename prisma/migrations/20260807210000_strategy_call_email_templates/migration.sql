-- Editable Strategy call email templates (auto confirmation + schedule outreach).
ALTER TABLE "PaidStrategyCallConfig" ADD COLUMN IF NOT EXISTS "confirmationSubject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PaidStrategyCallConfig" ADD COLUMN IF NOT EXISTS "confirmationBody" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PaidStrategyCallConfig" ADD COLUMN IF NOT EXISTS "scheduleSubject" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PaidStrategyCallConfig" ADD COLUMN IF NOT EXISTS "scheduleBody" TEXT NOT NULL DEFAULT '';
