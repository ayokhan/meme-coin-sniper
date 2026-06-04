-- CreateTable
CREATE TABLE "TradingBotJournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "instId" TEXT,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "takeProfitPrice" DOUBLE PRECISION,
    "stopLossPrice" DOUBLE PRECISION,
    "leverage" INTEGER,
    "positionNotionalUsdt" DOUBLE PRECISION,
    "realizedPnlUsdt" DOUBLE PRECISION,
    "roiPct" DOUBLE PRECISION,
    "outcome" TEXT NOT NULL DEFAULT 'open',
    "blofinMode" TEXT,
    "novaRadarSnapshot" TEXT,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingBotJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradingBotJournalEntry_userId_createdAt_idx" ON "TradingBotJournalEntry"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TradingBotJournalEntry_userId_externalId_key" ON "TradingBotJournalEntry"("userId", "externalId");

-- AddForeignKey
ALTER TABLE "TradingBotJournalEntry" ADD CONSTRAINT "TradingBotJournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
