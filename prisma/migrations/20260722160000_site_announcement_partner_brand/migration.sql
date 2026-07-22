-- Site announcement: which partner logo to show (Blofin | Vantage | TIOmarkets)
ALTER TABLE "SiteAnnouncementBanner" ADD COLUMN IF NOT EXISTS "partnerBrand" TEXT NOT NULL DEFAULT 'blofin';
