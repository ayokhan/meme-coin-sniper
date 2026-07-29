-- CreateTable
CREATE TABLE "ForexPartnerRebatePayout" (
    "id" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "userId" TEXT,
    "rewardType" TEXT NOT NULL,
    "rewardValue" DOUBLE PRECISION NOT NULL,
    "amountPaidUsd" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "periodNote" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForexPartnerRebatePayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForexPartnerRebatePayout_broker_status_createdAt_idx" ON "ForexPartnerRebatePayout"("broker", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ForexPartnerRebatePayout_customerEmail_idx" ON "ForexPartnerRebatePayout"("customerEmail");

-- CreateIndex
CREATE INDEX "ForexPartnerRebatePayout_status_createdAt_idx" ON "ForexPartnerRebatePayout"("status", "createdAt" DESC);
