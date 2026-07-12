-- Timed final exam session fields
ALTER TABLE "TradingUniversityProgress" ADD COLUMN IF NOT EXISTS "quizExamStartedAt" TIMESTAMP(3);
ALTER TABLE "TradingUniversityProgress" ADD COLUMN IF NOT EXISTS "examTabLeaveCount" INTEGER NOT NULL DEFAULT 0;
