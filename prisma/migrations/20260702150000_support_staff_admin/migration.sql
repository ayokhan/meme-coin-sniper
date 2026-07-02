ALTER TABLE "User" ADD COLUMN "supportViewerAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "liveChatAgentAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "supportStaffName" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "agentDisplayName" TEXT;
