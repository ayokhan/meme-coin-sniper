-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN "liveTransferAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChatSession_liveTransferAt_idx" ON "ChatSession"("liveTransferAt");
