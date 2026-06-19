-- Banner button: Sign up for free -> Sign up free (matches header CTA)
ALTER TABLE "PromoBanner" ALTER COLUMN "ctaLabel" SET DEFAULT 'Sign up free';

UPDATE "PromoBanner"
SET "ctaLabel" = 'Sign up free'
WHERE "id" = 'default'
  AND "ctaLabel" = 'Sign up for free';
