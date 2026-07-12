/** Static curriculum for NovaStaris Trading University (no external API calls). */

export type UniversityLesson = {
  id: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  sections: { heading: string; body: string[] }[];
  keyTerms: { term: string; definition: string }[];
};

export const TRADING_UNIVERSITY_PASS_PCT = 85;
export const TRADING_UNIVERSITY_QUIZ_SIZE = 20;

export const TRADING_UNIVERSITY_LESSONS: UniversityLesson[] = [
  {
    id: "meme-coins",
    title: "Meme coins",
    subtitle: "What they are, why they move, and how culture becomes price action.",
    estimatedMinutes: 8,
    sections: [
      {
        heading: "Definition",
        body: [
          "A meme coin is a cryptocurrency whose primary value driver is community, culture, humor, and attention — not cash-flow from a product. Think Dogecoin, PEPE, or thousands of newer tokens born on Solana and BSC.",
          "That does not mean every meme coin is a joke to traders. Liquidity, holders, narrative strength, and exchange listings still matter. It means fundamentals look different: social velocity often leads price more than revenue models.",
        ],
      },
      {
        heading: "Why meme coins move so fast",
        body: [
          "Supply is often large and float can be concentrated in early wallets. A few large sellers can crush price; coordinated buying or influencer attention can spark parabolic moves.",
          "Information spreads on X (Twitter), Telegram, Discord, and TikTok in minutes. NovaStaris tools (Go Hunting, CT Scan, Wallet Tracker) exist because timing and flow matter more than traditional valuation here.",
          "Most meme coins fail or go to near-zero. Survivors usually keep a sticky community, credible liquidity, and repeated narrative cycles.",
        ],
      },
      {
        heading: "Risk reality",
        body: [
          "Rugs, honeypots, fake liquidity, and wash trading are common. Always check contract risk, holder concentration, and whether you can actually sell.",
          "Treat size as entertainment capital you can lose 100% of — never rent money or bills for a meme trade.",
        ],
      },
    ],
    keyTerms: [
      { term: "Float", definition: "Tokens freely available to trade (not locked/vested)." },
      { term: "Narrative", definition: "The story driving attention (animal meme, politics, AI mashup, etc.)." },
      { term: "Rug", definition: "Developers or large holders dump liquidity / abandon the project." },
    ],
  },
  {
    id: "meme-trading",
    title: "Meme coin trading",
    subtitle: "Entries, exits, sizing, and process for high-volatility spots.",
    estimatedMinutes: 10,
    sections: [
      {
        heading: "Trading vs holding",
        body: [
          "Trading means a plan: entry zone, invalidation (stop), target(s), and time stop. Holding a bag with no plan is speculation without risk control.",
          "Meme charts are noisy. Favor clear catalysts (migration, listing rumor with confirmation, whale accumulation) over random green candles.",
        ],
      },
      {
        heading: "Core process",
        body: [
          "1) Screen: new pairs, volume surge, smart-wallet buys, CT buzz.",
          "2) Vet: liquidity, tax/honeypot checks, top holders, age, social authenticity.",
          "3) Size: small % of portfolio; scale in only if thesis strengthens.",
          "4) Manage: take partial profits into strength; never move a stop farther from entry to 'give it room' without a new thesis.",
          "5) Review: journal what worked — NovaStaris feedback loops exist for this reason.",
        ],
      },
      {
        heading: "Common mistakes",
        body: [
          "FOMO chasing after 5–10x already printed.",
          "Averaging down endless bags with no invalidation.",
          "Ignoring exit liquidity — if you cannot sell size, you do not have a real position.",
          "Overtrading every new ticker; edge comes from selectivity.",
        ],
      },
    ],
    keyTerms: [
      { term: "Invalidation", definition: "Price or condition that proves your trade idea wrong — exit." },
      { term: "Slippage", definition: "Difference between expected fill and actual fill in thin markets." },
      { term: "Time stop", definition: "Exit if thesis has not played out within a set window." },
    ],
  },
  {
    id: "solana",
    title: "Solana",
    subtitle: "The chain that powers most modern meme launches.",
    estimatedMinutes: 7,
    sections: [
      {
        heading: "What Solana is",
        body: [
          "Solana is a high-throughput Layer-1 blockchain designed for fast, low-fee transactions. That speed is why meme launchpads and snipers thrive here.",
          "SOL is the native token used for fees and staking. Congestion and fee spikes still happen during mania — plan for that.",
        ],
      },
      {
        heading: "Ecosystem pieces traders care about",
        body: [
          "Wallets (Phantom, Solflare, etc.), DEXs/aggregators (Jupiter), launchpads (Pump.fun and successors), and indexers/APIs used by tools like NovaStaris.",
          "Migrated coins often move from bonding-curve style launches to full DEX liquidity — a key lifecycle event for hunters.",
        ],
      },
      {
        heading: "Practical tips",
        body: [
          "Keep a dedicated hot wallet for degen trades; never store life savings on a trading wallet.",
          "Verify mint addresses. Scammers clone tickers and logos constantly.",
          "Revoke unused token approvals periodically if you use many dApps.",
        ],
      },
    ],
    keyTerms: [
      { term: "L1", definition: "Base blockchain (Solana, Ethereum, BSC) that settles transactions." },
      { term: "Mint", definition: "The unique token contract address on Solana." },
      { term: "Migration", definition: "Move from launchpad curve to open market liquidity." },
    ],
  },
  {
    id: "solana-memes",
    title: "Solana meme coins",
    subtitle: "Launch culture, bonding curves, and how Sol memes behave.",
    estimatedMinutes: 9,
    sections: [
      {
        heading: "Why Solana dominates meme launches",
        body: [
          "Cheap txs + fast finality = thousands of experiments per day. Most die; a few catch narrative fire and print multi-baggers.",
          "Speed rewards scanners and wallet trackers. Humans alone cannot watch every mint.",
        ],
      },
      {
        heading: "Lifecycle (simplified)",
        body: [
          "Create → early bonding / discovery → social ignition → liquidity deepen or migrate → listing rumors / CEX chatter → distribution and decay — or second legs if culture sticks.",
          "Early = highest upside and highest rug risk. Mid = clearer chart structure but worse entry. Late = often exit liquidity for early holders.",
        ],
      },
      {
        heading: "Edge on Sol memes",
        body: [
          "Follow quality wallets, not every KOLs' shill.",
          "Prefer coins with organic social graph over bot comment spam.",
          "Use NovaStaris Go Hunting views (new pairs, final stretch, migrated) as a map — then apply your own risk rules.",
        ],
      },
    ],
    keyTerms: [
      { term: "Bonding curve", definition: "Pricing mechanism where price rises as more tokens are bought pre-DEX." },
      { term: "KOL", definition: "Key opinion leader — influencer whose posts can move thin markets." },
      { term: "Bundle", definition: "Coordinated wallets buying at launch to control supply (often a red flag)." },
    ],
  },
  {
    id: "bsc-memes",
    title: "BSC meme coins",
    subtitle: "Binance Smart Chain memes — similar game, different rails.",
    estimatedMinutes: 8,
    sections: [
      {
        heading: "What BSC is",
        body: [
          "BNB Smart Chain (BSC) is an EVM-compatible chain with low fees and a large retail user base, especially in Asia and emerging markets.",
          "Tokens use 0x contract addresses. Tools, explorers (BscScan), and DEXs (PancakeSwap and others) differ from Solana UX.",
        ],
      },
      {
        heading: "How BSC memes differ",
        body: [
          "Often more 'classic' BEP-20 launches with LP locks, taxes, and Telegram-centric communities.",
          "Honeypots and high sell taxes are historically common — always simulate a sell before sizing up.",
          "Narrative overlap with Sol exists (animals, trends), but liquidity hours and influencer networks differ.",
        ],
      },
      {
        heading: "Trading notes",
        body: [
          "Gas is usually cheap, but stuck txs and approval phishing still happen.",
          "NovaStaris BSC tab mirrors Sol hunting patterns — use chain-specific links (Dexscreener BSC) and never mix up addresses across chains.",
        ],
      },
    ],
    keyTerms: [
      { term: "BEP-20", definition: "Token standard on BSC (similar role to ERC-20 on Ethereum)." },
      { term: "Honeypot", definition: "Contract you can buy but cannot sell (or sell only at extreme tax)." },
      { term: "LP lock", definition: "Liquidity locked for a period so devs cannot instantly remove it." },
    ],
  },
  {
    id: "crypto-futures",
    title: "Crypto futures & perps",
    subtitle: "Perpetuals, leverage, margin, liquidation — trade size with respect.",
    estimatedMinutes: 12,
    sections: [
      {
        heading: "Spot vs futures",
        body: [
          "Spot: you own the asset. Futures/perps: you trade a contract that tracks price, often with leverage, without owning the coin.",
          "Perpetual swaps ('perps') have no expiry. Funding rates periodically pay longs or shorts to keep price near spot.",
        ],
      },
      {
        heading: "Leverage & margin",
        body: [
          "Leverage multiplies exposure. 10x means ~10% adverse move can wipe the position (before fees) depending on margin mode.",
          "Initial margin is collateral to open. Maintenance margin is the minimum to keep the position. Fall below it → liquidation.",
          "Isolated margin limits loss to that position's collateral. Cross margin shares balance across positions — higher capital efficiency, higher contagion risk.",
        ],
      },
      {
        heading: "Liquidation & risk",
        body: [
          "Liquidation is the exchange forcibly closing you when margin is insufficient. In chaos, fills can be worse than the theoretical price.",
          "Nova Scalp and Crypto Futures tools on NovaStaris assume you already understand that leverage is a risk multiplier, not a shortcut to skill.",
          "Always know: entry, stop (invalidation), target, max $ loss on margin, and estimated hold time before you click buy/sell.",
        ],
      },
      {
        heading: "Order types (essentials)",
        body: [
          "Market: immediate fill, more slippage. Limit: your price or better. Stop / stop-limit: triggers when price hits a level — used for protection or breakout entries.",
          "Reduce-only and post-only flags help avoid accidental flips or taker fees when you only want to exit or make liquidity.",
        ],
      },
    ],
    keyTerms: [
      { term: "Perp", definition: "Perpetual futures contract with no expiration date." },
      { term: "Funding", definition: "Periodic payment between longs and shorts to anchor perp price to spot." },
      { term: "Liquidation", definition: "Forced close when margin falls below maintenance requirements." },
      { term: "Notional", definition: "Total position value (margin × leverage, roughly)." },
    ],
  },
  {
    id: "predictions",
    title: "Prediction markets",
    subtitle: "Trading probabilities on real-world events.",
    estimatedMinutes: 8,
    sections: [
      {
        heading: "What they are",
        body: [
          "Prediction markets let you buy/sell shares that pay out based on whether an event happens (election, Fed decision, sports, crypto milestones).",
          "Platforms like Polymarket quote prices that resemble probabilities (e.g. 0.42 ≈ 42% implied chance), before fees and resolution rules.",
        ],
      },
      {
        heading: "How traders think",
        body: [
          "Edge = your probability estimate vs the market price, after fees and resolution risk.",
          "Liquidity, time to resolution, and news shocks matter. A 'cheap' side can stay cheap if information is already priced in.",
          "Nova Polymarket tools on NovaStaris help follow flow and elites — still do your own event research.",
        ],
      },
      {
        heading: "Risks unique to predictions",
        body: [
          "Ambiguous resolution criteria, delayed or disputed outcomes, and thin books near expiry.",
          "Correlation: many markets move together on the same macro headline.",
        ],
      },
    ],
    keyTerms: [
      { term: "Implied probability", definition: "Market price interpreted as chance the event resolves Yes." },
      { term: "Resolution", definition: "Official determination of the outcome that settles the market." },
      { term: "Binary market", definition: "Yes/No payoff structure (most common form)." },
    ],
  },
  {
    id: "forex",
    title: "Forex trading",
    subtitle: "FX pairs, pips, leverage, sessions — the global currency market.",
    estimatedMinutes: 12,
    sections: [
      {
        heading: "What forex is",
        body: [
          "Foreign exchange (forex/FX) is trading one currency against another (e.g. EUR/USD). It is the world's largest financial market, open 24h on weekdays across sessions.",
          "Major pairs (EURUSD, GBPUSD, USDJPY, etc.) usually have tight spreads. Exotics can be wider and jumpier.",
        ],
      },
      {
        heading: "Pips, lots, and quotes",
        body: [
          "A pip is the standard smallest price move for most pairs (0.0001 for EURUSD; 0.01 for many JPY pairs). Pipettes are fractional pips.",
          "Lot size scales risk: a standard lot is typically 100,000 units of base currency; mini/micro lots are smaller. Always convert risk to $ before entering.",
          "Bid is where you can sell; ask is where you can buy. Spread = ask − bid (your immediate cost to round-trip at market).",
        ],
      },
      {
        heading: "Leverage & margin in FX",
        body: [
          "Brokers and CFD/fx platforms offer leverage. Same rule as crypto perps: higher leverage shrinks the distance to liquidation/margin call.",
          "Position sizing by % risk per trade beats 'max leverage' ego trading. Nova Forex Agent assumes disciplined invalidation, not gambling.",
        ],
      },
      {
        heading: "Sessions & catalysts",
        body: [
          "London and New York overlap often brings the best liquidity. Asia can be quieter or range-bound depending on the pair.",
          "Central bank decisions, CPI/NFP, and geopolitics create spikes — widen stops or stand aside if you do not have an event plan.",
        ],
      },
    ],
    keyTerms: [
      { term: "Pip", definition: "Standard unit of FX price movement for a pair." },
      { term: "Spread", definition: "Difference between bid and ask prices." },
      { term: "Base / quote", definition: "In EUR/USD, EUR is base, USD is quote — price = USD per 1 EUR." },
      { term: "Session", definition: "Regional trading hours (Tokyo, London, New York) that affect volume." },
    ],
  },
];

export function getLessonById(id: string): UniversityLesson | undefined {
  return TRADING_UNIVERSITY_LESSONS.find((l) => l.id === id);
}

export function allLessonIds(): string[] {
  return TRADING_UNIVERSITY_LESSONS.map((l) => l.id);
}
