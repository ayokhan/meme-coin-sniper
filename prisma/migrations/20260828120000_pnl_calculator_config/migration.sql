-- CreateTable
CREATE TABLE "PnlCalculatorConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "freeDailyLimit" INTEGER NOT NULL DEFAULT 2,
    "vipDailyLimit" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnlCalculatorConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PnlCalculatorUserLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyLimit" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PnlCalculatorUserLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PnlCalculatorUserLimit_userId_key" ON "PnlCalculatorUserLimit"("userId");
