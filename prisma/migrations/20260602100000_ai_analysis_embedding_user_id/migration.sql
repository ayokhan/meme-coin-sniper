-- AlterTable
ALTER TABLE "AiAnalysisEmbedding" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "AiAnalysisEmbedding_userId_createdAt_idx" ON "AiAnalysisEmbedding"("userId", "createdAt");
