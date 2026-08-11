/** Static curriculum for NovaStaris Trading University (no external API calls). */

export type CourseTrack = "foundations" | "markets" | "applied";

export const COURSE_TRACK_META: Record<
  CourseTrack,
  { label: string; level: string; blurb: string }
> = {
  foundations: {
    label: "Foundations",
    level: "Beginner",
    blurb: "Crypto basics, security, risk, charts, orders, psychology, and structure.",
  },
  markets: {
    label: "Markets",
    level: "Intermediate",
    blurb: "Memes, Solana/BSC, futures, prediction markets, forex, and metals (XAU/XAG).",
  },
  applied: {
    label: "Applied",
    level: "Advanced",
    blurb: "NovaStaris workflow plus funding, tokenomics, and prop-firm basics.",
  },
};

export type UniversityWorkedExample = {
  title: string;
  /** Short setup lines (facts of the hypothetical). */
  setup: string[];
  /** Numbered walkthrough steps. */
  steps: string[];
  takeaway: string;
};

export type UniversityLesson = {
  id: string;
  title: string;
  subtitle: string;
  estimatedMinutes: number;
  sections: { heading: string; body: string[] }[];
  keyTerms: { term: string; definition: string }[];
  /** Hypothetical walkthroughs — labeled “Example · not a signal” in the UI. */
  workedExamples?: UniversityWorkedExample[];
  /** Suggested NovaStaris product links after the module. */
  relatedTools?: { label: string; href: string }[];
  /** Optional concept diagram key rendered in the lesson UI. */
  diagram?:
    | "fees"
    | "margin"
    | "candles"
    | "sessions"
    | "workflow"
    | "structure"
    | "journal"
    | "cex-dex"
    | "wallet"
    | "risk"
    | "narrative"
    | "solana"
    | "lifecycle"
    | "bsc-check"
    | "probability"
    | "funding"
    | "orders"
    | "fib"
    | "styles"
    | "regimes"
    | "volume"
    | "eth-l2"
    | "options"
    | "backtest"
    | "metals"
    | null;
  /** Syllabus track — if omitted, inferred from id. */
  track?: CourseTrack;
};

export const TRADING_UNIVERSITY_PASS_PCT = 75;
/** Absolute pass threshold for the final exam (45 of 60). */
export const TRADING_UNIVERSITY_PASS_CORRECT = 45;
export const TRADING_UNIVERSITY_QUIZ_SIZE = 60;
/** Chapter check: need at least this many correct (of 3) to unlock Mark complete. */
export const TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT = 2;
/** Final exam time limit (minutes). Enforced server-side. */
export const TRADING_UNIVERSITY_EXAM_MINUTES = 70;
/** Tab/window leaves before the exam auto-submits (client deterrent). */
export const TRADING_UNIVERSITY_MAX_TAB_LEAVES = 3;

export const TRADING_UNIVERSITY_LESSONS: UniversityLesson[] = [
  {
    id: "intro-crypto",
    title: "Introduction to Cryptocurrency",
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
          "Depeg caution: during stress, a stablecoin can trade below $1 on secondary markets even if the issuer later restores the peg — treat large stable balances as having credit and liquidity risk, not “cash under the mattress.”",
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
    diagram: "cex-dex",
  },
  {
    id: "wallets-security",
    title: "Wallets & Security",
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
          "Phishing pattern: fake “support” DM → cloned wallet/CEX site → asks for seed or “verification” of your private key. Real apps and NovaStaris never need your seed.",
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
    workedExamples: [
      {
        title: "Fake support asks for your seed",
        setup: [
          "You bought a meme; Telegram shows a “support admin” DM",
          "They send a link that looks like your wallet’s recovery page",
          "The form asks for your 12/24-word seed to “unlock stuck tokens”",
        ],
        steps: [
          "Stop. No legitimate support, CEX, or NovaStaris flow ever needs your seed phrase.",
          "Close the tab; do not paste words anywhere. Report/block the DM.",
          "If you already typed the seed: treat the wallet as compromised — move remaining funds from a new wallet only if you still control them, then abandon the old one.",
        ],
        takeaway: "Anyone asking for a seed is an attacker. Bookmark real URLs; never recover a wallet from a DM link.",
      },
    ],
    relatedTools: [{ label: "Wallet Tracker", href: "/?tab=wallets" }],
    diagram: "wallet",
  },
  {
    id: "risk-fundamentals",
    title: "Risk Management Fundamentals",
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
        heading: "R-multiples and daily heat",
        body: [
          "R is your planned risk on a trade (e.g. $100 stop = 1R). A +2R win means you made about twice that planned risk — not 'I felt strong.'",
          "Track wins/losses in R over a week. Edge shows as average R after costs — not as one lucky ticker.",
          "Daily heat: sum of open risk across positions. Two 1% ideas at once is ~2% heat if both stops can hit. Correlated longs (e.g. BTC + high-beta alts) often fail together — treat them as related heat.",
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
      { term: "R-multiple", definition: "Outcome measured in units of your planned risk (e.g. +2R = twice the dollars you risked)." },
      { term: "Daily heat", definition: "Combined open risk across positions — watch correlation." },
    ],
    workedExamples: [
      {
        title: "Size from a $ stop (spot)",
        setup: [
          "Trading capital: $10,000",
          "Risk per idea: 1% = $100",
          "Long idea; invalidation is $2 below entry",
        ],
        steps: [
          "Max loss if stopped = $100.",
          "Risk per unit = $2 → max size ≈ $100 ÷ $2 = 50 units.",
          "If price is $50/unit, notional ≈ $2,500 — still only ~$100 at risk if the stop hits (before fees/slippage).",
        ],
        takeaway: "Position size is an output of risk $ and stop distance — not a vibe about how bullish you feel.",
      },
    ],
    diagram: "risk",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "Nova Scalp", href: "/?tab=nova-pulse&pulse=futures" },
    ],
  },
  {
    id: "chart-basics",
    title: "Charts & Candlesticks",
    subtitle: "OHLC candles, timeframes, trend lines, Fib, and classic chart patterns.",
    estimatedMinutes: 18,
    sections: [
      {
        heading: "Why charts matter",
        body: [
          "Price charts are how traders visualize history and plan entries, stops, and targets. NovaForecast, Nova Scalp, Chart Analysis, and Forex tools all assume you can read a basic candle chart.",
          "A timeframe (1m, 5m, 15m, 1h, 4h, 1d, 1w) is the length of each candle. Lower timeframes are noisier and better for precise entries; higher timeframes show the bigger trend and key levels.",
          "Multi-timeframe habit: decide bias on a higher timeframe (e.g. 4h/1d), then time the entry on a lower one (e.g. 5m/15m) without fighting the bigger picture.",
        ],
      },
      {
        heading: "Candlestick anatomy (OHLC)",
        body: [
          "Each candle shows Open, High, Low, and Close for that period.",
          "The body is the distance between open and close. Wicks (shadows) show the extreme high and low beyond the body.",
          "Bullish candle: close above open (often green). Bearish candle: close below open (often red). Color is convention — always read OHLC, not color alone.",
          "Long upper wick = sellers rejected higher prices. Long lower wick = buyers rejected lower prices. Context (trend vs range) decides whether that matters.",
        ],
      },
      {
        heading: "Bullish candle types (basics)",
        body: [
          "Bullish engulfing: a green body that fully covers the prior red body — stronger near support or after a selloff, weaker mid-chop.",
          "Hammer: small body near the high with a long lower wick — buyers defended after selling pressure (look for confirmation on the next candle).",
          "Inverted hammer: small body near the low with a long upper wick after a decline — possible bullish rejection; wait for follow-through.",
          "Morning star (3-candle idea): down move, small indecision candle, then strong up close — potential bottoming sequence.",
          "Marubozu (bullish): long body with little/no wicks — strong directional close; still needs structure context.",
        ],
      },
      {
        heading: "Bearish candle types (basics)",
        body: [
          "Bearish engulfing: a red body that fully covers the prior green body — stronger near resistance or after a rally.",
          "Shooting star: small body near the low with a long upper wick after a rise — sellers rejected the highs.",
          "Hanging man: looks like a hammer but appears after an advance — warning of weakness if confirmed.",
          "Evening star (3-candle idea): up move, small indecision, then strong down close — potential topping sequence.",
          "Marubozu (bearish): long red body, little/no wicks — strong selling close; still not a standalone signal.",
        ],
      },
      {
        heading: "Doji family (indecision)",
        body: [
          "Standard doji: open ≈ close — indecision; meaning depends on where it prints (trend exhaustion vs mid-range noise).",
          "Long-legged doji: long wicks both sides — wide indecision / volatility without a clear winner that period.",
          "Dragonfly doji: long lower wick, open/close near the high — often bullish-leaning rejection of lows.",
          "Gravestone doji: long upper wick, open/close near the low — often bearish-leaning rejection of highs.",
          "Never trade a doji alone. Combine with level, structure, and the next candle’s confirmation.",
        ],
      },
      {
        heading: "Trend lines & channels",
        body: [
          "An uptrend line connects rising swing lows; a downtrend line connects falling swing highs. Prefer clear swings over forcing a line through noise.",
          "A channel adds a parallel line on the other side of price — useful for targets and mean-reversion inside the channel.",
          "Break of a well-respected trend line can signal acceleration or a regime change — still plan invalidation; false breaks are common.",
        ],
      },
      {
        heading: "Fibonacci retracements (lite)",
        body: [
          "After a strong swing (impulse), Fib retracement tools mark common pullback zones traders watch — especially 38.2%, 50%, and 61.8%.",
          "Fib levels are confluence tools, not magic: they matter more when they overlap with prior structure, a trend line, or a round number.",
          "Extensions (e.g. 127.2% / 161.8%) are sometimes used for take-profit targets after the pullback resumes the trend.",
          "NovaForecast / Fib-related tools on NovaStaris assume you already understand that Fib is a map of attention, not a guarantee.",
        ],
      },
      {
        heading: "Classic chart patterns (lite)",
        body: [
          "Double top / double bottom: two failed tests of a high or low — potential reversal if the neckline breaks with follow-through.",
          "Head and shoulders / inverse: three swings with a middle extreme — neckline break is the usual trigger; measured move is a rough target only.",
          "Triangles (ascending/descending/symmetrical): compression of highs/lows — breakout direction + retest often matter more than the triangle label.",
          "Flags / pennants: brief consolidation after an impulse — often continuation if the prior trend resumes; failure = trap.",
          "Always define invalidation before entry. Patterns fail — your stop is the plan when they do.",
        ],
      },
      {
        heading: "Indicators as confluence (lite)",
        body: [
          "Moving averages (e.g. 20/50/200): dynamic trend filters — price above a rising MA leans bullish bias, below a falling MA leans bearish. They lag; treat them as context, not entry buttons.",
          "RSI / momentum oscillators: extreme readings can flag stretched conditions, but 'oversold' in a downtrend can stay oversold. Prefer divergence + structure over oscillator alone.",
          "Volume (where available): rising volume on breakouts and drying volume on chop are useful clues — still secondary to structure and invalidation.",
          "Rule: indicators confirm a plan built from structure and risk. They do not replace a stop.",
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
      { term: "Doji", definition: "Candle with open ≈ close — indecision; subtypes include dragonfly and gravestone." },
      { term: "Trend line", definition: "Line along swing lows (uptrend) or swing highs (downtrend)." },
      { term: "Fibonacci retracement", definition: "Pullback levels (e.g. 38.2%, 50%, 61.8%) drawn on an impulse swing." },
      { term: "Support / resistance", definition: "Zones where price previously bounced or stalled." },
      { term: "Confluence", definition: "Multiple independent reasons for the same idea (structure + level + indicator)." },
    ],
    workedExamples: [
      {
        title: "Multi-timeframe read (hypothetical)",
        setup: [
          "4h chart: higher highs / higher lows → bullish bias",
          "15m chart: pullback into a prior swing low + 50% Fib of the last impulse",
          "Invalidation: clean break and close below that swing low",
        ],
        steps: [
          "Bias comes from 4h — you are not hunting shorts against that structure for this idea.",
          "Entry timing comes from 15m: wait for the pullback zone instead of chasing the 4h breakout candle.",
          "Stop goes beyond the 15m invalidation; first target can be the prior 15m swing high or a measured move — not a random round number alone.",
        ],
        takeaway: "Higher timeframe = story; lower timeframe = timing. Fighting the story is how ‘perfect’ entries still lose.",
      },
    ],
    diagram: "candles",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "Nova Forex Agent", href: "/?tab=nova-forex" },
      { label: "Chart Analysis", href: "/?tab=ai-analysis&agent=chart" },
    ],
  },
  {
    id: "orders-execution",
    title: "Orders & Trade Execution",
    subtitle: "Market vs limit vs stop, stop-loss, take-profit, and managing open orders.",
    estimatedMinutes: 12,
    track: "foundations",
    sections: [
      {
        heading: "The trade plan before the click",
        body: [
          "Before you enter: direction (long/short), entry type, stop-loss (invalidation), take-profit target(s), and max $ risk if stopped.",
          "If you cannot write those in one line, you are gambling — not executing a trade.",
        ],
      },
      {
        heading: "Market, limit, and stop orders",
        body: [
          "Market order: fill now at the best available price. Fast, but you accept slippage (worse fill in thin or fast markets).",
          "Limit order: fill only at your price or better. You control price; you may not get filled if price never trades there.",
          "Stop order (stop-market): becomes a market order when a trigger price is hit — used for breakout entries or protective exits.",
          "Stop-limit: when the stop triggers, places a limit instead of a market — more price control, risk of no fill in a gap/spike.",
        ],
      },
      {
        heading: "Stop-loss and take-profit",
        body: [
          "Stop-loss (SL): the price that proves your idea wrong — exit without debate. Place it beyond invalidation, not at the obvious round number everyone else uses if that is the liquidity magnet.",
          "Take-profit (TP): pre-planned exit for the win side. Partial TPs (scale out) lock some profit while leaving a runner if structure allows.",
          "Risk:reward is not a religion, but if your TP is closer than your SL with no edge, expectancy usually suffers.",
          "Trailing stop: follows price in your favor. Useful in trends; can chop you out in ranges.",
        ],
      },
      {
        heading: "Open orders & working the book",
        body: [
          "Open / working orders: unfilled limits and stops still sitting on the exchange. Cancel or amend them when the thesis changes.",
          "OCO (one-cancels-the-other) on some platforms: TP and SL linked so one fill cancels the other.",
          "Reduce-only (futures): ensures the order can only shrink or close a position — helps avoid accidental flips.",
          "Post-only / maker: tries to rest as liquidity (often lower fees); may cancel if it would take immediately.",
        ],
      },
      {
        heading: "Entering vs managing",
        body: [
          "Entry: how you get in (market, limit pullback, stop breakout). Management: how you adjust SL/TP or size after fill.",
          "Common process: enter → confirm fill → set SL/TP immediately → journal the thesis. Never leave a naked position 'for a second.'",
          "Moving a stop farther from entry to 'give it room' after you are wrong is usually revenge — not management.",
          "Nova Scalp and Futures tools assume you already know these order basics before sizing leveraged risk.",
        ],
      },
    ],
    keyTerms: [
      { term: "Market order", definition: "Fill immediately at available price — speed over price control." },
      { term: "Limit order", definition: "Fill only at your price or better — may not fill." },
      { term: "Stop-loss", definition: "Protective exit at invalidation — defines max planned loss." },
      { term: "Take-profit", definition: "Pre-set exit to lock gains at a target." },
      { term: "Open / working order", definition: "Unfilled order still live on the exchange." },
      { term: "Slippage", definition: "Difference between expected and actual fill price." },
    ],
    workedExamples: [
      {
        title: "Limit pullback vs market chase",
        setup: [
          "You want long after a breakout; price is extended",
          "Plan: buy a pullback at 1.0820, SL 1.0790, TP 1.0880",
          "Current price is already 1.0855 and accelerating",
        ],
        steps: [
          "Market buy now = chase: worse entry, tighter remaining R:R to the same TP, and you still need the same SL distance or you accept more $ risk.",
          "Place limit at 1.0820 (or stand aside). If it never fills, you missed the trade — that is allowed.",
          "On fill: set SL/TP immediately. If thesis dies (e.g. structure breaks), cancel any leftover working orders.",
        ],
        takeaway: "A missed limit is cheaper than a filled FOMO market order with no plan.",
      },
    ],
    diagram: "orders",
    relatedTools: [
      { label: "Crypto Futures", href: "/?tab=futures" },
      { label: "Nova Scalp", href: "/?tab=nova-pulse&pulse=futures" },
      { label: "Nova Forex Agent", href: "/?tab=nova-forex" },
    ],
  },
  {
    id: "psychology-journaling",
    title: "Psychology & Trade Journaling",
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
    workedExamples: [
      {
        title: "Daily loss hit — tilt sequence",
        setup: [
          "Daily loss limit: $150 (written before the session)",
          "You just took a full stop: −$140 on a plan-following trade",
          "A “perfect” revenge setup appears 2 minutes later",
        ],
        steps: [
          "Check the ledger: $140 of $150 is used — one more full risk idea can breach the day limit.",
          "Rule: hit/near daily loss → platform closed. No “one more” even if R:R looks great.",
          "Journal: thesis, invalidation, followed plan Y, result −R, lesson = cooldown; reopen tomorrow.",
        ],
        takeaway: "The expensive trade after a stop is usually emotional size, not edge. Daily loss limits exist to protect tomorrow’s account.",
      },
    ],
    diagram: "journal",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "Nova Scalp", href: "/?tab=nova-pulse&pulse=futures" },
    ],
  },
  {
    id: "trading-styles",
    title: "Trading Styles & Time Horizons",
    subtitle: "Scalp, day, swing, and position — match style to timeframe, size, and lifestyle.",
    estimatedMinutes: 10,
    track: "foundations",
    sections: [
      {
        heading: "Style is a risk system, not a personality quiz",
        body: [
          "A trading style is how long you expect to hold, which timeframe you manage on, and how you size. Mixing styles mid-trade (e.g. a 5m scalp that becomes a multi-day 'hope hold') is how accounts die.",
          "Pick one primary style per session. Structure and liquidity (next module) apply to every style — only the clock and stop width change.",
        ],
      },
      {
        heading: "Scalping",
        body: [
          "Hold: seconds to ~30 minutes. Charts: 1m–5m (bias sometimes from 15m). Goal: many small edges; fees and slippage matter a lot.",
          "Needs: fast execution, tight invalidation, strict daily loss limits. Poor fit if you cannot watch the book.",
          "On NovaStaris: Nova Scalp is built for this horizon — levels and hold windows assume short duration, not overnight thesis.",
        ],
      },
      {
        heading: "Day trading",
        body: [
          "Hold: minutes to hours; flat by session end (no intentional overnight). Charts: 5m–15m execute, 1h for bias.",
          "Needs: session plans, event awareness (CPI/NFP/FOMC for FX; major crypto unlocks/news), and a hard stop on daily heat.",
          "Funding and overnight swaps are mostly avoided by design — that is a feature of the style.",
        ],
      },
      {
        heading: "Swing trading",
        body: [
          "Hold: ~1–10+ days. Charts: 1h–4h execute, 1d for bias. Stops are wider in $ terms; size must shrink so 1R still matches your risk $.",
          "Needs: patience, tolerance for noise against you, and awareness of funding (perps), swaps (FX), and weekend gaps where relevant.",
          "Do not manage a swing with a scalp stop — or a scalp with a swing diary excuse.",
        ],
      },
      {
        heading: "Position / investment-style holds",
        body: [
          "Hold: weeks to months+. Charts: daily/weekly. Thesis is fundamental or macro plus weekly structure — not a single candle.",
          "Size is small vs account; invalidation can be thesis break (narrative/failed level), not a 15m wick.",
          "Memes and high-leverage perps are usually a poor fit for true position style.",
        ],
      },
      {
        heading: "Match style → timeframe → size",
        body: [
          "Shorter style → tighter stops → smaller notional for the same $ risk. Longer style → wider stops → smaller size still.",
          "If your life schedule cannot support the style (e.g. full-time job + pure scalping), change the style — not the risk rules.",
        ],
      },
    ],
    keyTerms: [
      { term: "Scalping", definition: "Very short holds; high trade count; fees-sensitive." },
      { term: "Day trading", definition: "Intraday holds; typically flat by end of session." },
      { term: "Swing trading", definition: "Multi-day holds managed on higher timeframes." },
      { term: "Position trading", definition: "Weeks–months holds driven by larger thesis and weekly structure." },
      { term: "Timeframe match", definition: "Stop and management TF fit the intended hold length." },
    ],
    workedExamples: [
      {
        title: "Same $ risk, different style width",
        setup: [
          "Risk budget: $100 (1R)",
          "Scalp idea: stop $0.20 away → size = 500 units",
          "Swing idea: stop $2.00 away → size = 50 units",
        ],
        steps: [
          "Both ideas risk ~$100 if stopped — same R.",
          "The swing must use 1/10th the size because the stop is 10× wider.",
          "Using scalp size on a swing stop ≈ 10R disaster if the wider invalidation hits.",
        ],
        takeaway: "Style changes stop distance — size is the dial that keeps R constant.",
      },
    ],
    diagram: "styles",
    relatedTools: [
      { label: "Nova Scalp", href: "/?tab=nova-pulse&pulse=futures" },
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "NovaScalper", href: "/?tab=trading-bot" },
    ],
  },
  {
    id: "market-structure",
    title: "Liquidity & Market Structure",
    subtitle: "Regimes, BOS/CHOCH, liquidity grabs, and how larger flow hunts stops.",
    estimatedMinutes: 16,
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
        heading: "Bullish vs bearish vs range regimes",
        body: [
          "Bullish regime (structure): HH + HL on your bias timeframe. Prefer longs / dips; shorts are counter-trend and need smaller size or clear liquidity traps.",
          "Bearish regime: LH + LL. Prefer shorts / rips; long catch-a-knife needs defined reclaim and tight invalidation.",
          "Range / chop: clear highs and lows with repeated failures. Best edges are fades near extremes — mid-range is where most retail overtrades.",
          "Regime is not a permanent 'bull market' label — it is the active swing structure until it breaks. Update it when BOS/CHOCH proves you wrong.",
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
        heading: "Liquidity grabs (retail vs larger flow)",
        body: [
          "Stops cluster above obvious highs and below obvious lows. Larger players and algos often need that liquidity to fill size — so price spikes through the magnet (grab), then reverses.",
          "You do not need a conspiracy theory: crowded stops are visible fuel. When you see a wick through a level and a fast reclaim, ask whether liquidity was taken rather than a clean breakout.",
          "Institutional-style reading (practical): combine open interest / funding extremes (perps), obvious stop pools, and reclaim vs hold — not 'smart money' logos on Twitter.",
          "Your stop still belongs at true invalidation — not exactly where the crowd parked if that is the magnet.",
        ],
      },
      {
        heading: "HTF bias → LTF entry",
        body: [
          "Higher timeframe (4h/1d) answers: bullish, bearish, or range? Lower timeframe (5m–1h) answers: where is the pullback or reclaim for my style?",
          "If LTF screams long while HTF is cleanly bearish, you are fading the larger regime — size down or skip.",
          "Link to styles: scalps still respect HTF bias; swings lean on it even more.",
        ],
      },
    ],
    keyTerms: [
      { term: "Market structure", definition: "The pattern of swing highs/lows that defines trend vs range." },
      { term: "Regime", definition: "Active bullish / bearish / ranging behavior until structure proves otherwise." },
      { term: "BOS", definition: "Break of structure — price takes a key swing in the trend direction." },
      { term: "CHOCH", definition: "Change of character — early sign the prior trend may be reversing." },
      { term: "Liquidity grab", definition: "Spike beyond obvious highs/lows that runs stops, often before reversing." },
      { term: "HTF / LTF", definition: "Higher / lower timeframe — bias vs timing." },
    ],
    workedExamples: [
      {
        title: "Wick through highs, then reclaim",
        setup: [
          "Clear prior day high at $1.00 with stops stacked just above",
          "5m candle spikes to $1.012 then closes back at $0.995",
          "Breakout buyers entered on the spike; price reclaims below the level",
        ],
        steps: [
          "Label the spike as a possible liquidity grab (stops run), not automatic confirmation of a new uptrend.",
          "If you were long the breakout without a reclaim plan, the reclaim below $1.00 is often invalidation — exit.",
          "If hunting a fade: wait for reclaim + structure (e.g. lower high), and place invalidation above the wick extreme — never mid-wick.",
        ],
        takeaway: "Wick through + fast reclaim = ask “whose stops?” before treating it as a clean breakout.",
      },
      {
        title: "Bullish HTF, wait for LTF dip",
        setup: [
          "4h: HH/HL still intact (bullish regime)",
          "15m: sharp pullback into prior HL + range mid",
          "Style: day trade — want flat by session end",
        ],
        steps: [
          "Bias: long-only or stand aside — no free shorts against 4h structure for this idea.",
          "Wait for 15m reclaim or rejection wick at the dip zone; mark invalidation under the HL.",
          "Size from the 15m stop width so 1R fits daily risk — do not use a scalp size on a fat stop.",
        ],
        takeaway: "Regime from HTF, timing from LTF, size from stop distance.",
      },
    ],
    diagram: "structure",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=chart" },
      { label: "Nova Scalp", href: "/?tab=nova-pulse&pulse=futures" },
    ],
  },
  {
    id: "volume-vwap",
    title: "Volume, VWAP & Profile Lite",
    subtitle: "Read participation — VWAP as institutional benchmark, volume as confirmation.",
    estimatedMinutes: 11,
    track: "foundations",
    sections: [
      {
        heading: "Why volume / participation matters",
        body: [
          "Price without participation is easier to fake. Rising volume on a break that holds is stronger context than a quiet spike that immediately reclaims.",
          "On crypto, reported 'volume' quality varies by venue (wash trading risk). Prefer liquid majors/perps and treat tiny meme prints with skepticism.",
        ],
      },
      {
        heading: "VWAP (volume-weighted average price)",
        body: [
          "VWAP is the average price traded so far in the session, weighted by volume — a common institutional benchmark for 'fair' intraday price.",
          "Price holding above session VWAP often leans bullish for day traders; below leans bearish. Mean-reversion toward VWAP is common in ranges; trend days can ride far from VWAP.",
          "Anchored VWAP: start the average from a chosen event (swing low, listing, CPI candle) instead of the session open — useful for swings.",
          "VWAP is not a magic entry. Pair it with structure and invalidation.",
        ],
      },
      {
        heading: "Volume profile (lite)",
        body: [
          "Volume profile shows how much volume traded at each price (histogram on the side), not only over time.",
          "High-volume nodes (HVN): prices the market accepted — often balance / magnet zones. Low-volume nodes (LVN): thin acceptance — price can move through quickly.",
          "Point of control (POC): price with the most volume in the profile window — often a fair-value magnet until it migrates.",
          "Use profile to ask where liquidity was accepted, then plan stops beyond true structure — not exactly on the POC if that is crowded.",
        ],
      },
      {
        heading: "How to use this with NovaStaris styles",
        body: [
          "Scalps/day trades: session VWAP + volume on breakouts/reclaims.",
          "Swings: anchored VWAP from impulse start + daily structure; ignore noisy 1m volume.",
          "If chart has no reliable volume (some CFDs/FX feeds), lean harder on structure and session liquidity instead of fake volume bars.",
        ],
      },
    ],
    keyTerms: [
      { term: "VWAP", definition: "Volume-weighted average price — session (or anchored) average paid by the market." },
      { term: "Volume profile", definition: "Volume traded at each price level over a chosen window." },
      { term: "POC", definition: "Point of control — price with the highest volume in the profile." },
      { term: "HVN / LVN", definition: "High- / low-volume nodes — accepted vs thin price areas." },
    ],
    workedExamples: [
      {
        title: "Break above VWAP with volume",
        setup: [
          "Intraday: price reclaim and hold above session VWAP",
          "Volume expands on the reclaim candle vs prior hour",
          "HTF structure still bullish",
        ],
        steps: [
          "Context says buyers paid up through the session average with participation.",
          "Invalidation: lose VWAP and the reclaim swing — not a random tick under an HVN.",
          "If the move was a silent wick with no volume, treat it as weaker — maybe a grab, not acceptance.",
        ],
        takeaway: "VWAP + volume answers 'was it accepted?' Structure answers 'where am I wrong?'",
      },
    ],
    diagram: "volume",
    relatedTools: [
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
      { label: "Chart Analysis", href: "/?tab=ai-analysis&agent=chart" },
    ],
  },
  {
    id: "meme-coins",
    title: "Meme Coins",
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
    diagram: "narrative",
  },
  {
    id: "meme-trading",
    title: "Meme Coin Trading",
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
    workedExamples: [
      {
        title: "Tip budget vs trade size",
        setup: [
          "Planned buy size: $40 notional",
          "You set a Jito tip / priority fee of ~$8 to “win” the launch",
          "Expected edge if right: maybe +30% on the bag before sell fees",
        ],
        steps: [
          "All-in cost on entry ≈ tip + base fee + slippage. $8 tip on $40 is ~20% of size before the trade even works.",
          "If the bag does +30% then you sell with more fees/slippage, tip can erase most of the win — or turn it into a loss.",
          "Rule: keep tip/fee budget a small % of size (or skip the launch). Raise size only if the fee budget still fits risk rules — never tip more because FOMO.",
        ],
        takeaway: "Tips buy inclusion odds, not profit. On tiny size, over-tipping is the whole trade.",
      },
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
    diagram: "solana",
  },
  {
    id: "solana-memes",
    title: "Solana Meme Coins",
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
          "Bonding curve (lite): pre-migrate launchpads usually raise price as more supply is bought along the curve — early fills are cheaper and riskier; near migrate, price is higher and LP often deepens.",
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
    workedExamples: [
      {
        title: "Early curve vs post-migrate risk",
        setup: [
          "Coin A: still on bonding curve, tiny social, you can buy $25",
          "Coin B: just migrated to DEX with deeper LP; entry is ~3× the early curve price",
          "Same narrative hype on CT for both",
        ],
        steps: [
          "Coin A: max upside if culture catches — also max rug / abandon risk; size as lottery tickets only.",
          "Coin B: better exit liquidity and clearer chart, but early holders may distribute into your buy — demand invalidation and don’t FOMO size.",
          "Pick one risk profile per session. Mixing “ape early” size on a migrated coin (or life-changing size on a newborn curve) is how accounts die.",
        ],
        takeaway: "Early = optionality + rug risk. Migrated = liquidity + distribution risk. Match size to stage.",
      },
    ],
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "Go Hunting", href: "/?tab=new" },
    ],
    diagram: "lifecycle",
  },
  {
    id: "bsc-memes",
    title: "BSC Meme Coins",
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
    workedExamples: [
      {
        title: "Honeypot test-sell before sizing",
        setup: [
          "BEP-20 meme looks liquid on the chart; Telegram is loud",
          "You can buy $15 on PancakeSwap without errors",
          "You have not tried a sell yet",
        ],
        steps: [
          "Buy dust size first. Immediately attempt a small sell (or use a reputable honeypot checker) before adding size.",
          "If sell fails, reverts, or shows extreme tax — treat as honeypot / trap; do not average in.",
          "Only if a real sell works at a sane tax: then apply normal risk size, LP/holder checks, and an invalidation.",
        ],
        takeaway: "A buy that works proves nothing. On BSC, a test sell is part of due diligence.",
      },
    ],
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "BSC tab", href: "/?tab=bsc" },
    ],
    diagram: "bsc-check",
  },
  {
    id: "ethereum-l2s",
    title: "Ethereum & Layer 2s",
    subtitle: "ETH rails beyond Solana and BSC — gas, L2s, bridges, and scam surface.",
    estimatedMinutes: 11,
    track: "markets",
    sections: [
      {
        heading: "Why Ethereum still matters for traders",
        body: [
          "Ethereum hosts deep DeFi, major stables, blue-chip NFTs history, and many reputable tokens — even if memes often launch on Solana/BSC for speed and fees.",
          "ETH gas (transaction fees) rises with demand. In mania, a failed or crowded tx can cost real money — size dust checks carefully.",
        ],
      },
      {
        heading: "Layer 2s (L2s)",
        body: [
          "L2s (e.g. Arbitrum, Optimism, Base, and others) settle cheaper/faster while periodically anchoring security to Ethereum.",
          "Same token ticker can exist on multiple networks with different contract addresses — always verify chain + CA.",
          "Bridging moves value between L1 and L2 (or across L2s). Bridges add smart-contract and delay risk; official bridges and reputable aggregators beat random 'support' DMs.",
        ],
      },
      {
        heading: "Trading & risk differences vs Solana/BSC memes",
        body: [
          "ETH/L2 memes and microcaps still rug — honeypots, taxes, and approval scams exist. Unlimited ERC-20 approvals remain a classic drain vector.",
          "Liquidity can sit on Uniswap (and forks) with different fee tiers — check pool depth and which chain you are on before sizing.",
          "For serious ETH majors, structure and macro often matter more than tip wars — but security hygiene still beats chart skill if you sign a malicious permit.",
        ],
      },
      {
        heading: "Practical checklist",
        body: [
          "Confirm network in the wallet before every swap.",
          "Verify contract on Etherscan / L2 explorer — not a Telegram screenshot.",
          "Revoke stale approvals periodically; keep a burn/trading wallet separate from savings.",
        ],
      },
    ],
    keyTerms: [
      { term: "L1 / L2", definition: "Base chain (e.g. Ethereum) vs scaling layer that posts back to it." },
      { term: "Gas", definition: "Fee paid to execute an Ethereum (or EVM) transaction." },
      { term: "Bridge", definition: "Mechanism to move assets across chains — adds contract and delay risk." },
      { term: "ERC-20 approval", definition: "Permission for a contract to move your tokens — can be abused if unlimited." },
    ],
    workedExamples: [
      {
        title: "Same ticker, wrong chain",
        setup: [
          "Twitter pushes a 'new ETH meme' CA",
          "Your wallet is still on Base from yesterday",
          "You paste the CA and swap",
        ],
        steps: [
          "If the CA is Ethereum mainnet-only, a Base swap may buy a worthless clone or fail — either way you risk funds.",
          "Fix: switch network deliberately, open the explorer for that chain, verify the verified contract and liquidity pool.",
          "Then dust-size test; only then apply risk size.",
        ],
        takeaway: "Chain + CA are part of the instrument. Ticker text is not.",
      },
    ],
    diagram: "eth-l2",
    relatedTools: [
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "Wallets & security module", href: "/?tab=trading-university" },
    ],
  },
  {
    id: "crypto-futures",
    title: "Crypto Futures & Perps",
    subtitle: "Perpetuals, leverage, margin, funding, liquidation, and long vs short.",
    estimatedMinutes: 16,
    sections: [
      {
        heading: "Spot vs futures",
        body: [
          "Spot: you own the asset. Futures/perps: you trade a contract that tracks price, often with leverage, without owning the coin.",
          "Perpetual swaps ('perps') have no expiry. Funding rates periodically pay longs or shorts to keep the contract near spot.",
          "Dated futures expire on a set date and may converge to spot into delivery/settlement — most retail crypto trading today is perps.",
        ],
      },
      {
        heading: "Long vs short",
        body: [
          "Long: you profit if price rises; you lose if it falls. Short: you profit if price falls; you lose if it rises.",
          "Perps make shorting as easy as longing — that also means squeezes (forced short covering) and cascades (forced long liquidations) are common in crypto.",
          "Direction is only half the plan. The other half is invalidation, size, and how long you will hold through funding payments.",
        ],
      },
      {
        heading: "Leverage & margin",
        body: [
          "Leverage multiplies exposure. 10x means ~10% adverse move can wipe the position (before fees) depending on margin mode.",
          "Initial margin is collateral to open. Maintenance margin is the minimum to keep the position. Fall below it → liquidation.",
          "Notional ≈ margin × leverage (roughly). Think in notional risk and dollar stop distance, not just 'I only put $50 in.'",
        ],
      },
      {
        heading: "Isolated vs cross margin",
        body: [
          "Isolated margin: only the collateral assigned to that position is at risk of liquidation for that trade. Cleaner for learners.",
          "Cross margin: your shared wallet balance backs multiple positions. Higher capital efficiency, but one bad book can contagion the rest.",
          "Hobbyist rule: learn on isolated. Switch to cross only when you can explain max loss across the whole account.",
        ],
      },
      {
        heading: "Funding rates",
        body: [
          "When funding is positive, longs typically pay shorts; when negative, shorts typically pay longs. Payments settle on a schedule (e.g. every 8 hours — check your venue).",
          "Extreme funding often means a crowded side. That is information about positioning — not a guaranteed reversal signal.",
          "Holding through many funding intervals can erase edge even if price barely moves. Factor funding into multi-hour and multi-day holds.",
        ],
      },
      {
        heading: "Liquidation & mark price",
        body: [
          "Liquidation is the exchange forcibly closing you when margin is insufficient. In chaos, fills can be worse than the theoretical price.",
          "Many venues use mark price (an index/fair price) for liquidation math — not always the last traded print you see on the chart.",
          "Nova Scalp and Crypto Futures tools on NovaStaris assume you already understand that leverage is a risk multiplier, not a shortcut to skill.",
          "Always know: entry, stop (invalidation), target, max $ loss on margin, and estimated hold time before you click buy/sell.",
        ],
      },
      {
        heading: "Dated futures vs perps (basis)",
        body: [
          "Dated (calendar) futures expire on a fixed date and settle to a reference price. Perps do not expire — funding keeps them near spot instead.",
          "Basis ≈ futures price − spot (or the reverse quote depending on venue). Contango: futures above spot (common in calm markets). Backwardation: futures below spot (often stress / short demand).",
          "Traders sometimes express views via basis (cash-and-carry style) — that is a different skill than directional perp scalps. Know which instrument you hold before you size.",
          "On NovaStaris, most crypto futures tools focus on USDT perps (Blofin). If you trade dated contracts elsewhere, manage expiry, roll, and margin separately.",
        ],
      },
      {
        heading: "Open interest & crowded trades",
        body: [
          "Open interest (OI) is outstanding contract size. Rising OI with a trend often means new participation; falling OI into a spike can mean covering/closing.",
          "Crowded longs + high positive funding + thin liquidity is a classic recipe for long liquidations on a sharp dump — and the mirror image for shorts.",
          "Use OI and funding as context next to structure — not as standalone entries.",
        ],
      },
      {
        heading: "Order types (essentials)",
        body: [
          "Market: immediate fill, more slippage. Limit: your price or better. Stop / stop-limit: triggers when price hits a level — used for protection or breakout entries.",
          "Reduce-only and post-only flags help avoid accidental flips or taker fees when you only want to exit or make liquidity.",
          "Set SL/TP right after fill. Waiting 'until it settles' is how naked leveraged positions become liquidations.",
        ],
      },
    ],
    keyTerms: [
      { term: "Perp", definition: "Perpetual futures contract with no expiration date." },
      { term: "Funding", definition: "Periodic payment between longs and shorts to anchor perp price to spot." },
      { term: "Liquidation", definition: "Forced close when margin falls below maintenance requirements." },
      { term: "Notional", definition: "Total position value (margin × leverage, roughly)." },
      { term: "Isolated margin", definition: "Collateral risk limited to that position’s assigned margin." },
      { term: "Cross margin", definition: "Shared balance backs multiple positions — contagion risk." },
      { term: "Mark price", definition: "Fair/index price many venues use for PnL and liquidation math." },
      { term: "Open interest", definition: "Total outstanding futures/perp contracts still open." },
      { term: "Basis", definition: "Gap between futures/dated price and spot — contango or backwardation." },
      { term: "Dated futures", definition: "Futures with a fixed expiry / settlement date (vs perpetual)." },
    ],
    workedExamples: [
      {
        title: "10× long — what actually risks $100",
        setup: [
          "Isolated margin: $100",
          "Leverage: 10× → ~$1,000 notional",
          "Entry $50,000 BTC; rough wipe zone near a ~10% adverse move (before fees)",
        ],
        steps: [
          "You are not ‘only risking $100 of conviction’ in the spot sense — $100 is collateral; the exchange can liquidate the whole notional path when margin fails.",
          "If your planned invalidation is 2% away, size so that a stop there loses ~your intended $ risk — do not wait for liquidation to be the stop.",
          "Prefer isolated + hard SL for learning. Cross + high leverage turns one bad coin into an account event.",
        ],
        takeaway: "Liquidation is a failure mode, not a strategy. Your stop should hit first.",
      },
      {
        title: "Funding eats a flat trade",
        setup: [
          "Long perp, funding +0.05% per 8h interval (illustrative)",
          "You hold ~24h (3 intervals) and price is flat",
          "Notional $2,000",
        ],
        steps: [
          "Rough funding paid ≈ 0.05% × 3 × $2,000 ≈ $3 — small here, but scales with size and extreme rates.",
          "If funding is +0.2% per interval in a mania, the same hold can cost tens of dollars with no price edge.",
          "Before multi-interval holds: check funding, your thesis duration, and whether standing aside is cheaper.",
        ],
        takeaway: "Flat price + expensive funding = a slow bleed. Time in a perp is a cost.",
      },
    ],
    diagram: "margin",
    relatedTools: [
      { label: "Crypto Futures", href: "/?tab=futures" },
      { label: "Nova Scalp", href: "/?tab=nova-pulse&pulse=futures" },
      { label: "Perp Radar", href: "/?tab=perp-radar" },
    ],
  },
  {
    id: "predictions",
    title: "Prediction Markets",
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
    workedExamples: [
      {
        title: "Implied prob vs your estimate",
        setup: [
          "Market: “Event X by date Y” trades Yes at $0.28 (≈28% implied)",
          "After research, your honest estimate is ~45%",
          "Fees + resolution ambiguity still exist",
        ],
        steps: [
          "Edge candidate ≈ your 45% vs market 28% — but only if your research is independent and the resolution rules match what you think “Yes” means.",
          "Size from risk of being wrong (full loss of stake on Yes if it resolves No), not from how loud CT is.",
          "If you cannot explain why the market is “wrong,” there is no trade — cheap is not the same as mispriced.",
        ],
        takeaway: "Price ≈ implied probability. Trade the gap only after fees, rules, and your own estimate — not vibes.",
      },
    ],
    relatedTools: [{ label: "Nova Polymarket", href: "/?tab=polymarket-bot" }],
    diagram: "probability",
  },
  {
    id: "forex",
    title: "Forex Trading",
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
    workedExamples: [
      {
        title: "EUR/USD long — pips to dollars",
        setup: [
          "Pair: EUR/USD at 1.0850",
          "Account risk budget: $20 on this idea",
          "Invalidation: 20 pips below entry (1.0830)",
          "Session: London–New York overlap; no high-impact release in the next hour",
        ],
        steps: [
          "On EUR/USD, ~$1 per pip per 0.10 (mini) lot is a common rule of thumb.",
          "20-pip stop × $1/pip ≈ $20 → size ≈ 0.10 lot fits the $20 budget (before spread).",
          "Spread matters: if bid/ask costs ~0.8 pip round-trip, your effective risk is slightly worse — tighten size or accept a slightly wider $ risk.",
          "If NFP is due in 10 minutes and you have no event plan: stand aside. Session liquidity does not cancel calendar risk.",
        ],
        takeaway: "Pip distance × pip value = $ risk. Choose lot size last — after stop and budget.",
      },
      {
        title: "Why the session diagram matters",
        setup: [
          "Same EUR/USD idea, same stop distance",
          "Scenario A: Tokyo lunch, thin book",
          "Scenario B: London–NY overlap",
        ],
        steps: [
          "In thin hours, spreads widen and spikes can tag stops that would not print in the overlap.",
          "Overlap usually means tighter spreads and cleaner follow-through for majors — still not a signal by itself.",
          "Match strategy to liquidity: scalp-style entries prefer overlap; patient swing holds care more about the daily thesis than the exact hour.",
        ],
        takeaway: "Trade the pair and the clock. Liquidity is part of the setup.",
      },
    ],
    diagram: "sessions",
    relatedTools: [{ label: "Nova Forex Agent", href: "/?tab=nova-forex" }],
  },
  {
    id: "trading-metals",
    title: "Trading Gold & Silver (XAU / XAG)",
    subtitle: "XAU/USD forex vs XAU/USDT perps, gold pip rules, sessions, and sizing.",
    estimatedMinutes: 12,
    track: "markets",
    sections: [
      {
        heading: "Why metals matter on NovaStaris",
        body: [
          "Gold (XAU) and silver (XAG) are among the most traded traditional market instruments. Nova Forex Agent and Nova Scalp support metals so you can analyze structure and take plans without leaving the product.",
          "Do not treat gold like EUR/USD. Liquidity, quoting conventions, and risk units differ — and the product you trade (FX CFD vs crypto perp) changes what 'a move' costs.",
        ],
      },
      {
        heading: "Two common rails: XAU/USD vs XAU/USDT",
        body: [
          "XAU/USD (forex / CFD style): gold priced in US dollars on an FX or CFD venue. You trade lots or contract units under broker FX rules — spreads, swaps/rollover if held overnight, and often pip-based education language.",
          "XAU/USDT (crypto perpetual): a USDT-settled perpetual futures contract that tracks gold. Same leverage / margin / funding / liquidation ideas as other crypto perps (see Crypto Futures & Perps) — mark vs last, funding every interval, isolated or cross margin.",
          "Same metal, different plumbing. A Nova Scalp plan on Blofin XAUUSDT uses tickSize and USDT PnL. A forex-desk XAUUSD chart may speak in pips and lot sizes. Always size from $ risk on the venue you actually click.",
        ],
      },
      {
        heading: "Pips on gold are not EUR/USD pips",
        body: [
          "On EUR/USD, traders commonly treat 1 pip as 0.0001 in price (the 4th decimal).",
          "On XAU/USD, most desks treat 1 pip as 0.01 (one cent) — so a print from 4050.00 to 4050.01 is often described as 1 pip, and a $1 move is ~100 pips. Brokers can differ; confirm pip and pip-value on your platform.",
          "Crypto XAU/USDT perps usually do not use 'pips' at all. Risk is mark-price distance in $ × contract size × leverage — same mental model as BTCUSDT, not a 4-decimal FX pip calculator.",
          "Practical tip: when a chat says 'gold moved 50 pips,' ask which quote they mean. On 0.01-pip gold, 50 pips ≈ $0.50. If they meant a $50 move, that is a different conversation entirely.",
        ],
      },
      {
        heading: "Sessions, USD, and silver",
        body: [
          "Gold and silver often wake up with London and especially the London–New York overlap — thinner books around Asia midday still whip stops.",
          "USD strength usually pressures gold (inverse correlation is common, not a law). Risk events (CPI, FOMC, geopolitics) can dominate the session.",
          "XAG is typically more volatile than XAU for the same notional style — smaller size until you know silver’s noise relative to your stop.",
        ],
      },
      {
        heading: "Process on NovaStaris",
        body: [
          "Use Nova Forex Agent for metals watch, NovaQ-style S/R and session context, and Nova Scalp when you want a short-horizon plan on Blofin metals rails.",
          "Write invalidation in price ($), convert to $ risk, then choose size. Do not copy a EUR/USD lot calculator onto gold and hope.",
        ],
      },
    ],
    keyTerms: [
      {
        term: "XAU / XAG",
        definition: "Market codes for gold and silver (precious metals).",
      },
      {
        term: "XAU/USD",
        definition: "Gold quoted vs USD on FX/CFD rails — often discussed in lots and pips.",
      },
      {
        term: "XAU/USDT",
        definition: "Gold-linked USDT perpetual — funding, margin, and liquidation like other crypto perps.",
      },
      {
        term: "Gold pip (common)",
        definition: "On many XAU/USD desks, 1 pip ≈ 0.01 in price — not 0.0001 like EUR/USD.",
      },
      {
        term: "Tick size",
        definition: "Smallest price increment on a perp/CFD quote (e.g. Blofin XAUUSDT) — use this for exchange-legal entries/stops.",
      },
    ],
    workedExamples: [
      {
        title: "Same $1 gold move — two translations",
        setup: [
          "Spot / index gold ≈ $4,050",
          "Price rises by $1.00 to ≈ $4,051",
          "Case A: FX desk speaking in XAU/USD pips (0.01 = 1 pip)",
          "Case B: Crypto XAU/USDT perp trader",
        ],
        steps: [
          "FX language: $1.00 ≈ 100 pips if 1 pip = 0.01. Pip value still depends on lot/contract size — convert pips × pip value = $ PnL.",
          "Perp language: ignore 'pips.' Your PnL ≈ price change × contract exposure (after leverage/margin rules). A 50× long loses fast if gold drops through your stop.",
          "Do not paste a EUR/USD 20-pip stop onto gold assuming the same $ risk. On gold, 20 FX-style pips may only be $0.20 of price — noise, not a real scalp stop.",
        ],
        takeaway: "Translate every metal idea into $ risk on your venue. Pip labels are optional; dollar risk is mandatory.",
      },
      {
        title: "Picking the rail before the entry",
        setup: [
          "Thesis: gold soft into NY; you want a short-horizon fade",
          "Available: Nova Forex metals tools + Blofin XAUUSDT scalp",
        ],
        steps: [
          "Decide rail first: FX/CFD XAUUSD (swap, lots, broker pip) vs XAUUSDT perp (funding, liq).",
          "Pull S/R and session context on that rail’s chart — don’t mix a forex print with a perp tick book.",
          "Size from stop distance in $ on that rail, then place the order where you actually trade.",
        ],
        takeaway: "Same thesis, different contract → different stop width and costs. Match tool → market → size.",
      },
    ],
    diagram: "metals",
    relatedTools: [
      { label: "Nova Forex Agent", href: "/?tab=nova-forex" },
      { label: "Nova Scalp", href: "/?tab=nova-pulse&pulse=futures" },
      { label: "Crypto Futures", href: "/?tab=futures" },
    ],
  },
  {
    id: "options-volatility",
    title: "Options & Volatility Lite",
    subtitle: "Calls, puts, premium, and why leverage of options differs from perps.",
    estimatedMinutes: 12,
    track: "markets",
    sections: [
      {
        heading: "What an option is",
        body: [
          "A call gives the right (not obligation) to buy at a strike by expiry. A put gives the right to sell at a strike by expiry.",
          "You pay a premium for that right. Buyers' max loss is typically the premium paid (plus fees); sellers can face much larger risk depending on the structure.",
          "Crypto options exist on several venues and as exotic on-chain products — always read settlement asset (coin-margined vs USDT) and expiry rules.",
        ],
      },
      {
        heading: "Volatility is the fuel",
        body: [
          "Implied volatility (IV) is the market's priced-in uncertainty. Higher IV → richer premiums (options cost more).",
          "IV crush: after big events, IV often falls and long premium can lose even if direction was vaguely right.",
          "Realized volatility is what actually printed. Trading options without a vol view is gambling on more than direction.",
        ],
      },
      {
        heading: "How this differs from futures/perps",
        body: [
          "Perps: mark-to-market, funding, liquidation from margin. Options: premium decay (theta), strike distance (delta), and expiry.",
          "Long options can expire worthless. Long perps stay open until you close or get liquidated — different clocks, different risk shapes.",
          "Start with understanding payoff diagrams before multi-leg spreads. Structured products inherit all the same risks plus complexity.",
        ],
      },
      {
        heading: "Risk rules for beginners",
        body: [
          "Prefer defined-risk long premium while learning — size so a total loss of premium is an acceptable 1R.",
          "Do not sell naked calls/puts on volatile crypto without professional risk controls.",
          "NovaStaris primary tools emphasize spot, perps, and prediction markets — treat options as advanced curriculum, not a default tab workflow.",
        ],
      },
    ],
    keyTerms: [
      { term: "Call / put", definition: "Option to buy / sell the underlying at a strike by expiry." },
      { term: "Premium", definition: "Price paid for the option — buyer’s typical max loss on a simple long." },
      { term: "Implied volatility", definition: "Vol priced into the option — drives premium richness." },
      { term: "Theta", definition: "Time decay — options lose value as expiry approaches if other factors are static." },
      { term: "Expiry", definition: "Date/time the option stops existing — after which long premium can go to zero." },
    ],
    workedExamples: [
      {
        title: "Right direction, still lose premium",
        setup: [
          "BTC call bought ahead of an event: premium $200",
          "BTC rises slightly after the event",
          "IV collapses and the call is still out-of-the-money near expiry",
        ],
        steps: [
          "Direction was mildly correct, but optionality + IV crush + time decay reduced value.",
          "A perp long with a stop might have scratched or small-won; the call can still finish near zero.",
          "Lesson: options need a vol + path plan, not only 'I think up.'",
        ],
        takeaway: "Options price movement and uncertainty. Direction alone is not enough.",
      },
    ],
    diagram: "options",
    relatedTools: [
      { label: "Crypto Futures (perps context)", href: "/?tab=futures" },
      { label: "Trading styles module", href: "/?tab=trading-university" },
    ],
  },
  {
    id: "novastaris-workflow",
    title: "NovaStaris End-to-End Workflow",
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
    workedExamples: [
      {
        title: "Meme path without FOMO size",
        setup: [
          "Go Hunting flags a migrated Sol meme with rising volume",
          "AI Agent score looks decent; Wallet Tracker shows a quality wallet bought",
          "You still cannot state invalidation in one sentence",
        ],
        steps: [
          "Path: Hunting → AI Agent (CA/risk) → wallets/CT authenticity → only then size.",
          "Because invalidation is missing, skip or paper the idea — a green score is not a stop level.",
          "If you later define invalidation (e.g. reclaim fail below a swing), size from risk $ — not from the score number.",
        ],
        takeaway: "Workflow order matters. Discovery tools find candidates; risk rules decide whether you trade.",
      },
    ],
    diagram: "workflow",
    relatedTools: [
      { label: "Go Hunting", href: "/?tab=new" },
      { label: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme" },
      { label: "NovaForecast Agent", href: "/?tab=nova-forecast" },
    ],
  },
  {
    id: "backtesting-expectancy",
    title: "Backtesting & Expectancy",
    subtitle: "Prove process with data — expectancy, sample size, and overfitting traps.",
    estimatedMinutes: 11,
    track: "applied",
    sections: [
      {
        heading: "Expectancy in plain English",
        body: [
          "Expectancy ≈ (Win% × Average win) − (Loss% × Average loss), preferably in R-multiples after fees.",
          "A system that wins 40% but pays +2R when right and −1R when wrong can beat a 70% winner that only makes +0.3R and loses −1R.",
          "Journal tags (setup type, followed plan Y/N) are how you estimate these inputs in live trading.",
        ],
      },
      {
        heading: "Backtesting basics",
        body: [
          "Backtest: apply fixed rules on historical data and record trades. Forward test / paper: same rules on live data without (or with tiny) capital.",
          "Write rules so a stranger could execute them: entry, stop, target, time stop, markets allowed.",
          "Include fees, slippage, and funding when the style holds perps overnight — otherwise you invent a fake edge.",
        ],
      },
      {
        heading: "Overfitting & sample size",
        body: [
          "Curve-fitting: rules so specific they only worked on one past path. If the system needs 12 parameters to 'look perfect,' be suspicious.",
          "Small samples lie. Prefer dozens to hundreds of trades across regimes (trend and chop) before believing equity curves.",
          "Out-of-sample / walk-forward: keep a held-out period you do not tune on. If it collapses there, you optimized noise.",
        ],
      },
      {
        heading: "From test to live",
        body: [
          "Go live smaller than the backtest implies. Execution reality (latency, gaps, emotion) eats theoretical R.",
          "If live expectancy diverges badly for a fixed sample, stop and review — do not 'enlarge size to get lucky.'",
          "NovaStaris journaling + chapter discipline beats an untested indicator mashup.",
        ],
      },
    ],
    keyTerms: [
      { term: "Expectancy", definition: "Average $ or R you expect per trade after wins and losses." },
      { term: "Backtest", definition: "Simulated historical performance under fixed rules." },
      { term: "Forward test", definition: "Running rules on unseen live/paper data before full size." },
      { term: "Overfitting", definition: "Rules tuned to past noise that fail next regime." },
      { term: "Sample size", definition: "Number of trades — too few makes stats meaningless." },
    ],
    workedExamples: [
      {
        title: "Pretty equity curve, bad live",
        setup: [
          "Backtest win rate 78% on one bull month of BTC 5m",
          "Rules use 9 indicators with 'optimized' thresholds",
          "Live chop week: −8R",
        ],
        steps: [
          "Suspect overfitting and regime mismatch — bull-only sample.",
          "Simplify to structure + one confirmation; retest across bull and range months.",
          "Size down until a new forward sample shows stable expectancy.",
        ],
        takeaway: "If it only works on the month you optimized, it is not an edge — it is a diary of the past.",
      },
    ],
    diagram: "backtest",
    relatedTools: [
      { label: "Psychology & journaling", href: "/?tab=trading-university" },
      { label: "Risk fundamentals", href: "/?tab=trading-university" },
    ],
  },
  {
    id: "advanced-markets",
    title: "Advanced Market Topics",
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
    workedExamples: [
      {
        title: "Tokenomics red flag before the narrative",
        setup: [
          "Meme ticker is viral; chart is green",
          "Top 5 wallets hold ~70% of float; LP unlock is days away",
          "Mint authority still enabled on the contract notes",
        ],
        steps: [
          "Pause FOMO. Concentration + unlock + mint authority are classic distribution / rug rails.",
          "Either skip, or size as entertainment dust with a hard time stop — do not treat it like a liquid major.",
          "Journal the red flags you checked; “funny ticker” alone never clears due diligence.",
        ],
        takeaway: "Tokenomics checks beat narrative. If supply can be printed or dumped by a few wallets, the story is optional.",
      },
    ],
    diagram: "funding",
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
    "orders-execution",
    "psychology-journaling",
    "trading-styles",
    "market-structure",
    "volume-vwap",
  ]);
  const applied = new Set(["novastaris-workflow", "backtesting-expectancy", "advanced-markets"]);
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
