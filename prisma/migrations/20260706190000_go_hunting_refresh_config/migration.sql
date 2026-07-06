-- CreateTable
CREATE TABLE "GoHuntingRefreshConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "guestIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "freeMemberIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "guestAutoRefreshEnabled" BOOLEAN NOT NULL DEFAULT false,
    "freeAutoRefreshEnabled" BOOLEAN NOT NULL DEFAULT false,
    "freeAutoRefreshMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoHuntingRefreshConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "GoHuntingRefreshConfig" ("id", "guestIntervalMinutes", "freeMemberIntervalMinutes", "guestAutoRefreshEnabled", "freeAutoRefreshEnabled", "freeAutoRefreshMinutes", "updatedAt")
VALUES ('default', 60, 60, false, false, 60, CURRENT_TIMESTAMP);

-- CreateTable
CREATE TABLE "GoHuntingRefreshCooldown" (
    "subjectKey" TEXT NOT NULL,
    "lastRefreshAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoHuntingRefreshCooldown_pkey" PRIMARY KEY ("subjectKey")
);
