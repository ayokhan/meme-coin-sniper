-- AlterTable
ALTER TABLE "User" ADD COLUMN "aiAgentDailyLimitOverride" INTEGER;
ALTER TABLE "User" ADD COLUMN "aiChartAnalysisDailyLimitOverride" INTEGER;

-- CreateTable
CREATE TABLE "AiAgentQuotaConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "memeAgentFreeDailyLimit" INTEGER NOT NULL DEFAULT 2,
    "chartAnalysisFreeDailyLimit" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgentQuotaConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AiAgentQuotaConfig" ("id", "memeAgentFreeDailyLimit", "chartAnalysisFreeDailyLimit", "updatedAt")
VALUES ('default', 2, 2, CURRENT_TIMESTAMP);
