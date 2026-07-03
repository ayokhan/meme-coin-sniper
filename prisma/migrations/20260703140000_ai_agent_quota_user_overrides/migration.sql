-- AlterTable
ALTER TABLE "User" ADD COLUMN "aiAgentWeeklyLimitOverride" INTEGER;
ALTER TABLE "User" ADD COLUMN "aiAgentMonthlyLimitOverride" INTEGER;
ALTER TABLE "User" ADD COLUMN "aiChartAnalysisWeeklyLimitOverride" INTEGER;
ALTER TABLE "User" ADD COLUMN "aiChartAnalysisMonthlyLimitOverride" INTEGER;
