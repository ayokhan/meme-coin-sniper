CREATE TABLE IF NOT EXISTS "LocaleConfig" (
    "id" TEXT NOT NULL,
    "enabledLocales" JSONB NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocaleConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "LocaleConfig" ("id", "enabledLocales", "defaultLocale", "updatedAt")
VALUES ('default', '["en","fr","yo"]'::jsonb, 'en', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
