-- AlterTable
ALTER TABLE "JobAgentProfile" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "JobAgentProfile" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "JobAgentProfile" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
