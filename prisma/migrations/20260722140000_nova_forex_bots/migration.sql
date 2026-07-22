-- Nova Forex bots: per-user MT4/MT5 broker config, Nova Forex Bot, Nova Forex Scalper,
-- and forex broker affiliate promo + click tracking (Vantage | TIOmarkets).

-- Per-user forex broker (MT4/MT5) login — encrypted at rest.
CREATE TABLE "UserForexBrokerConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'mt5',
    "encryptedLogin" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "server" TEXT NOT NULL,
    "demoMode" BOOLEAN NOT NULL DEFAULT true,
    "metaApiAccountId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserForexBrokerConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserForexBrokerConfig_userId_broker_key" ON "UserForexBrokerConfig"("userId", "broker");
CREATE INDEX "UserForexBrokerConfig_userId_idx" ON "UserForexBrokerConfig"("userId");

ALTER TABLE "UserForexBrokerConfig" ADD CONSTRAINT "UserForexBrokerConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-broker forex partner promo config (Admin -> Banners -> Forex Broker Partners). id = broker.
CREATE TABLE "ForexBrokerPartnerPromo" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "registerUrl" TEXT NOT NULL DEFAULT '',
    "headline" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "promoLabel" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT '',
    "showLogosInBanner" BOOLEAN NOT NULL DEFAULT true,
    "includeLogosInEmail" BOOLEAN NOT NULL DEFAULT true,
    "includeLogosInBroadcast" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForexBrokerPartnerPromo_pkey" PRIMARY KEY ("id")
);

-- Tracked clicks on NovaStaris forex broker affiliate register links.
CREATE TABLE "ForexBrokerPartnerLinkClick" (
    "id" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "userId" TEXT,
    "guestHash" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForexBrokerPartnerLinkClick_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ForexBrokerPartnerLinkClick_userId_idx" ON "ForexBrokerPartnerLinkClick"("userId");
CREATE INDEX "ForexBrokerPartnerLinkClick_broker_idx" ON "ForexBrokerPartnerLinkClick"("broker");
CREATE INDEX "ForexBrokerPartnerLinkClick_clickedAt_idx" ON "ForexBrokerPartnerLinkClick"("clickedAt");

ALTER TABLE "ForexBrokerPartnerLinkClick" ADD CONSTRAINT "ForexBrokerPartnerLinkClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Nova Forex Bot: per-user MT4/MT5 EMA/MA crossover bot, traded via MetaAPI.
CREATE TABLE "NovaForexBotConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerForceOff" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'demo',
    "broker" TEXT NOT NULL DEFAULT 'vantage',
    "symbol" TEXT NOT NULL DEFAULT 'EURUSD',
    "timeframe" TEXT NOT NULL DEFAULT '15m',
    "lotSize" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "fastMA" INTEGER NOT NULL DEFAULT 9,
    "slowMA" INTEGER NOT NULL DEFAULT 21,
    "stopLossPips" DOUBLE PRECISION,
    "takeProfitPips" DOUBLE PRECISION,
    "magic" INTEGER,
    "inPosition" BOOLEAN NOT NULL DEFAULT false,
    "positionSide" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastDecision" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovaForexBotConfig_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NovaForexBotConfig_userId_idx" ON "NovaForexBotConfig"("userId");

ALTER TABLE "NovaForexBotConfig" ADD CONSTRAINT "NovaForexBotConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nova Forex Scalper: per-user MT4/MT5 entry/exit cross bot, traded via MetaAPI (mirrors NovaScalperConfig).
CREATE TABLE "NovaForexScalperConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "slot" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerForceOff" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'demo',
    "broker" TEXT NOT NULL DEFAULT 'vantage',
    "symbol" TEXT NOT NULL DEFAULT 'EURUSD',
    "side" TEXT NOT NULL DEFAULT 'long',
    "entryTrigger" TEXT NOT NULL DEFAULT 'cross_down',
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION NOT NULL,
    "stopLossPrice" DOUBLE PRECISION,
    "lotSize" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "maxRounds" INTEGER NOT NULL DEFAULT 0,
    "completedRounds" INTEGER NOT NULL DEFAULT 0,
    "inPosition" BOOLEAN NOT NULL DEFAULT false,
    "lastRefPrice" DOUBLE PRECISION,
    "lastTickAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovaForexScalperConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NovaForexScalperConfig_userId_slot_key" ON "NovaForexScalperConfig"("userId", "slot");
CREATE INDEX "NovaForexScalperConfig_userId_idx" ON "NovaForexScalperConfig"("userId");

ALTER TABLE "NovaForexScalperConfig" ADD CONSTRAINT "NovaForexScalperConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
