-- Optional 2FA fields on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorMethod" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecretEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpBackupCodesHash" TEXT;

-- Email OTP during sign-in
CREATE TABLE IF NOT EXISTS "TwoFactorEmailOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TwoFactorEmailOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TwoFactorEmailOtp_userId_idx" ON "TwoFactorEmailOtp"("userId");
CREATE INDEX IF NOT EXISTS "TwoFactorEmailOtp_expiresAt_idx" ON "TwoFactorEmailOtp"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "TwoFactorEmailOtp" ADD CONSTRAINT "TwoFactorEmailOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Owner-managed Meme Coins Agent banner
CREATE TABLE IF NOT EXISTS "MemeAgentBanner" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT NOT NULL DEFAULT 'Before entering a trade on Dex Screener, GMGN, Pump.fun, Axiom or Padre, analyze the coin first here with Nova AI Analysis.',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemeAgentBanner_pkey" PRIMARY KEY ("id")
);
