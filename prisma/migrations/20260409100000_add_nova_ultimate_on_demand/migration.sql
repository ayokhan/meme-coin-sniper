-- AlterTable User: VIP on-demand access to Nova Ultimate (meme sniper / Phantom Terminal workspace)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "novaUltimateOnDemand" BOOLEAN NOT NULL DEFAULT false;
