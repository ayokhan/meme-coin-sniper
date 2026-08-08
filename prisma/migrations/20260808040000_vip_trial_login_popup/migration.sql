-- VIP trial login popup toggle (owner can promote trial in-app without email blast).
ALTER TABLE "VipTrialConfig" ADD COLUMN IF NOT EXISTS "showLoginPopup" BOOLEAN NOT NULL DEFAULT false;
