-- CreateTable
CREATE TABLE "AiAnalysisEmbedding" (
    "id" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'solana',
    "symbol" TEXT,
    "summaryText" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "score" INTEGER,
    "signal" TEXT,
    "feedbackOutcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysisEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAnalysisEmbedding_contractAddress_idx" ON "AiAnalysisEmbedding"("contractAddress");

-- CreateIndex
CREATE INDEX "AiAnalysisEmbedding_createdAt_idx" ON "AiAnalysisEmbedding"("createdAt");
