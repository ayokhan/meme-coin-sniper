ALTER TABLE "AnalyticsEvent" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_visitorId_createdAt_idx" ON "AnalyticsEvent"("visitorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_userId_createdAt_idx" ON "AnalyticsEvent"("userId", "createdAt");
