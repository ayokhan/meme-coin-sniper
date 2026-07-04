-- Meme Agent banner style fields
ALTER TABLE "MemeAgentBanner" ADD COLUMN IF NOT EXISTS "titleColor" TEXT NOT NULL DEFAULT '#f472b6';
ALTER TABLE "MemeAgentBanner" ADD COLUMN IF NOT EXISTS "titleSize" TEXT NOT NULL DEFAULT '2xl';
ALTER TABLE "MemeAgentBanner" ADD COLUMN IF NOT EXISTS "titleFont" TEXT NOT NULL DEFAULT 'display';

-- Meme table analyze hint banner
CREATE TABLE IF NOT EXISTS "MemeTableAnalyzeHintBanner" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "guestTitle" TEXT NOT NULL DEFAULT 'Analyze any coin with Nova AI Analysis',
    "guestBody" TEXT NOT NULL DEFAULT 'Sign in or register free, then tap the purple Analyze button on any row. Nova AI Analysis works on Solana and BSC meme coins.',
    "freeTitle" TEXT NOT NULL DEFAULT 'Tap Analyze for Nova AI Analysis',
    "freeBody" TEXT NOT NULL DEFAULT 'Tap the purple Analyze button on any row to run Nova AI Analysis on any Solana or BSC meme coin.',
    "vipTitle" TEXT NOT NULL DEFAULT 'Unlimited Nova AI Analysis',
    "vipBody" TEXT NOT NULL DEFAULT 'Tap the purple Analyze button on any row to run Nova AI Analysis on any Solana or BSC meme coin — unlimited Meme Agent uses.',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemeTableAnalyzeHintBanner_pkey" PRIMARY KEY ("id")
);

-- Guest registration nudge banner
CREATE TABLE IF NOT EXISTS "GuestRegistrationNudgeBanner" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL DEFAULT 'Create a free NovaStaris account',
    "titleEngaged" TEXT NOT NULL DEFAULT 'Enjoying NovaStaris? Save your progress with a free account.',
    "body" TEXT NOT NULL DEFAULT 'Free to join · no credit card · save watchlists and get ready to upgrade when you want VIP tools.',
    "bodyEngaged" TEXT NOT NULL DEFAULT 'Sign up free in under a minute — save watchlists, track wallets, and unlock member features. No credit card required.',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestRegistrationNudgeBanner_pkey" PRIMARY KEY ("id")
);
