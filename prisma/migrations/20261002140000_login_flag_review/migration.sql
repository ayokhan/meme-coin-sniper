-- CreateTable
CREATE TABLE IF NOT EXISTS "LoginFlagReview" (
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenCountries" TEXT NOT NULL DEFAULT '',
    "seenByEmail" TEXT,

    CONSTRAINT "LoginFlagReview_pkey" PRIMARY KEY ("userId")
);
