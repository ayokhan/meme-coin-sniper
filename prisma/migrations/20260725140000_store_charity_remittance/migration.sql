-- SickKids remittance ledger for Nova Store / VIP giving

CREATE TABLE "StoreCharityRemittance" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "unitsCovered" INTEGER,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCharityRemittance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreCharityRemittance_purpose_paidAt_idx" ON "StoreCharityRemittance"("purpose", "paidAt" DESC);
