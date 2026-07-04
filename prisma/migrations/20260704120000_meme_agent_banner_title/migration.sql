-- AlterTable
ALTER TABLE "MemeAgentBanner" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Don''t Get Rugged';

-- Update existing rows to new default message when still on prior copy
UPDATE "MemeAgentBanner"
SET "message" = 'Before entering a trade on Dex Screener, GMGN, Pump.fun, Axiom or Padre, analyze the coin first here with Nova AI Agent to make an entry you can take profit from.'
WHERE "message" IN (
  'Before entering a trade on Dex Screener, GMGN, Pump.fun, Axiom or Padre, analyze the coin first here with Nova AI Analysis.',
  'About to trade on Dex Screener, GMGN, Pump.fun, Axiom, or Padre? Run Nova AI Analysis here first — score the token before you enter the trade.'
);
