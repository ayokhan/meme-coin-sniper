-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "novaSessionSweepOnDemand" BOOLEAN NOT NULL DEFAULT false;
