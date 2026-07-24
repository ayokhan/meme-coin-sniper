-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "novaJobAgentOnDemand" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "JobAgentProfile" ADD COLUMN IF NOT EXISTS "enabledBoards" JSONB NOT NULL DEFAULT '["remotive","remoteok","arbeitnow"]';
