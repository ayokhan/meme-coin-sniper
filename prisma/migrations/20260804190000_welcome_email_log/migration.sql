-- Audit log for auto welcome emails on signup.
CREATE TABLE IF NOT EXISTS "WelcomeEmailLog" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "userId" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "error" TEXT,
  "source" TEXT NOT NULL DEFAULT 'register',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WelcomeEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WelcomeEmailLog_createdAt_idx" ON "WelcomeEmailLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "WelcomeEmailLog_email_idx" ON "WelcomeEmailLog"("email");
CREATE INDEX IF NOT EXISTS "WelcomeEmailLog_userId_idx" ON "WelcomeEmailLog"("userId");
