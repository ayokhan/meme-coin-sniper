-- AlterTable User: VIP on-demand access to Nova Prop Firm Bot
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "propFirmBotOnDemand" BOOLEAN NOT NULL DEFAULT false;
