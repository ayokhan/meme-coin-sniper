-- AlterTable: add novaConnectCommunityRep to User (NovaConnect community rep / moderation)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "novaConnectCommunityRep" BOOLEAN NOT NULL DEFAULT false;
