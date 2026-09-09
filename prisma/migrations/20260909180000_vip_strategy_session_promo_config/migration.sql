-- VIP Strategy Session promo: admin-editable end date (YYYY-MM-DD, America/New_York inclusive).
CREATE TABLE IF NOT EXISTS "VipStrategySessionPromoConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "endsOnDate" TEXT NOT NULL DEFAULT '2026-12-31',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VipStrategySessionPromoConfig_pkey" PRIMARY KEY ("id")
);
