-- CreateTable
CREATE TABLE "JobAgentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobTitles" JSONB NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "region" TEXT,
    "remoteOk" BOOLEAN NOT NULL DEFAULT true,
    "workTypes" JSONB NOT NULL,
    "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "targetApplicationsPerDay" INTEGER NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAgentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAgentResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "contentText" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAgentResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAgentApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "workType" TEXT,
    "jobUrl" TEXT,
    "source" TEXT,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "coverLetter" TEXT,
    "resumeSnapshot" TEXT,
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAgentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobAgentProfile_userId_key" ON "JobAgentProfile"("userId");

-- CreateIndex
CREATE INDEX "JobAgentResume_userId_idx" ON "JobAgentResume"("userId");

-- CreateIndex
CREATE INDEX "JobAgentApplication_userId_createdAt_idx" ON "JobAgentApplication"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JobAgentApplication_userId_status_idx" ON "JobAgentApplication"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobAgentApplication_userId_externalId_key" ON "JobAgentApplication"("userId", "externalId");

-- AddForeignKey
ALTER TABLE "JobAgentProfile" ADD CONSTRAINT "JobAgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAgentResume" ADD CONSTRAINT "JobAgentResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAgentApplication" ADD CONSTRAINT "JobAgentApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
