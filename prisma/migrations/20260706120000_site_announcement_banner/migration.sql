CREATE TABLE IF NOT EXISTS "SiteAnnouncementBanner" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL DEFAULT 'What''s new on NovaStaris',
    "body" TEXT NOT NULL DEFAULT 'We have product updates for you. Check your account settings and explore the latest tools on the dashboard.',
    "ctaLabel" TEXT NOT NULL DEFAULT '',
    "ctaHref" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteAnnouncementBanner_pkey" PRIMARY KEY ("id")
);
