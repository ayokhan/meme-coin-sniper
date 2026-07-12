-- NovaStaris Trading University progress + quiz graduation
CREATE TABLE "TradingUniversityProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedLessons" JSONB NOT NULL DEFAULT '[]',
    "quizPassed" BOOLEAN NOT NULL DEFAULT false,
    "quizBestScorePct" DOUBLE PRECISION,
    "quizPassedAt" TIMESTAMP(3),
    "certificateCode" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "lastFailedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingUniversityProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradingUniversityProgress_userId_key" ON "TradingUniversityProgress"("userId");
CREATE UNIQUE INDEX "TradingUniversityProgress_certificateCode_key" ON "TradingUniversityProgress"("certificateCode");
CREATE INDEX "TradingUniversityProgress_quizPassed_quizPassedAt_idx" ON "TradingUniversityProgress"("quizPassed", "quizPassedAt");

ALTER TABLE "TradingUniversityProgress" ADD CONSTRAINT "TradingUniversityProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
