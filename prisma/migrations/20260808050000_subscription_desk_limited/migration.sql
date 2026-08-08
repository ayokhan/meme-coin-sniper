-- Limited VIP grants: same desk daily caps as card trial (admin complimentary).
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "deskLimited" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Subscription_deskLimited_expiresAt_idx" ON "Subscription"("deskLimited", "expiresAt");
