-- CreateTable: owner-only feedback on NovaSmart Analysis (did the suggestion work?)
CREATE TABLE "NovaSmartFeedback" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "worked" BOOLEAN NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovaSmartFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovaSmartFeedback_symbol_idx" ON "NovaSmartFeedback"("symbol");

-- CreateIndex
CREATE INDEX "NovaSmartFeedback_worked_idx" ON "NovaSmartFeedback"("worked");

-- CreateIndex
CREATE INDEX "NovaSmartFeedback_createdAt_idx" ON "NovaSmartFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "NovaSmartFeedback" ADD CONSTRAINT "NovaSmartFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
