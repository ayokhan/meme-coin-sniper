-- CreateTable
CREATE TABLE "NovaScalpPlanFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframeId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entered" BOOLEAN NOT NULL,
    "outcome" TEXT,
    "entryPrice" DOUBLE PRECISION,
    "exitPrice" DOUBLE PRECISION,
    "stopLossPrice" DOUBLE PRECISION,
    "amountUsd" DOUBLE PRECISION,
    "leverage" INTEGER,
    "analyzedAt" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovaScalpPlanFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovaScalpPlanFeedback_userId_idx" ON "NovaScalpPlanFeedback"("userId");

-- CreateIndex
CREATE INDEX "NovaScalpPlanFeedback_symbol_idx" ON "NovaScalpPlanFeedback"("symbol");

-- CreateIndex
CREATE INDEX "NovaScalpPlanFeedback_outcome_idx" ON "NovaScalpPlanFeedback"("outcome");

-- CreateIndex
CREATE INDEX "NovaScalpPlanFeedback_createdAt_idx" ON "NovaScalpPlanFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "NovaScalpPlanFeedback" ADD CONSTRAINT "NovaScalpPlanFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
