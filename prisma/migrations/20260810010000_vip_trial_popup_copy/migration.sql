-- Editable VIP trial login popup copy (owner Admin → VIP trial).
ALTER TABLE "VipTrialConfig" ADD COLUMN IF NOT EXISTS "popupTitle" TEXT;
ALTER TABLE "VipTrialConfig" ADD COLUMN IF NOT EXISTS "popupBody" TEXT;
ALTER TABLE "VipTrialConfig" ADD COLUMN IF NOT EXISTS "popupCtaLabel" TEXT;
ALTER TABLE "VipTrialConfig" ADD COLUMN IF NOT EXISTS "popupSecondaryCtaLabel" TEXT;
