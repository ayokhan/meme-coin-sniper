-- Tracking + shipped email on orders; charity start dates (VIP promo going forward)

ALTER TABLE "StoreOrder" ADD COLUMN IF NOT EXISTS "trackingNumber" TEXT;
ALTER TABLE "StoreOrder" ADD COLUMN IF NOT EXISTS "shippedEmailSentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "StoreCharitySettings" (
    "id" TEXT NOT NULL,
    "vipDonationStartsAt" TIMESTAMP(3),
    "storeDonationStartsAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreCharitySettings_pkey" PRIMARY KEY ("id")
);

-- Default: VIP SickKids counting starts now (historical VIP purchases excluded)
INSERT INTO "StoreCharitySettings" ("id", "vipDonationStartsAt", "storeDonationStartsAt", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
