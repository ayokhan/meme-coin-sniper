-- Login events for multi-location / credential-sharing detection
CREATE TABLE IF NOT EXISTS "LoginEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "country" TEXT,
  "city" TEXT,
  "deviceType" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_country_idx" ON "LoginEvent"("country");

ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
