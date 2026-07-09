-- Blofin partner promo config + affiliate link click tracking
CREATE TABLE "BlofinPartnerPromo" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "registerUrl" TEXT NOT NULL DEFAULT '',
    "headline" TEXT NOT NULL DEFAULT 'Trade on Blofin with NovaStaris',
    "bodyText" TEXT NOT NULL DEFAULT 'Open a Blofin account through our partner link, then connect your API keys to run NovaStaris trading bots on your account.',
    "promoLabel" TEXT NOT NULL DEFAULT '10% back on transfer fees',
    "ctaLabel" TEXT NOT NULL DEFAULT 'Register on Blofin',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlofinPartnerPromo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlofinPartnerLinkClick" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestHash" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlofinPartnerLinkClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlofinPartnerLinkClick_userId_idx" ON "BlofinPartnerLinkClick"("userId");
CREATE INDEX "BlofinPartnerLinkClick_clickedAt_idx" ON "BlofinPartnerLinkClick"("clickedAt");

ALTER TABLE "BlofinPartnerLinkClick" ADD CONSTRAINT "BlofinPartnerLinkClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
