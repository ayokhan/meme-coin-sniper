-- AlterTable User: admin can allow NovaConnect for non-paid users
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "novaConnectAllowedByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable NovaConnectMessage: replies to community posts
ALTER TABLE "NovaConnectMessage" ADD COLUMN IF NOT EXISTS "parentMessageId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NovaConnectMessage_parentMessageId_idx" ON "NovaConnectMessage"("parentMessageId");
