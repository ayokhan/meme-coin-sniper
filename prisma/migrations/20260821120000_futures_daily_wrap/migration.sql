-- CreateTable
CREATE TABLE "FuturesDailyWrap" (
    "id" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "hotTopics" JSONB NOT NULL,
    "marketUpdates" JSONB NOT NULL,
    "emailTeaser" JSONB NOT NULL,
    "telegramHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuturesDailyWrap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuturesDailyWrap_dateKey_key" ON "FuturesDailyWrap"("dateKey");

-- CreateIndex
CREATE INDEX "FuturesDailyWrap_publishedAt_idx" ON "FuturesDailyWrap"("publishedAt");
