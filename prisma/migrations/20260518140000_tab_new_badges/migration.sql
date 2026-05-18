-- CreateTable
CREATE TABLE "TabNewBadge" (
    "tabId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabNewBadge_pkey" PRIMARY KEY ("tabId")
);
