UPDATE "MemeAgentBanner"
SET "message" = 'Before you enter a trade on Dex Screener, GMGN, Pump.fun, Axiom, or Padre, analyze the token here with Nova AI Agent first — so you trade with a clearer plan to take profit.'
WHERE "message" IN (
  'Before entering a trade on Dex Screener, GMGN, Pump.fun, Axiom or Padre, analyze the coin first here with Nova AI Analysis.',
  'Before entering a trade on Dex Screener, GMGN, Pump.fun, Axiom or Padre, analyze the coin first here with Nova AI Agent to make an entry you can take profit from.',
  'About to trade on Dex Screener, GMGN, Pump.fun, Axiom, or Padre? Run Nova AI Analysis here first — score the token before you enter the trade.'
);
