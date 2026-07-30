-- AlterTable: capture approx location at registration from edge IP
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registeredCountry" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registeredCity" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registeredIpHash" TEXT;

-- Backfill from earliest login event when available (best proxy for older accounts)
UPDATE "User" u
SET
  "registeredCountry" = le.country,
  "registeredCity" = le.city,
  "registeredIpHash" = le."ipHash"
FROM (
  SELECT DISTINCT ON ("userId")
    "userId",
    country,
    city,
    "ipHash"
  FROM "LoginEvent"
  ORDER BY "userId", "createdAt" ASC
) le
WHERE u.id = le."userId"
  AND u."registeredCountry" IS NULL
  AND (le.country IS NOT NULL OR le.city IS NOT NULL);
