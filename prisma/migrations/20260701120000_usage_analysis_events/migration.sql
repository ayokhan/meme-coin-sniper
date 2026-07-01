-- CreateTable
CREATE TABLE "UsageAnalysisEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageAnalysisEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageAnalysisEvent_userId_createdAt_idx" ON "UsageAnalysisEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageAnalysisEvent_createdAt_idx" ON "UsageAnalysisEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UsageAnalysisEvent" ADD CONSTRAINT "UsageAnalysisEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
