-- Discovery call completion log + paid Strategy call config/orders.
CREATE TABLE IF NOT EXISTS "DiscoveryCallCompletion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "userId" TEXT,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscoveryCallCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DiscoveryCallCompletion_completedAt_idx" ON "DiscoveryCallCompletion"("completedAt");
CREATE INDEX IF NOT EXISTS "DiscoveryCallCompletion_userId_idx" ON "DiscoveryCallCompletion"("userId");
CREATE INDEX IF NOT EXISTS "DiscoveryCallCompletion_email_idx" ON "DiscoveryCallCompletion"("email");

DO $$ BEGIN
  ALTER TABLE "DiscoveryCallCompletion"
    ADD CONSTRAINT "DiscoveryCallCompletion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PaidStrategyCallConfig" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "showNavButton" BOOLEAN NOT NULL DEFAULT true,
  "priceUsd" INTEGER NOT NULL DEFAULT 200,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaidStrategyCallConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PaidStrategyCallConfig" ("id", "enabled", "showNavButton", "priceUsd", "updatedAt")
VALUES ('default', false, true, 200, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "PaidStrategyCallOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "stripeCheckoutSessionId" TEXT,
  "confirmationEmailSentAt" TIMESTAMP(3),
  "ownerAlertSentAt" TIMESTAMP(3),
  "notes" TEXT NOT NULL DEFAULT '',
  "paidAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaidStrategyCallOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaidStrategyCallOrder_stripeCheckoutSessionId_key"
  ON "PaidStrategyCallOrder"("stripeCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "PaidStrategyCallOrder_status_idx" ON "PaidStrategyCallOrder"("status");
CREATE INDEX IF NOT EXISTS "PaidStrategyCallOrder_userId_idx" ON "PaidStrategyCallOrder"("userId");
CREATE INDEX IF NOT EXISTS "PaidStrategyCallOrder_email_idx" ON "PaidStrategyCallOrder"("email");
CREATE INDEX IF NOT EXISTS "PaidStrategyCallOrder_paidAt_idx" ON "PaidStrategyCallOrder"("paidAt");
CREATE INDEX IF NOT EXISTS "PaidStrategyCallOrder_createdAt_idx" ON "PaidStrategyCallOrder"("createdAt");

DO $$ BEGIN
  ALTER TABLE "PaidStrategyCallOrder"
    ADD CONSTRAINT "PaidStrategyCallOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
