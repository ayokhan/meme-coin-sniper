-- CreateTable
CREATE TABLE "FeatureAccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FeatureAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureAccessRequest_feature_status_idx" ON "FeatureAccessRequest"("feature", "status");

-- CreateIndex
CREATE INDEX "FeatureAccessRequest_userId_feature_idx" ON "FeatureAccessRequest"("userId", "feature");

-- CreateIndex
CREATE INDEX "FeatureAccessRequest_createdAt_idx" ON "FeatureAccessRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "FeatureAccessRequest" ADD CONSTRAINT "FeatureAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
