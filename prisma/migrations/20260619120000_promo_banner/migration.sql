-- CreateTable
CREATE TABLE "PromoBanner" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT NOT NULL DEFAULT 'Join free for a chance to win',
    "prizeLabel" TEXT NOT NULL DEFAULT '1 SOL',
    "drawAt" TIMESTAMP(3),
    "bodyText" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Join free',
    "ctaHref" TEXT NOT NULL DEFAULT '/register',
    "showOnDashboard" BOOLEAN NOT NULL DEFAULT true,
    "showOnRegister" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoBanner_pkey" PRIMARY KEY ("id")
);

-- Launch default: 1 SOL giveaway draw end of August 2026
INSERT INTO "PromoBanner" (
    "id",
    "enabled",
    "headline",
    "prizeLabel",
    "drawAt",
    "bodyText",
    "ctaLabel",
    "ctaHref",
    "showOnDashboard",
    "showOnRegister",
    "updatedAt"
) VALUES (
    'default',
    true,
    'Join free for a chance to win',
    '1 SOL',
    '2026-08-31T23:59:59.000Z',
    'Create your free NovaStaris account — no credit card. One random eligible member wins after the draw.',
    'Join free',
    '/register',
    true,
    true,
    CURRENT_TIMESTAMP
);
