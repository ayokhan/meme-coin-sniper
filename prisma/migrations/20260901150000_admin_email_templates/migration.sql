-- Saved / archived admin email templates
CREATE TABLE "AdminEmailTemplate" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'nova-branded',
    "format" TEXT NOT NULL DEFAULT 'rich',
    "includePartnerLogos" BOOLEAN NOT NULL DEFAULT false,
    "partnerBrand" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "sourcePresetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AdminEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminEmailTemplate_status_updatedAt_idx" ON "AdminEmailTemplate"("status", "updatedAt" DESC);
CREATE INDEX "AdminEmailTemplate_sourcePresetId_status_idx" ON "AdminEmailTemplate"("sourcePresetId", "status");
