-- CreateTable
CREATE TABLE "MemeRunnerSettings" (
    "chain" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemeRunnerSettings_pkey" PRIMARY KEY ("chain")
);
