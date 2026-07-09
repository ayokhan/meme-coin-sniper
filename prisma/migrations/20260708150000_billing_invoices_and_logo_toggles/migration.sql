-- Logo toggles for Blofin promo + partner logos on site announcement + billing invoices
ALTER TABLE "BlofinPartnerPromo" ADD COLUMN IF NOT EXISTS "showLogosInBanner" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BlofinPartnerPromo" ADD COLUMN IF NOT EXISTS "includeLogosInEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BlofinPartnerPromo" ADD COLUMN IF NOT EXISTS "includeLogosInBroadcast" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SiteAnnouncementBanner" ADD COLUMN IF NOT EXISTS "showPartnerLogos" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "stripeSessionId" TEXT,
    "amountUsd" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "plan" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "hostedInvoiceUrl" TEXT,
    "invoicePdfUrl" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingInvoice_stripeInvoiceId_key" ON "BillingInvoice"("stripeInvoiceId");
CREATE UNIQUE INDEX "BillingInvoice_stripeSessionId_key" ON "BillingInvoice"("stripeSessionId");
CREATE INDEX "BillingInvoice_userId_paidAt_idx" ON "BillingInvoice"("userId", "paidAt" DESC);

ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill billing history from existing VIP subscription payments (no Stripe API)
INSERT INTO "BillingInvoice" ("id", "userId", "stripeSessionId", "amountUsd", "currency", "plan", "description", "status", "paidAt", "periodStart", "periodEnd", "paymentMethod", "createdAt")
SELECT
    'sub_' || s."id",
    s."userId",
    s."stripeSessionId",
    s."amountUsd",
    'usd',
    s."plan",
    'NovaStaris VIP',
    'paid',
    s."createdAt",
    s."createdAt",
    s."expiresAt",
    CASE WHEN s."stripeSessionId" IS NOT NULL THEN 'card' WHEN s."txSignature" IS NOT NULL THEN 'usdc' ELSE 'other' END,
    s."createdAt"
FROM "Subscription" s
WHERE s."amountUsd" > 0
ON CONFLICT ("id") DO NOTHING;
