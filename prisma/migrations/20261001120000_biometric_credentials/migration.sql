-- Per-device fingerprint sign-in credentials (Android app)
CREATE TABLE IF NOT EXISTS "BiometricCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "deviceLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "BiometricCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BiometricCredential_userId_idx" ON "BiometricCredential"("userId");

ALTER TABLE "BiometricCredential" ADD CONSTRAINT "BiometricCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
