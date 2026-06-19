-- Align promo banner defaults with Sign up for free CTA copy
ALTER TABLE "PromoBanner" ALTER COLUMN "headline" SET DEFAULT 'Sign up for free for a chance to win';
ALTER TABLE "PromoBanner" ALTER COLUMN "ctaLabel" SET DEFAULT 'Sign up for free';

UPDATE "PromoBanner"
SET
  "headline" = CASE
    WHEN "headline" = 'Join free for a chance to win' THEN 'Sign up for free for a chance to win'
    ELSE "headline"
  END,
  "ctaLabel" = CASE
    WHEN "ctaLabel" = 'Join free' THEN 'Sign up for free'
    ELSE "ctaLabel"
  END
WHERE "id" = 'default';
