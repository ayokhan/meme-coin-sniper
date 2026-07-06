CREATE TABLE IF NOT EXISTS "TwoFactorSecurityNudgeBanner" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL DEFAULT 'Secure your NovaStaris account',
    "body" TEXT NOT NULL DEFAULT 'Two-factor authentication is now available. Add Google Authenticator or email codes for an extra layer of protection when you sign in with email and password.',
    "ctaLabel" TEXT NOT NULL DEFAULT 'Set up 2FA',
    "registerSuccessMessage" TEXT NOT NULL DEFAULT 'Account created. Sign in to continue — then enable two-factor authentication in Account settings.',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwoFactorSecurityNudgeBanner_pkey" PRIMARY KEY ("id")
);
