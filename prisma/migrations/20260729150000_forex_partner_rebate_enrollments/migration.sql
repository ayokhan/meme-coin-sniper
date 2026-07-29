-- CreateTable
CREATE TABLE "ForexPartnerRebateEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "mtLogin" TEXT NOT NULL,
    "usdcWallet" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL DEFAULT 'per_lot',
    "rewardValue" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForexPartnerRebateEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForexPartnerRebateEnrollment_broker_createdAt_idx" ON "ForexPartnerRebateEnrollment"("broker", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ForexPartnerRebateEnrollment_customerEmail_idx" ON "ForexPartnerRebateEnrollment"("customerEmail");

-- CreateIndex
CREATE INDEX "ForexPartnerRebateEnrollment_usdcWallet_idx" ON "ForexPartnerRebateEnrollment"("usdcWallet");

-- CreateIndex
CREATE UNIQUE INDEX "ForexPartnerRebateEnrollment_userId_broker_key" ON "ForexPartnerRebateEnrollment"("userId", "broker");

-- AddForeignKey
ALTER TABLE "ForexPartnerRebateEnrollment" ADD CONSTRAINT "ForexPartnerRebateEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
