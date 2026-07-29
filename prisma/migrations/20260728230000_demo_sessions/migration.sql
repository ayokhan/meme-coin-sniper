-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sessionAt" TIMESTAMP(3),
    "timezone" TEXT DEFAULT 'America/Toronto',
    "meetingUrl" TEXT,
    "meetingPlatform" TEXT,
    "locationNote" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "maxAttendees" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoRegistration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "country" TEXT,
    "cryptoExperience" TEXT,
    "forexExperience" TEXT,
    "newsletterOptIn" BOOLEAN NOT NULL DEFAULT false,
    "promoOptIn" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_slug_key" ON "DemoSession"("slug");

-- CreateIndex
CREATE INDEX "DemoSession_isPublished_sessionAt_idx" ON "DemoSession"("isPublished", "sessionAt");

-- CreateIndex
CREATE INDEX "DemoRegistration_sessionId_createdAt_idx" ON "DemoRegistration"("sessionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "DemoRegistration_email_idx" ON "DemoRegistration"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DemoRegistration_sessionId_email_key" ON "DemoRegistration"("sessionId", "email");

-- AddForeignKey
ALTER TABLE "DemoRegistration" ADD CONSTRAINT "DemoRegistration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
