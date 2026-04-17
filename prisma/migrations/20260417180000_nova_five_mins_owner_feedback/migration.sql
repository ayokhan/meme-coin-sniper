-- Owner-only training labels for Nova 5 mins (Polymarket-style lean vs outcome).
CREATE TABLE "NovaFiveMinsOwnerFeedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "symbolInput" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "horizonMinutes" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "convictionPct" INTEGER,
    "tapeRegime" TEXT,
    "lastClose" DOUBLE PRECISION,
    "benchmarkOpen" DOUBLE PRECISION,
    "feed" TEXT,
    "outcome" TEXT NOT NULL,
    "notes" TEXT,
    "analysisSummary" TEXT,

    CONSTRAINT "NovaFiveMinsOwnerFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NovaFiveMinsOwnerFeedback_userId_idx" ON "NovaFiveMinsOwnerFeedback"("userId");
CREATE INDEX "NovaFiveMinsOwnerFeedback_createdAt_idx" ON "NovaFiveMinsOwnerFeedback"("createdAt");
CREATE INDEX "NovaFiveMinsOwnerFeedback_outcome_idx" ON "NovaFiveMinsOwnerFeedback"("outcome");

ALTER TABLE "NovaFiveMinsOwnerFeedback" ADD CONSTRAINT "NovaFiveMinsOwnerFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
