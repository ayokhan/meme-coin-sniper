-- Polymarket Tracker (admin + per-user tracked proxy wallets)

CREATE TABLE "PolymarketTrackedWallet" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nickname" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "global" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketTrackedWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PolymarketTrackedWallet_address_key" ON "PolymarketTrackedWallet"("address");
CREATE INDEX "PolymarketTrackedWallet_active_idx" ON "PolymarketTrackedWallet"("active");
CREATE INDEX "PolymarketTrackedWallet_global_idx" ON "PolymarketTrackedWallet"("global");

CREATE TABLE "UserPolymarketTrackedWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "nickname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPolymarketTrackedWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPolymarketTrackedWallet_userId_address_key" ON "UserPolymarketTrackedWallet"("userId", "address");
CREATE INDEX "UserPolymarketTrackedWallet_userId_idx" ON "UserPolymarketTrackedWallet"("userId");

ALTER TABLE "UserPolymarketTrackedWallet" ADD CONSTRAINT "UserPolymarketTrackedWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
