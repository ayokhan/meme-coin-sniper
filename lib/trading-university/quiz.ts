/** Quiz bank — correctIndex is server-only; clients never receive it on GET. */

import { EXAM_SET_B, EXAM_SET_C } from "@/lib/trading-university/quiz-sets-extra";
import {
  EXAM_SET_A_EXTRA,
  EXAM_SET_B_EXTRA,
  EXAM_SET_C_EXTRA,
} from "@/lib/trading-university/quiz-expand-60";

export type UniversityQuizQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
  /** 0-based index into options */
  correctIndex: number;
};

export const TRADING_UNIVERSITY_QUIZ_BANK: UniversityQuizQuestion[] = [
  {
    id: "q1",
    lessonId: "intro-crypto",
    prompt: "What best describes cryptocurrency?",
    options: [
      "Digital money secured by cryptography and recorded on a blockchain",
      "Only physical coins issued by central banks",
      "A type of stock that always pays dividends",
      "A forex pair like EUR/USD",
    ],
    correctIndex: 0,
  },
  {
    id: "q2",
    lessonId: "chart-basics",
    prompt: "What do OHLC stand for on a candlestick chart?",
    options: [
      "Open, High, Low, Close",
      "Order, Hedge, Lot, Contract",
      "Only High Liquidity Candles",
      "Overnight Holding Limit Cost",
    ],
    correctIndex: 0,
  },
  {
    id: "q3",
    lessonId: "chart-basics",
    prompt: "How does a hanging man differ from a hammer?",
    options: [
      "Same shape (small body, long lower wick), but hanging man prints after an advance as a weakness warning",
      "A hanging man always has a long upper wick only",
      "A hammer can only appear on forex pairs",
      "They are identical signals with no location difference",
    ],
    correctIndex: 0,
  },
  {
    id: "q4",
    lessonId: "intro-crypto",
    prompt: "How does spot trading differ from perpetual futures?",
    options: [
      "Spot owns the asset; perps trade leveraged price exposure via a contract",
      "Perps always expire in one hour; spot never settles",
      "Spot requires funding payments every hour",
      "Perps cannot go short",
    ],
    correctIndex: 0,
  },
  {
    id: "q5",
    lessonId: "novastaris-workflow",
    prompt: "What is the best way to use NovaStaris tools together?",
    options: [
      "Follow a workflow (discover → analyze → size with invalidation) instead of random tab-hopping",
      "Open every tab and buy the first green ticker",
      "Ignore risk rules when an AI score is high",
      "Share seed phrases with AI Agent support",
    ],
    correctIndex: 0,
  },
  {
    id: "q6",
    lessonId: "wallets-security",
    prompt: "What should you never share with websites or 'support' agents?",
    options: [
      "Your seed / recovery phrase",
      "Your public wallet address",
      "A transaction explorer link",
      "Your preferred chart timeframe",
    ],
    correctIndex: 0,
  },
  {
    id: "q7",
    lessonId: "wallets-security",
    prompt: "A hot wallet is best described as:",
    options: [
      "An internet-connected wallet convenient for trading but with higher attack surface",
      "An offline vault that can never send transactions",
      "A bank savings account",
      "A prediction market share",
    ],
    correctIndex: 0,
  },
  {
    id: "q8",
    lessonId: "risk-fundamentals",
    prompt: "Professionals usually size a trade based on:",
    options: [
      "How much they can lose if the stop (invalidation) hits",
      "Maximum available leverage only",
      "Whatever tip/bribe bots are paying",
      "The coin’s Twitter follower count alone",
    ],
    correctIndex: 0,
  },
  {
    id: "q9",
    lessonId: "risk-fundamentals",
    prompt: "A revenge trade is:",
    options: [
      "Forcing a trade to win back a loss — usually emotional and destructive",
      "A planned hedge with a written stop",
      "Taking partial profits into strength",
      "Revoking a token approval",
    ],
    correctIndex: 0,
  },
  {
    id: "q10",
    lessonId: "meme-coins",
    prompt: "What primarily drives meme coin valuations compared with traditional equities?",
    options: [
      "Audited quarterly revenue and dividends",
      "Community, culture, attention, and narrative",
      "Guaranteed protocol staking yield",
      "Central bank interest rates only",
    ],
    correctIndex: 1,
  },
  {
    id: "q11",
    lessonId: "meme-coins",
    prompt: "What does a 'rug' typically mean in meme markets?",
    options: [
      "A temporary pause in trading on an exchange",
      "Developers or large holders dump / remove liquidity and abandon the project",
      "A scheduled token unlock for team vesting",
      "Paying funding on a perpetual contract",
    ],
    correctIndex: 1,
  },
  {
    id: "q12",
    lessonId: "meme-trading",
    prompt: "What is 'invalidation' in a trading plan?",
    options: [
      "The highest price you hope to sell at",
      "A price or condition that proves the idea wrong — you exit",
      "The exchange's maintenance margin formula",
      "A social media ban on discussing the coin",
    ],
    correctIndex: 1,
  },
  {
    id: "q13",
    lessonId: "psychology-journaling",
    prompt: "What should you do when you hit a written daily loss limit?",
    options: [
      "Stop trading for the day — no 'one more setup'",
      "Raise size to recover faster",
      "Ignore it after two green trades",
      "Only apply it on weekends",
    ],
    correctIndex: 0,
  },
  {
    id: "q14",
    lessonId: "psychology-journaling",
    prompt: "A useful trade journal entry usually includes:",
    options: [
      "Thesis, invalidation, risk $, result, and whether you followed the plan",
      "Only a screenshot of P&L with no context",
      "Your seed phrase for recovery",
      "The exchange CEO’s Twitter handle",
    ],
    correctIndex: 0,
  },
  {
    id: "q15",
    lessonId: "trading-styles",
    prompt: "If a swing stop is 10× wider than a scalp stop for the same $ risk, size should be:",
    options: [
      "About 1/10th the scalp size so 1R stays the same",
      "10× larger because swings need more conviction",
      "Unchanged — stop width never changes size",
      "Always max leverage regardless of stop",
    ],
    correctIndex: 0,
  },
  {
    id: "q16",
    lessonId: "market-structure",
    prompt: "A liquidity grab often looks like:",
    options: [
      "A spike beyond an obvious high/low that runs stops, then reverses",
      "A guaranteed continuation breakout with no wick",
      "A funding payment on perps",
      "A forex swap credit",
    ],
    correctIndex: 0,
  },
  {
    id: "q17",
    lessonId: "solana",
    prompt: "Why do meme launchpads thrive on Solana?",
    options: [
      "Solana transactions are always free forever",
      "High throughput and low fees enable rapid experimentation",
      "Solana bans all speculative tokens",
      "Only institutions can mint Solana tokens",
    ],
    correctIndex: 1,
  },
  {
    id: "q18",
    lessonId: "solana",
    prompt: "What is a token 'mint' on Solana?",
    options: [
      "The exchange listing fee",
      "The unique token contract address",
      "A type of leverage on perps",
      "The overnight funding payment",
    ],
    correctIndex: 1,
  },
  {
    id: "q19",
    lessonId: "solana-memes",
    prompt: "What is a bonding curve commonly used for in Sol meme launches?",
    options: [
      "Pricing that rises as more tokens are bought before full DEX liquidity",
      "A fixed bank interest rate for SOL staking",
      "Calculating forex pip values",
      "Settling prediction market disputes",
    ],
    correctIndex: 0,
  },
  {
    id: "q20",
    lessonId: "solana-memes",
    prompt: "Early-stage Sol meme entries usually offer:",
    options: [
      "Lowest risk and guaranteed listings",
      "Highest upside and highest rug / failure risk",
      "No need to check holders or liquidity",
      "Risk-free arbitrage vs spot BTC",
    ],
    correctIndex: 1,
  },
  {
    id: "q21",
    lessonId: "backtesting-expectancy",
    prompt: "Overfitting in a backtest usually means:",
    options: [
      "Rules tuned so hard to past noise that they fail on the next regime",
      "Including fees and funding in the simulation",
      "Using R-multiples instead of raw dollars",
      "Forward-testing before going live",
    ],
    correctIndex: 0,
  },
  {
    id: "q22",
    lessonId: "bsc-memes",
    prompt: "What is a honeypot in BSC meme trading?",
    options: [
      "A locked LP that expires in 1 year",
      "A contract you can buy but cannot reasonably sell",
      "A reward for referring friends",
      "A type of prediction market share",
    ],
    correctIndex: 1,
  },
  {
    id: "q23",
    lessonId: "bsc-memes",
    prompt: "BEP-20 refers to:",
    options: [
      "A Solana launchpad program",
      "The token standard commonly used on BSC",
      "A forex session in Asia",
      "Perp funding intervals on Hyperliquid",
    ],
    correctIndex: 1,
  },
  {
    id: "q24",
    lessonId: "bsc-memes",
    prompt: "A token tax on BSC memes typically means:",
    options: [
      "A contract-enforced % taken on buys, sells, or transfers",
      "A government VAT refund to traders",
      "Zero fees forever",
      "Funding paid between longs and shorts",
    ],
    correctIndex: 0,
  },
  {
    id: "q25",
    lessonId: "crypto-futures",
    prompt: "What is a perpetual (perp) futures contract?",
    options: [
      "A futures contract with no expiration date",
      "A spot purchase of the underlying coin",
      "A bond that pays fixed coupons",
      "An options contract that expires weekly only",
    ],
    correctIndex: 0,
  },
  {
    id: "q26",
    lessonId: "crypto-futures",
    prompt: "What does leverage primarily do?",
    options: [
      "Removes liquidation risk entirely",
      "Multiplies exposure — and losses — relative to margin",
      "Guarantees profits if you hold longer",
      "Converts perps into spot ownership",
    ],
    correctIndex: 1,
  },
  {
    id: "q27",
    lessonId: "crypto-futures",
    prompt: "Liquidation happens when:",
    options: [
      "You manually take profit at target",
      "Margin falls below maintenance requirements and the exchange force-closes you",
      "Funding flips from positive to negative once",
      "You switch from cross to isolated margin",
    ],
    correctIndex: 1,
  },
  {
    id: "q28",
    lessonId: "crypto-futures",
    prompt: "Dated futures differ from perps mainly because they:",
    options: [
      "Have a fixed expiry / settlement, while perps use funding instead of expiry",
      "Never require margin",
      "Cannot be long or short",
      "Always settle in meme tokens",
    ],
    correctIndex: 0,
  },
  {
    id: "q29",
    lessonId: "crypto-futures",
    prompt: "Why can positive funding matter even if price is flat?",
    options: [
      "Longs typically pay shorts each interval — holding cost can erase edge over time",
      "Funding deletes open interest every hour",
      "Funding guarantees a profitable long",
      "Funding converts perps into spot ownership",
    ],
    correctIndex: 0,
  },
  {
    id: "q30",
    lessonId: "predictions",
    prompt: "In many prediction markets, a price of 0.42 roughly implies:",
    options: [
      "42x leverage on the event",
      "About a 42% implied chance of Yes (before fees/quirks)",
      "A 42-pip FX move",
      "A 42% funding rate per hour",
    ],
    correctIndex: 1,
  },
  {
    id: "q31",
    lessonId: "predictions",
    prompt: "A trader's edge in prediction markets is mainly:",
    options: [
      "Always buying the Yes side at any price",
      "Their probability estimate vs market price after fees and resolution risk",
      "Using maximum leverage on every event",
      "Ignoring resolution rules",
    ],
    correctIndex: 1,
  },
  {
    id: "q32",
    lessonId: "predictions",
    prompt: "What is 'resolution' in a prediction market?",
    options: [
      "The official outcome determination that settles the market",
      "The moment leverage is increased on a perp",
      "Closing a forex trade during Asia session",
      "Migrating a Solana token to a DEX",
    ],
    correctIndex: 0,
  },
  {
    id: "q33",
    lessonId: "forex",
    prompt: "For most EUR/USD-style pairs, a pip is typically:",
    options: [
      "0.0001 in price",
      "1.00 in price",
      "10% of margin",
      "The overnight swap fee only",
    ],
    correctIndex: 0,
  },
  {
    id: "q34",
    lessonId: "forex",
    prompt: "In EUR/USD, which is the base currency?",
    options: ["USD", "EUR", "JPY", "GBP"],
    correctIndex: 1,
  },
  {
    id: "q35",
    lessonId: "forex",
    prompt: "On EUR/USD, a common rule of thumb is ~$1 per pip per 0.10 lot. A 20-pip stop at 0.10 lot risks about:",
    options: [
      "$20 (before spread)",
      "$2",
      "$200",
      "$0.20",
    ],
    correctIndex: 0,
  },
  {
    id: "q36",
    lessonId: "forex",
    prompt: "Which FX session overlap often has the strongest liquidity for majors?",
    options: [
      "London and New York",
      "Only weekends",
      "Only when crypto markets are closed",
      "Only the first minute after Sunday open",
    ],
    correctIndex: 0,
  },
  {
    id: "q37",
    lessonId: "volume-vwap",
    prompt: "Session VWAP is best described as:",
    options: [
      "The volume-weighted average price traded so far in the session",
      "A guaranteed bounce level every time price tags it",
      "The overnight forex swap rate",
      "Your wallet seed phrase length",
    ],
    correctIndex: 0,
  },
  {
    id: "q38",
    lessonId: "market-structure",
    prompt: "In a bullish regime (HH/HL) on your bias timeframe, the default playbook is:",
    options: [
      "Prefer longs / dips; treat shorts as counter-trend",
      "Only short every wick",
      "Ignore structure and follow RSI alone",
      "Always use max leverage",
    ],
    correctIndex: 0,
  },
  {
    id: "q39",
    lessonId: "orders-execution",
    prompt: "What should you typically set immediately after an entry fill?",
    options: [
      "Stop-loss and take-profit according to your plan",
      "Nothing — manage later if price moves",
      "Only a larger position size",
      "A new seed phrase",
    ],
    correctIndex: 0,
  },
  {
    id: "q40",
    lessonId: "orders-execution",
    prompt: "A market order prioritizes:",
    options: [
      "Immediate fill at available price (slippage possible)",
      "Fill only at your exact limit or better",
      "Guaranteed profit",
      "Zero fees on every exchange",
    ],
    correctIndex: 0,
  },
];

export type PublicQuizQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
};

export type ExamSetId = "A" | "B" | "C";

/** Set A = base bank + expansion (60). Sets B/C rotate for variety. */
export const EXAM_SETS: Record<ExamSetId, UniversityQuizQuestion[]> = {
  A: [...TRADING_UNIVERSITY_QUIZ_BANK, ...EXAM_SET_A_EXTRA],
  B: [...EXAM_SET_B, ...EXAM_SET_B_EXTRA],
  C: [...EXAM_SET_C, ...EXAM_SET_C_EXTRA],
};

export const EXAM_SET_IDS: ExamSetId[] = ["A", "B", "C"];

export function isExamSetId(v: unknown): v is ExamSetId {
  return v === "A" || v === "B" || v === "C";
}

export function pickExamSetId(preferAvoid?: string | null): ExamSetId {
  const avoid = isExamSetId(preferAvoid) ? preferAvoid : null;
  const pool = avoid ? EXAM_SET_IDS.filter((id) => id !== avoid) : EXAM_SET_IDS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function getExamSet(setId: ExamSetId): UniversityQuizQuestion[] {
  return EXAM_SETS[setId];
}

export function getPublicQuizQuestions(setId: ExamSetId = "A"): PublicQuizQuestion[] {
  return getExamSet(setId).map(({ id, lessonId, prompt, options }) => ({
    id,
    lessonId,
    prompt,
    options: [...options],
  }));
}

export function scoreQuizAnswers(
  answers: Record<string, number>,
  setId: ExamSetId = "A"
): {
  correct: number;
  total: number;
  scorePct: number;
  missedIds: string[];
  missedLessonIds: string[];
} {
  const bank = getExamSet(setId);
  const total = bank.length;
  let correct = 0;
  const missedIds: string[] = [];
  const missedLesson = new Set<string>();
  for (const q of bank) {
    const picked = answers[q.id];
    if (picked === q.correctIndex) correct += 1;
    else {
      missedIds.push(q.id);
      missedLesson.add(q.lessonId);
    }
  }
  const scorePct = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  return { correct, total, scorePct, missedIds, missedLessonIds: Array.from(missedLesson) };
}

/** Extra chapter-check questions (not necessarily in final exam sets). */
export const CHAPTER_PRACTICE_BANK: UniversityQuizQuestion[] = [
  {
    id: "cp-chart-1",
    lessonId: "chart-basics",
    prompt: "What do the letters OHLC stand for on a candlestick?",
    options: [
      "Open, High, Low, Close",
      "Order, Hedge, Lot, Contract",
      "Only High Liquidity Candles",
      "Overnight Holding Limit Cost",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-chart-2",
    lessonId: "chart-basics",
    prompt: "A bullish candle typically means:",
    options: [
      "Close finished above open for that period",
      "The exchange halted trading",
      "Funding was negative",
      "The wick length is always zero",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-chart-3",
    lessonId: "chart-basics",
    prompt: "What does a doji usually suggest?",
    options: [
      "Open and close are nearly equal — indecision",
      "Guaranteed continuation of the prior trend",
      "A 10× leverage requirement",
      "That the pair has no spread",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-chart-4",
    lessonId: "chart-basics",
    prompt: "A chart timeframe is:",
    options: [
      "How long each candle represents (e.g. 5 minutes or 1 hour)",
      "The broker’s overnight swap rate",
      "The number of pips in a lot",
      "Your account’s KYC tier",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-chart-5",
    lessonId: "chart-basics",
    prompt: "Fibonacci retracement levels are best used as:",
    options: [
      "Confluence zones (especially with structure) — not guaranteed turns",
      "A guarantee that price must reverse at 61.8%",
      "A replacement for a stop-loss",
      "The overnight funding rate on perps",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-chart-6",
    lessonId: "chart-basics",
    prompt: "A shooting star candle typically appears as:",
    options: [
      "A small body near the low with a long upper wick after a rise — sellers rejected highs",
      "A guaranteed buy signal in every uptrend",
      "A forex swap credit",
      "A Solana mint authority warning",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-ord-1",
    lessonId: "orders-execution",
    prompt: "A limit order means:",
    options: [
      "Fill only at your price or better — you may not get filled",
      "Fill immediately at any available price",
      "You cannot use a stop-loss with it",
      "The exchange guarantees zero slippage",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-ord-2",
    lessonId: "orders-execution",
    prompt: "A stop-loss is primarily used to:",
    options: [
      "Exit at invalidation and define planned max loss",
      "Guarantee maximum profit",
      "Remove the bid–ask spread",
      "Convert a market order into a Fib level",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-ord-3",
    lessonId: "orders-execution",
    prompt: "Open / working orders are:",
    options: [
      "Unfilled limits or stops still live on the exchange",
      "Only filled market orders from last year",
      "Your seed phrase backup",
      "Prop-firm banned strategies",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-fx-1",
    lessonId: "forex",
    prompt: "Major FX pairs typically include:",
    options: [
      "USD with other highly liquid currencies (e.g. EURUSD)",
      "Only meme coins quoted in SOL",
      "Only exotic emerging-market crosses",
      "Only metals and oil CFDs",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-fx-2",
    lessonId: "forex",
    prompt: "A swap / rollover in forex is mainly:",
    options: [
      "Overnight financing paid or earned for holding past rollover",
      "The one-time fee to open a Phantom wallet",
      "A Solana priority tip",
      "The prediction market resolution bond",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-fx-3",
    lessonId: "forex",
    prompt: "A stop-loss order is typically used to:",
    options: [
      "Define invalidation and limit loss if price moves against you",
      "Guarantee maximum profit every trade",
      "Remove the bid–ask spread",
      "Convert a CFD into spot BTC",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-psych-1",
    lessonId: "psychology-journaling",
    prompt: "What is revenge trading?",
    options: [
      "Forcing a trade to win back a loss — usually emotional and oversized",
      "Hedging a perp with spot BTC",
      "Journaling every winning trade only",
      "Waiting one full session before trading again",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-psych-2",
    lessonId: "psychology-journaling",
    prompt: "A daily loss limit is most useful when:",
    options: [
      "You hit it and stop trading for the day — no 'one more setup'",
      "You raise size to recover faster",
      "You only apply it on weekends",
      "You ignore it after two green trades",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-psych-3",
    lessonId: "psychology-journaling",
    prompt: "A useful trade journal entry usually includes:",
    options: [
      "Thesis, invalidation, risk $, result, and whether you followed the plan",
      "Only a screenshot of P&L with no context",
      "Your seed phrase for recovery",
      "The exchange CEO’s Twitter handle",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-struct-1",
    lessonId: "market-structure",
    prompt: "An uptrend structure is typically described as:",
    options: [
      "Higher highs and higher lows",
      "Lower highs and lower lows",
      "Only doji candles",
      "Funding always positive",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-struct-2",
    lessonId: "market-structure",
    prompt: "A liquidity grab often looks like:",
    options: [
      "A spike beyond an obvious high/low that runs stops, then reverses",
      "A guaranteed continuation breakout with no wick",
      "A funding payment on perps",
      "A forex swap credit",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-struct-3",
    lessonId: "market-structure",
    prompt: "CHOCH (change of character) is best treated as:",
    options: [
      "An early hint a trend may be shifting — wait for follow-through or tight invalidation",
      "An automatic all-in reverse signal",
      "A Solana mint authority flag",
      "A prop-firm banned strategy list",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-struct-4",
    lessonId: "market-structure",
    prompt: "HTF bias → LTF entry means:",
    options: [
      "Decide bullish/bearish/range on a higher timeframe, time entries on a lower one",
      "Only trade 1m charts with no higher context",
      "Ignore invalidation when HTF agrees",
      "Replace stops with RSI only",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-styles-1",
    lessonId: "trading-styles",
    prompt: "Scalping is best characterized by:",
    options: [
      "Very short holds where fees and tight invalidation matter a lot",
      "Multi-month fundamental holds only",
      "Never defining a stop",
      "Ignoring timeframes entirely",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-styles-2",
    lessonId: "trading-styles",
    prompt: "Swing trading vs scalping for the same $ risk usually means:",
    options: [
      "Wider stop → smaller position size",
      "Wider stop → larger position size",
      "Same size always",
      "No stop on swings",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-styles-3",
    lessonId: "trading-styles",
    prompt: "Turning a failed scalp into a multi-day hold is:",
    options: [
      "Style drift — usually hope, not a plan",
      "Required by every exchange",
      "Always the best risk practice",
      "How Fib levels are calculated",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-vol-1",
    lessonId: "volume-vwap",
    prompt: "Session VWAP weights prices by:",
    options: [
      "Volume traded at each price — not a simple average of OHLC alone",
      "Only the open and close",
      "Funding rate intervals",
      "The number of Telegram emojis",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-vol-2",
    lessonId: "volume-vwap",
    prompt: "A low-volume node (LVN) often means:",
    options: [
      "Thin acceptance — price can traverse that area quickly",
      "Guaranteed support forever",
      "The prop-firm profit target",
      "A Solana mint authority",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-vol-3",
    lessonId: "volume-vwap",
    prompt: "Anchored VWAP differs from session VWAP because it:",
    options: [
      "Starts from a chosen event or swing instead of the session open",
      "Ignores volume entirely",
      "Only works on forex Sundays",
      "Deletes liquidation risk",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-eth-1",
    lessonId: "ethereum-l2s",
    prompt: "Layer 2 networks typically offer:",
    options: [
      "Cheaper/faster txs while periodically settling security back to Ethereum",
      "A permanent bypass of all smart-contract risk",
      "Identical contract addresses on every chain automatically",
      "Free unlimited minting of any ticker",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-eth-2",
    lessonId: "ethereum-l2s",
    prompt: "Unlimited ERC-20 approvals are risky because:",
    options: [
      "A malicious contract may move tokens later without a new signature",
      "They automatically set a perfect stop-loss",
      "They convert hot wallets into cold storage",
      "They remove gas fees forever",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-eth-3",
    lessonId: "ethereum-l2s",
    prompt: "Bridging assets between chains mainly adds:",
    options: [
      "Smart-contract and delay risk beyond a same-chain swap",
      "A guaranteed arb profit",
      "Elimination of honeypot risk",
      "Free CEX listings",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-opt-1",
    lessonId: "options-volatility",
    prompt: "Implied volatility (IV) rising usually makes option premiums:",
    options: [
      "More expensive (richer), all else equal",
      "Always free",
      "Irrelevant to pricing",
      "Identical to funding rates",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-opt-2",
    lessonId: "options-volatility",
    prompt: "Theta in options refers to:",
    options: [
      "Time decay — value can bleed as expiry approaches",
      "The mark price on perps",
      "A forex pip convention",
      "Open interest on memes",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-opt-3",
    lessonId: "options-volatility",
    prompt: "Compared with a perp long, a long call’s clock is mainly:",
    options: [
      "Expiry / premium decay — not perpetual funding + liq margin alone",
      "Identical in every way to isolated margin",
      "Only weekend swaps",
      "Unlimited hold with no decay ever",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-bt-1",
    lessonId: "backtesting-expectancy",
    prompt: "A forward test means:",
    options: [
      "Running fixed rules on unseen live/paper data after the backtest",
      "Deleting losing trades from history",
      "Optimizing indicators until the equity curve looks perfect",
      "Only trading weekends",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-bt-2",
    lessonId: "backtesting-expectancy",
    prompt: "Leaving fees and funding out of a perp backtest often:",
    options: [
      "Inflates apparent edge vs live trading",
      "Makes results more realistic",
      "Removes the need for a stop",
      "Guarantees prop-firm funding",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-bt-3",
    lessonId: "backtesting-expectancy",
    prompt: "Small sample size is a problem because:",
    options: [
      "A handful of trades can look lucky without proving expectancy",
      "You must always use max leverage",
      "Charts become illegal",
      "R-multiples stop working",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-flow-1",
    lessonId: "novastaris-workflow",
    prompt: "A sensible meme workflow on NovaStaris starts with:",
    options: [
      "Discovery (Go Hunting) → AI scoring / checks → size with invalidation",
      "Max leverage on the first ticker you see",
      "Skipping risk rules when the score is green",
      "Sharing your seed phrase with support bots",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-flow-2",
    lessonId: "novastaris-workflow",
    prompt: "If two NovaStaris tools disagree on a setup, a good default is:",
    options: [
      "Reduce size or stand aside — disagreement is information",
      "Double size to average out uncertainty",
      "Ignore both and chase social FOMO",
      "Disable all feature flags",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-flow-3",
    lessonId: "novastaris-workflow",
    prompt: "Green AI scores should:",
    options: [
      "Never override a broken thesis or missing invalidation",
      "Always mean you must buy immediately",
      "Replace stop-losses entirely",
      "Guarantee a funded prop account",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-adv-1",
    lessonId: "advanced-markets",
    prompt: "Perp funding rates primarily:",
    options: [
      "Transfer payments between longs and shorts to keep perps near spot",
      "Delete open interest every hour",
      "Set forex pip size",
      "Mint new meme tokens",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-adv-2",
    lessonId: "advanced-markets",
    prompt: "A common tokenomics red flag is:",
    options: [
      "Supply concentrated in a few wallets with weak LP protection",
      "A public contract address",
      "Using USDT as a quote asset",
      "Having a Twitter community",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-adv-3",
    lessonId: "advanced-markets",
    prompt: "Prop-firm challenges commonly enforce:",
    options: [
      "Max daily loss / max drawdown rules you must not breach",
      "Unlimited revenge trading with no limits",
      "Mandatory 100x leverage on every trade",
      "Sharing login credentials publicly",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-chart-7",
    lessonId: "chart-basics",
    prompt: "How does a hanging man differ from a hammer?",
    options: [
      "Same candle shape, but hanging man appears after a rise as a potential weakness warning",
      "A hanging man always has no lower wick",
      "Hammers only print on weekly charts",
      "They are identical with no context difference",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-chart-8",
    lessonId: "chart-basics",
    prompt: "An evening star sequence is typically:",
    options: [
      "Up move, small indecision, then strong down close — potential topping idea",
      "Three green marubozu candles that guarantee a long",
      "A funding payment schedule",
      "A prop-firm daily loss rule",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-fut-1",
    lessonId: "crypto-futures",
    prompt: "Mark price on many perp venues is used mainly for:",
    options: [
      "Liquidation and unrealized PnL math — it may differ from the last trade print",
      "Setting forex lot size",
      "Minting meme tokens",
      "Replacing stop-losses",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-fut-2",
    lessonId: "crypto-futures",
    prompt: "Holding a long through many intervals of high positive funding means:",
    options: [
      "You typically pay shorts repeatedly — a holding cost even if price is flat",
      "You always earn yield from shorts",
      "Funding deletes your liquidation price",
      "The position becomes spot BTC",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-fx-4",
    lessonId: "forex",
    prompt: "On EUR/USD (~$1/pip per 0.10 lot), a 20-pip stop at 0.10 lot risks about:",
    options: [
      "$20 before spread",
      "$2 before spread",
      "$200 before spread",
      "$0.20 before spread",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-metals-1",
    lessonId: "trading-metals",
    prompt: "XAU/USDT on a crypto exchange is best described as:",
    options: [
      "A USDT perpetual that tracks gold — funding and liquidation apply like other perps",
      "Physical gold delivery settled in cash only on weekends",
      "The same contract type as spot EUR/USD with FX pip math only",
      "A stablecoin that always stays at $1",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-metals-2",
    lessonId: "trading-metals",
    prompt: "On many XAU/USD forex desks, 1 pip is commonly:",
    options: [
      "About 0.01 in price (one cent) — not 0.0001 like EUR/USD",
      "Always exactly 0.0001 like EUR/USD",
      "Always $10 of gold no matter the lot size",
      "Impossible to define because gold never moves",
    ],
    correctIndex: 0,
  },
  {
    id: "cp-metals-3",
    lessonId: "trading-metals",
    prompt: "The clean way to size a gold idea across FX and crypto rails is:",
    options: [
      "Convert the stop to $ risk on the venue you actually trade, then choose size",
      "Always use a 20-pip EUR/USD calculator on every metal",
      "Ignore tick size on Blofin because gold is traditional",
      "Max leverage first, then invent a stop",
    ],
    correctIndex: 0,
  },
];

/** Practice: up to `limit` questions for a lesson from all sets + chapter bank (no answers). */
export function getPracticeQuestionsForLesson(
  lessonId: string,
  limit = 3
): PublicQuizQuestion[] {
  const seen = new Set<string>();
  const out: PublicQuizQuestion[] = [];
  const pools = [...CHAPTER_PRACTICE_BANK, ...EXAM_SET_IDS.flatMap((id) => EXAM_SETS[id])];
  for (const q of pools) {
    if (q.lessonId !== lessonId) continue;
    const key = q.prompt.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: q.id, lessonId: q.lessonId, prompt: q.prompt, options: [...q.options] });
    if (out.length >= limit) return out;
  }
  return out;
}

export function scorePracticeAnswers(answers: Record<string, number>): {
  correct: number;
  total: number;
  results: { id: string; correct: boolean; correctIndex: number }[];
} {
  const byId = new Map<string, UniversityQuizQuestion>();
  for (const q of CHAPTER_PRACTICE_BANK) byId.set(q.id, q);
  for (const setId of EXAM_SET_IDS) {
    for (const q of EXAM_SETS[setId]) byId.set(q.id, q);
  }
  const results: { id: string; correct: boolean; correctIndex: number }[] = [];
  let correct = 0;
  for (const [id, picked] of Object.entries(answers)) {
    const q = byId.get(id);
    if (!q) continue;
    const ok = picked === q.correctIndex;
    if (ok) correct += 1;
    results.push({ id, correct: ok, correctIndex: q.correctIndex });
  }
  return { correct, total: results.length, results };
}

/** Admin: full keys for all sets. */
export function getAdminExamKeys() {
  return EXAM_SET_IDS.map((setId) => ({
    setId,
    questionCount: EXAM_SETS[setId].length,
    questions: EXAM_SETS[setId].map((q) => ({
      id: q.id,
      lessonId: q.lessonId,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      correctAnswer: q.options[q.correctIndex],
    })),
  }));
}
