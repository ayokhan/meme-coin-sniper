-- CreateTable: VIP: Nova Investment Agent portfolio pins + owner feedback
CREATE TABLE "NovaInvestmentAgentPortfolioPin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseSymbol" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "riskProfitPreset" TEXT NOT NULL,
    "durationMode" TEXT NOT NULL,
    "totalExpectedReturnPct" DOUBLE PRECISION NOT NULL,
    "totalExpectedReturnUsd" DOUBLE PRECISION NOT NULL,
    "resultJson" JSONB NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerFeedbackWorked" BOOLEAN,
    "ownerFeedbackNote" TEXT,
    "ownerFeedbackAt" TIMESTAMP(3),

    CONSTRAINT "NovaInvestmentAgentPortfolioPin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NovaInvestmentAgentPortfolioPin_userId_pinnedAt_idx" ON "NovaInvestmentAgentPortfolioPin"("userId", "pinnedAt");

-- AddForeignKey
ALTER TABLE "NovaInvestmentAgentPortfolioPin" ADD CONSTRAINT "NovaInvestmentAgentPortfolioPin_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

