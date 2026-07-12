/** Static curriculum for NovaStaris Trading University (no external API calls). */

export type CourseTrack = "foundations" | "markets" | "applied";

export const COURSE_TRACK_META: Record<
  CourseTrack,
  { label: string; level: string; blurb: string }
> = {
  foundations: {
    label: "Foundations",
    level: "Beginner",
    blurb: "Crypto basics, security, risk, charts, psychology, and structure.",
  },
  markets: {
    label: "Markets",
    level: "Intermediate",
    blurb: "Memes, Solana/BSC, futures, prediction markets, and forex.",
  },
  applied: {
    label: "Applied",
    level: "Advanced",
    blurb: "NovaStaris workflow plus funding, tokenomics, and prop-firm basics.",
  },
};

export type UniversityLesson = {
  id: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  sections: { heading: string; body: string[] }[];
  keyTerms: { term: string; definition: string }[];
  /** Suggested NovaStaris product links after the module. */
  relatedTools?: { label: string; href: string }[];
  /** Optional concept diagram key rendered in the lesson UI. */
  diagram?: "fees" | "margin" | "candles" | "sessions" | "workflow" | "structure" | "journal" | null;
  /** Syllabus track — if omitted, inferred from id. */
  track?: CourseTrack;
};

export const TRADING_UNIVERSITY_PASS_PCT = 80;
/** Absolute pass threshold for the final exam (32 of 40). */
export const TRADING_UNIVERSITY_PASS_CORRECT = 32;
export const TRADING_UNIVERSITY_QUIZ_SIZE = 40;
/** Final exam time limit (minutes). Enforced server-side. */
export const TRADING_UNIVERSITY_EXAM_MINUTES = 60;
/** Tab/window leaves before the exam auto-submits (client deterrent). */
export const TRADING_UNIVERSITY_MAX_TAB_LEAVES = 3;

export const TRADING_UNIVERSITY_LESSONS: UniversityLesson[] = [
  {
    id: "intro-crypto",
    title: "Introduction to cryptocurrency",
    subtitle: "What crypto is, altcoins, DeFi, spot vs perps, and CEX vs DEX.",
    estimatedMinutes: 12,
    sections: [
      {
        heading: "What is cryptocurrency?",
        body: [
          "Cryptocurrency is digital money secured by cryptography and recorded on a blockchain — a shared ledger that many computers maintain, so no single bank has to approve every transfer.",
          "Bitcoin (BTC) is the first and largest example: scarce digital settlement asset often called 'digital gold.' Ether (ETH) powers Ethereum smart contracts. Solana’s SOL, BNB on BNB Chain, and thousands of other tokens fill different roles.",
          "Common quote and settlement assets you will see everywhere: USDT (Tether) and USDC (USD Coin) — dollar-pegged stablecoins used to price pairs, park value between trades, and move funds across platforms.",
          "You typically hold crypto in a wallet (app or hardware device) controlled by cryptographic keys. Lose the keys/seed phrase and you usually lose access forever.",
        ],
      },
      {
        heading: "Altcoins, stablecoins, and tokens",
        body: [
          "Altcoin generally means any crypto other than Bitcoin (ETH, SOL, meme tokens, etc.).",
          "Stablecoins (USDT, USDC, and others) aim to track a fiat currency like the US dollar — useful for parking value and quoting prices on exchanges. They are not risk-free: issuer, banking, and depeg events have happened historically.",
          "A token is a unit issued on a blockchain (fungible coins, governance tokens, meme tickers). Always verify the correct contract/mint — fakes clone names and logos.",
        ],
      },
      {
        heading: "What is DeFi?",
        body: [
          "DeFi (decentralized finance) means financial services run by smart contracts instead of traditional intermediaries: swapping on a DEX, lending/borrowing pools, liquidity providing, and more.",
          "DeFi is powerful and risky: smart-contract bugs, oracle failures, impermanent loss, and scams are real. Start small and understand what you sign.",
        ],
      },
      {
        heading: "Spot trading vs perpetual futures (perps)",
        body: [
          "Spot: you buy or sell the asset itself. If you buy 1 ETH spot, you own 1 ETH (minus fees). No leverage unless you borrow separately. Example: buying BTC or SOL with USDT on a spot market.",
          "Perps (perpetual futures): you trade a contract that tracks price, often with leverage, without owning the coin. You can go long or short. Funding payments and liquidation risk apply. Example: a BTC-USDT perpetual on Blofin or another futures venue.",
          "Rule of thumb: learn spot mechanics and risk first; treat leverage as an advanced tool, not a shortcut.",
        ],
      },
      {
        heading: "Centralized vs decentralized platforms",
        body: [
          "Centralized exchanges (CEXs) — e.g. Binance, Blofin, Bybit, Coinbase, OKX — custody funds for you, offer fiat on-ramps, order books, and often futures. You trust the company with KYC and custody risk (exchange hacks, freezes, insolvency).",
          "Decentralized exchanges (DEXs) — e.g. Jupiter (Solana), Uniswap (Ethereum), PancakeSwap (BSC), Raydium — let you trade from your own wallet via smart contracts. You keep custody, but you handle gas/fees, slippage, phishing, and irreversible txs.",
          "Wallets you will meet early: Phantom and Solflare (Solana), MetaMask (EVM/BSC/ETH). Charting and discovery: Dexscreener, Birdeye, and NovaStaris hunting tools.",
          "Many traders use both: CEX for fiat and perps, DEX for on-chain meme discovery and self-custody.",
        ],
      },
    ],
    keyTerms: [
      { term: "Blockchain", definition: "Distributed ledger that records transfers and smart-contract state." },
      { term: "Bitcoin (BTC)", definition: "The first major cryptocurrency; often treated as digital settlement / store-of-value." },
      { term: "USDT / USDC", definition: "Dollar-pegged stablecoins widely used for quoting and transferring value." },
      { term: "Altcoin", definition: "Cryptocurrency other than Bitcoin." },
      { term: "Stablecoin", definition: "Token designed to track a fiat currency (often USD)." },
      { term: "DeFi", definition: "Financial apps built on smart contracts (swaps, lending, etc.)." },
      { term: "CEX / DEX", definition: "Centralized exchange vs decentralized (wallet-based) exchange." },
    ],
    relatedTools: [
      { label: "Go Hunting", href: "/?tab=new" },
      { label: "Crypto Futures", href: "/?tab=futures" },
    ],
  },
  {
    id: "wallets-security",
    title: "Wallets & security",
    subtitle: "Hot vs cold wallets, seed phrases, approvals, and common scams.",
    estimatedMinutes: 8,
    sections: [
      {
        heading: "Hot wallets vs cold wallets",
        body: [
          "Hot wallet: software connected to the internet (Phantom, MetaMask, exchange apps). Convenient for trading; higher attack surface.",
          "Cold wallet: hardware or offline storage for long-term holdings. Use a hot wallet for degen size only.",
        ],
      },
      {
        heading: "Seed phrases & keys",
        body: [
          "Your seed phrase (recovery phrase) is the master backup. Never type it into a website, Telegram bot, or 'support agent.' NovaStaris will never ask for it.",
          "Anyone with the seed or private key controls the funds. Screenshots in cloud photos are a common leak path.",
        ],
      },
      {
        heading: "Approvals, phishing, and hygiene",
        body: [
          "On EVM chains, unlimited token approvals can let a malicious contract drain balances — revoke unused approvals periodically.",
          "Fake airdrop sites, Discord DMs, and cloned wallet extensions are standard attack paths. Bookmark real URLs; verify extensions.",
          "Separate wallets: one for experiments, one for savings. Never mix life savings with sniper bots.",
        ],
      },
    ],
    keyTerms: [
      { term: "Seed phrase", definition: "Human-readable backup that recreates wallet keys." },
      { term: "Hot wallet", definition: "Internet-connected wallet used for active trading." },
      { term: "Approval", definition: "Permission for a contract to move your tokens (EVM)." },
    ],
    relatedTools: [{ label: "Wallet Tracker", href: "/?tab=wallets" }],
  },
  {
    id: "risk-fundamentals",
    title: "Risk management fundamentals",
    subtitle: "Position sizing, risk per trade, and the psychology that blows accounts.",
    estimatedMinutes: 8,
    sections: [
      {
        heading: "Risk first, then entry",
        body: [
          "Decide how much you can lose on a trade before you decide how much you want to make. Professionals size from the stop distance; amateurs size from FOMO.",
          "A common guideline is risking a small fixed % of trading capital per idea (e.g. 0.5–2%). Meme and high-leverage trades often deserve the low end — or less.",
        ],
      },
      {
        heading: "Expectancy and process",
        body: [
          "One win does not prove an edge; one loss does not prove you are broken. Track setups, rules followed, and outcomes over many trades.",
          "If you cannot state invalidation in one sentence, you do not have a trade — you have a hope.",
        ],
      },
      {
        heading: "Behavioral traps",
        body: [
          "Revenge trading after a loss, oversizing after a win, and moving stops farther from entry to 'give it room' destroy accounts faster than a bad ticker.",
          "Sleep, sobriety, and pre-written rules beat adrenaline. Walk away after a daily loss limit.",
        ],
      },
    ],
    keyTerms: [
      { term: "Risk per trade", definition: "Max $ (or %) you accept losing if the stop hits." },
      { term: "Invalidation", definition: "Condition that proves the idea wrong — exit." },
      { term: "Revenge trade", definition: "Forcing a trade to 'win back' a loss — usually emotional." },
    ],
    diagram: "margin",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "Nova Scalp", href: "/?tab=nova-forecast&forecast=nova-scalp" },
    ],
  },
  {
    id: "chart-basics",
    title: "Charts & candlesticks",
    subtitle: "How to read OHLC candles, common patterns, and timeframes.",
    estimatedMinutes: 10,
    sections: [
      {
        heading: "Why charts matter",
        body: [
          "Price charts are how traders visualize history and plan entries, stops, and targets. NovaForecast, Nova Scalp, and Forex tools all assume you can read a basic candle chart.",
          "A timeframe (1m, 5m, 1h, 1d) is the length of each candle. Lower timeframes are noisier; higher timeframes show bigger structure.",
        ],
      },
      {
        heading: "Candlestick anatomy (OHLC)",
        body: [
          "Each candle shows Open, High, Low, and Close for that period.",
          "The body is the distance between open and close. Wicks (shadows) show the extreme high and low.",
          "A bullish candle usually closes above its open (often colored green). A bearish candle closes below its open (often red).",
          "Long wicks can mean rejection: buyers or sellers pushed price back before the period ended.",
        ],
      },
      {
        heading: "Common candle types (basics)",
        body: [
          "Doji: open and close nearly equal — indecision.",
          "Hammer / inverted hammer: small body with a long wick — possible rejection (context matters).",
          "Engulfing: a candle whose body fully covers the prior body — potential reversal signal when it appears at extremes, not mid-chop.",
          "Never trade a single candle in isolation. Combine with structure (higher highs/lows), levels, and your invalidation.",
        ],
      },
      {
        heading: "Support, resistance, and structure",
        body: [
          "Support is a zone where buying previously appeared; resistance where selling appeared. Zones beat exact lines.",
          "Uptrend: higher highs and higher lows. Downtrend: lower highs and lower lows. Range: price oscillating between bounds.",
          "Breakouts can continue or fake out — wait for confirmation or plan the invalidation before you enter.",
        ],
      },
    ],
    keyTerms: [
      { term: "OHLC", definition: "Open, High, Low, Close — the four prices in a candle." },
      { term: "Wick / shadow", definition: "The thin line showing period high or low beyond the body." },
      { term: "Timeframe", definition: "Duration each candle represents (e.g. 5 minutes, 1 hour)." },
      { term: "Support / resistance", definition: "Zones where price previously bounced or stalled." },
    ],
    diagram: "candles",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "Nova Forex Agent", href: "/?tab=nova-forex" },
    ],
  },
  {
    id: "psychology-journaling",
    title: "Psychology & trade journaling",
    subtitle: "Revenge trading, daily loss limits, and a simple log that builds edge.",
    estimatedMinutes: 10,
    track: "foundations",
    sections: [
      {
        heading: "Why psychology is a position size",
        body: [
          "Most blow-ups are not mysterious chart failures — they are oversized revenge trades, FOMO entries, and moving stops after the plan broke.",
          "Treat emotional state like leverage: if you are tilted, your effective risk is higher than the number on the screen.",
        ],
      },
      {
        heading: "Revenge trading & FOMO",
        body: [
          "Revenge trading: forcing a new trade to 'win back' a loss. Usually worse timing and larger size.",
          "FOMO: chasing a move after the clear entry is gone. Late entries need smaller size or no trade — not bigger size.",
          "Rule of thumb: after a full stop-out, sit out one candle (or a fixed cooldown) before the next idea.",
        ],
      },
      {
        heading: "Daily loss limit",
        body: [
          "Set a max daily loss in $ or % of trading capital (e.g. 1–3%). Hit it → platform closed for the day. No exceptions for 'one more setup.'",
          "A weekly soft cap helps prevent death-by-a-thousand-small-breaches.",
          "Write the limit before the session. Decisions made mid-drawdown are usually worse.",
        ],
      },
      {
        heading: "A simple trade journal",
        body: [
          "Log only what you will actually review: date, market, direction, thesis in one sentence, invalidation, size/risk $, result, and one lesson.",
          "Tag process: followed plan / broke plan. Edge shows up in process tags more than in P&L screenshots.",
          "Review weekly: which setups paid, which rule-breaks cost you, and whether sizing matched conviction.",
        ],
      },
    ],
    keyTerms: [
      { term: "Revenge trade", definition: "Forcing a trade to recover a loss — usually emotional and oversized." },
      { term: "Daily loss limit", definition: "Hard stop on session risk; hit it and you stop trading for the day." },
      { term: "Trade journal", definition: "Short written log of thesis, risk, outcome, and process adherence." },
      { term: "Cooldown", definition: "Mandatory pause after a stop-out or emotional spike before the next entry." },
    ],
    diagram: "journal",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "Nova Scalp", href: "/?tab=nova-forecast&forecast=nova-scalp" },
    ],
  },
  {
    id: "market-structure",
    title: "Liquidity & market structure",
    subtitle: "Trends, ranges, BOS/CHOCH lite, and why liquidity grabs fake traders out.",
    estimatedMinutes: 12,
    track: "foundations",
    sections: [
      {
        heading: "Structure before signals",
        body: [
          "Candles are noise without structure. First ask: is price making higher highs and higher lows (uptrend), lower highs and lower lows (downtrend), or oscillating in a range?",
          "Trade with the active structure on your execution timeframe, and respect the higher-timeframe bias when they conflict.",
        ],
      },
      {
        heading: "Break of structure (BOS) — lite",
        body: [
          "In an uptrend, a break of structure often means price takes out a prior swing high and continues — trend still intact.",
          "In a downtrend, BOS often means a prior swing low gives way. Use BOS as context, not a standalone 'buy/sell' button.",
        ],
      },
      {
        heading: "Change of character (CHOCH) — lite",
        body: [
          "CHOCH is an early hint the prior trend may be shifting — e.g. in an uptrend, a clear break of a meaningful swing low.",
          "One CHOCH does not equal a new trend. Wait for follow-through (new structure) or plan tight invalidation.",
        ],
      },
      {
        heading: "Liquidity grabs",
        body: [
          "Stops cluster above obvious highs and below obvious lows. Price often spikes through those levels (grab), then reverses — trapping breakout chasers.",
          "When you see a wick through a level and a fast reclaim, ask whether that was liquidity taken rather than a clean breakout.",
          "Your stop still belongs at true invalidation — not 'where everyone else put theirs' if that is the magnet.",
        ],
      },
    ],
    keyTerms: [
      { term: "Market structure", definition: "The pattern of swing highs/lows that defines trend vs range." },
      { term: "BOS", definition: "Break of structure — price takes a key swing in the trend direction." },
      { term: "CHOCH", definition: "Change of character — early sign the prior trend may be reversing." },
      { term: "Liquidity grab", definition: "Spike beyond obvious highs/lows that runs stops, often before reversing." },
    ],
    diagram: "structure",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=chart" },
    ],
  },
  {
    id: "meme-coins",
    title: "Meme coins",
    subtitle: "What they are, why they move, and how culture becomes price action.",
    estimatedMinutes: 10,
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
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "Go Hunting", href: "/?tab=new" },
    ],
  },
  {
    id: "meme-trading",
    title: "Meme coin trading",
    subtitle: "Entries, exits, fees, bribes/tips, sizing, and process.",
    estimatedMinutes: 12,
    sections: [
      {
        heading: "Trading vs holding",
        body: [
          "Trading means a plan: entry zone, invalidation (stop), target(s), and time stop. Holding a bag with no plan is speculation without risk control.",
          "Meme charts are noisy. Favor clear catalysts (migration, listing rumor with confirmation, whale accumulation) over random green candles.",
        ],
      },
      {
        heading: "Transaction fees, tips, and bribes",
        body: [
          "Every on-chain buy/sell pays a network transaction fee (gas on EVM; SOL fees on Solana). During congestion, base fees rise and slow or failed txs become common.",
          "Priority fees / tips: optional extra payment to land your transaction faster when the network is busy. Snipers and bots routinely tip higher to compete for early fills.",
          "On Solana, traders often hear about Jito tips / 'bribes' — extra SOL paid so block engines prioritize your transaction in competitive launches. Paying more does not guarantee profit; it only improves inclusion odds and can wipe small size if overused.",
          "DEX trading also includes price impact and slippage (your fill worse than the quoted mid). Aggregators try to route better, but thin meme pools still hurt large orders.",
          "CEX meme listings add maker/taker fees instead of gas — still subtract from edge. Always count all-in cost: fee + tip + slippage + spread.",
        ],
      },
      {
        heading: "Core process",
        body: [
          "1) Screen: new pairs, volume surge, smart-wallet buys, CT buzz.",
          "2) Vet: liquidity, tax/honeypot checks, top holders, age, social authenticity.",
          "3) Size: small % of portfolio; scale in only if thesis strengthens. Keep fee/tip budget proportional to size.",
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
          "Overpaying tips/bribes on tiny size so fees dominate PnL.",
          "Overtrading every new ticker; edge comes from selectivity.",
        ],
      },
    ],
    keyTerms: [
      { term: "Invalidation", definition: "Price or condition that proves your trade idea wrong — exit." },
      { term: "Slippage", definition: "Difference between expected fill and actual fill in thin markets." },
      { term: "Priority fee / tip", definition: "Extra fee paid to land a transaction faster under congestion." },
      { term: "Bribe (Jito tip)", definition: "Competitive tip (often SOL) to prioritize inclusion in hot launches." },
      { term: "Time stop", definition: "Exit if thesis has not played out within a set window." },
    ],
    diagram: "fees",
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "Go Hunting", href: "/?tab=new" },
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
          "Revoke unused token approvals periodically if you use many dApps (especially when bridging to EVM).",
        ],
      },
    ],
    keyTerms: [
      { term: "L1", definition: "Base blockchain (Solana, Ethereum, BSC) that settles transactions." },
      { term: "Mint", definition: "The unique token contract address on Solana." },
      { term: "Migration", definition: "Move from launchpad curve to open market liquidity." },
    ],
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "Go Hunting", href: "/?tab=new" },
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
          "Follow quality wallets, not every KOL’s shill.",
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
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "Go Hunting", href: "/?tab=new" },
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
          "Gas (paid in BNB) is usually cheap vs Ethereum, but failed txs and approval phishing still cost money and safety.",
        ],
      },
      {
        heading: "Trading notes",
        body: [
          "NovaStaris BSC tab mirrors Sol hunting patterns — use chain-specific links (Dexscreener BSC) and never mix up addresses across chains.",
          "Watch transfer/sell taxes baked into some contracts — they act like a fee on every trade.",
        ],
      },
    ],
    keyTerms: [
      { term: "BEP-20", definition: "Token standard on BSC (similar role to ERC-20 on Ethereum)." },
      { term: "Honeypot", definition: "Contract you can buy but cannot sell (or sell only at extreme tax)." },
      { term: "LP lock", definition: "Liquidity locked for a period so devs cannot instantly remove it." },
      { term: "Token tax", definition: "Contract-enforced % taken on buys/sells/transfers." },
    ],
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "BSC tab", href: "/?tab=bsc" },
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
          "Isolated margin limits loss to that position’s collateral. Cross margin shares balance across positions — higher capital efficiency, higher contagion risk.",
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
    diagram: "margin",
    relatedTools: [
      { label: "Crypto Futures", href: "/?tab=futures" },
      { label: "Nova Scalp", href: "/?tab=nova-forecast&forecast=nova-scalp" },
      { label: "Perp Radar", href: "/?tab=perp-radar" },
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
    relatedTools: [{ label: "Nova Polymarket", href: "/?tab=polymarket-bot" }],
  },
  {
    id: "forex",
    title: "Forex trading",
    subtitle: "FX pairs, pips, leverage, sessions, orders, and swaps.",
    estimatedMinutes: 14,
    sections: [
      {
        heading: "What forex is",
        body: [
          "Foreign exchange (forex/FX) is trading one currency against another (e.g. EUR/USD). It is the world's largest financial market, open 24h on weekdays across sessions.",
          "You speculate on whether the base currency will strengthen or weaken versus the quote currency — going long or short the pair.",
        ],
      },
      {
        heading: "Majors, minors, and exotics",
        body: [
          "Majors: pairs with USD and other liquid currencies (EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD) — usually tightest spreads.",
          "Minors (crosses): liquid pairs without USD (e.g. EURGBP, EURJPY). Exotics: a major plus an emerging-market currency — wider spreads and sharper gaps.",
          "Pick liquidity that matches your size. Thin pairs punish market orders.",
        ],
      },
      {
        heading: "Pips, lots, and quotes",
        body: [
          "A pip is the standard smallest price move for most pairs (0.0001 for EURUSD; 0.01 for many JPY pairs). Pipettes are fractional pips.",
          "Lot size scales risk: a standard lot is typically 100,000 units of base currency; mini (0.1) and micro (0.01) lots are smaller. Always convert risk to $ before entering.",
          "Bid is where you can sell; ask is where you can buy. Spread = ask − bid (your immediate cost to round-trip at market).",
        ],
      },
      {
        heading: "Orders & trade management",
        body: [
          "Market order: fill now at available price. Limit: fill only at your price or better. Stop order: triggers when price hits a level (breakout entry or stop-loss).",
          "A stop-loss defines invalidation in price. A take-profit locks a target. Trailing stops follow price but can whip in chop.",
          "Read the candle/timeframe you manage on — a 5m scalp stop is not the same as a daily swing stop.",
        ],
      },
      {
        heading: "Leverage, margin, and swaps",
        body: [
          "Brokers and CFD/fx platforms offer leverage. Higher leverage shrinks the distance to a margin call / forced close.",
          "Position sizing by % risk per trade beats 'max leverage' ego trading. Nova Forex Agent assumes disciplined invalidation, not gambling.",
          "Swap / rollover: overnight financing credit or debit for holding past the broker’s rollover time. Factor it into multi-day holds.",
        ],
      },
      {
        heading: "Sessions & catalysts",
        body: [
          "Tokyo, London, and New York sessions drive volume. London–New York overlap often has the best liquidity for majors.",
          "Central bank decisions, CPI, NFP, and geopolitics create spikes — widen stops or stand aside if you do not have an event plan.",
          "Use an economic calendar. Trading blind into high-impact news is how accounts die.",
        ],
      },
    ],
    keyTerms: [
      { term: "Pip", definition: "Standard unit of FX price movement for a pair." },
      { term: "Spread", definition: "Difference between bid and ask prices." },
      { term: "Base / quote", definition: "In EUR/USD, EUR is base, USD is quote — price = USD per 1 EUR." },
      { term: "Major / exotic", definition: "Most liquid USD pairs vs thinner emerging-market crosses." },
      { term: "Swap / rollover", definition: "Overnight financing paid or earned for holding a position." },
      { term: "Session", definition: "Regional trading hours (Tokyo, London, New York) that affect volume." },
    ],
    diagram: "sessions",
    relatedTools: [{ label: "Nova Forex Agent", href: "/?tab=nova-forex" }],
  },
  {
    id: "novastaris-workflow",
    title: "NovaStaris end-to-end workflow",
    subtitle: "How to chain Go Hunting, AI Agent, wallets, and forecast tools without FOMO.",
    estimatedMinutes: 11,
    track: "applied",
    sections: [
      {
        heading: "One job per tool",
        body: [
          "NovaStaris is a toolkit, not a signal to size blindly. Each tab answers a different question: discovery, scoring, flow, chart levels, or execution context.",
          "Workflow beats tab-hopping: decide the market (meme / perp / FX), then pick the matching path below.",
        ],
      },
      {
        heading: "Meme path (example)",
        body: [
          "1) Go Hunting / BSC — find candidates by stage (new, final stretch, migrated).",
          "2) NovaStaris AI Agent (meme) — score CA, check risk notes, size vs liquidity.",
          "3) Wallet Tracker / CT context — who is buying, is social real or bot spam?",
          "4) Only then size with your risk rules. If you cannot state invalidation, skip.",
        ],
      },
      {
        heading: "Perps / FX path (example)",
        body: [
          "1) Futures / Trending perps or Nova Forex — bias and session context.",
          "2) NovaForecast / Nova Scalp — levels, plan, hold window.",
          "3) Chart Analysis in AI Agent when you want a second read on structure.",
          "4) Execute only with predefined risk; journal the trade after.",
        ],
      },
      {
        heading: "Rules that keep the stack useful",
        body: [
          "Never let a green score override a broken thesis or missing invalidation.",
          "If tools disagree, reduce size or stand aside — disagreement is information.",
          "Finish with a journal line: which tab added edge, and which was noise.",
        ],
      },
    ],
    keyTerms: [
      { term: "Workflow", definition: "A repeatable order of tools and checks before you risk capital." },
      { term: "Discovery", definition: "Finding candidates (Go Hunting) before deep analysis." },
      { term: "Invalidation", definition: "The condition that proves the idea wrong — exit without debate." },
    ],
    diagram: "workflow",
    relatedTools: [
      { label: "Go Hunting", href: "/?tab=new" },
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
    ],
  },
  {
    id: "advanced-markets",
    title: "Advanced market topics",
    subtitle: "Funding & OI, tokenomics red flags, and prop-firm rule basics.",
    estimatedMinutes: 12,
    track: "applied",
    sections: [
      {
        heading: "Funding rates & open interest (perps)",
        body: [
          "Funding is a periodic payment between longs and shorts that keeps perp price near spot. Positive funding usually means longs pay shorts; negative means shorts pay longs (platform-specific details vary).",
          "Crowded side + extreme funding can mean the move is late — squeezes happen when the majority is forced out.",
          "Open interest (OI) is outstanding perp contracts. Rising OI with a trend can confirm participation; falling OI into a spike can mean short-covering or long liquidation rather than fresh conviction.",
        ],
      },
      {
        heading: "Tokenomics red flags (memes & alts)",
        body: [
          "Check: who holds supply, unlock/vesting cliffs, mint authority, tax, LP lock, and whether liquidity can be pulled.",
          "Red flags: tiny float controlled by a few wallets, hidden mint, honeypot sell tax, fake burned LP, or 'team' wallets that dump on first green candle.",
          "A funny ticker is not due diligence. Contract and holder checks come before narrative FOMO.",
        ],
      },
      {
        heading: "Prop-firm rules (basics)",
        body: [
          "Prop challenges often enforce max daily loss, max total drawdown, min trading days, and banned strategies (e.g. news gambling or copy trading — read your firm’s rules).",
          "Passing a challenge is not the same as keeping a funded account — consistency and rule adherence matter more than one lucky day.",
          "If you use NovaStaris Prop Firm tools, treat the firm’s written rules as the boss — platform edge does not override their risk desk.",
        ],
      },
    ],
    keyTerms: [
      { term: "Funding rate", definition: "Periodic long/short payment that anchors perps near spot." },
      { term: "Open interest (OI)", definition: "Number of outstanding perpetual contracts still open." },
      { term: "Tokenomics", definition: "Supply, unlocks, authority, and distribution design of a token." },
      { term: "Prop firm drawdown", definition: "Max loss limit (daily/total) that fails a challenge or funded account." },
    ],
    diagram: "margin",
    relatedTools: [
      { label: "Crypto Futures", href: "/?tab=futures" },
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "Prop Firm Bot", href: "/?tab=prop-firm-bot" },
    ],
  },
];

export function getLessonTrack(lesson: Pick<UniversityLesson, "id" | "track">): CourseTrack {
  if (lesson.track) return lesson.track;
  const foundations = new Set([
    "intro-crypto",
    "wallets-security",
    "risk-fundamentals",
    "chart-basics",
    "psychology-journaling",
    "market-structure",
  ]);
  const applied = new Set(["novastaris-workflow", "advanced-markets"]);
  if (foundations.has(lesson.id)) return "foundations";
  if (applied.has(lesson.id)) return "applied";
  return "markets";
}

export function getLessonById(id: string): UniversityLesson | undefined {
  return TRADING_UNIVERSITY_LESSONS.find((l) => l.id === id);
}

export function allLessonIds(): string[] {
  return TRADING_UNIVERSITY_LESSONS.map((l) => l.id);
}

export type GlossaryEntry = { term: string; definition: string; lessonId: string; lessonTitle: string };

export function buildGlossary(): GlossaryEntry[] {
  const out: GlossaryEntry[] = [];
  for (const lesson of TRADING_UNIVERSITY_LESSONS) {
    for (const t of lesson.keyTerms) {
      out.push({
        term: t.term,
        definition: t.definition,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
      });
    }
  }
  return out.sort((a, b) => a.term.localeCompare(b.term));
}
