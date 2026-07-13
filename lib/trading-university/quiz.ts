/** Quiz bank — correctIndex is server-only; clients never receive it on GET. */

import { EXAM_SET_B, EXAM_SET_C } from "@/lib/trading-university/quiz-sets-extra";

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
    lessonId: "meme-trading",
    prompt: "Priority fees / tips on busy networks are paid mainly to:",
    options: [
      "Land your transaction faster when congested",
      "Guarantee a 10x profit",
      "Cancel liquidation forever",
      "Convert perps into spot ownership",
    ],
    correctIndex: 0,
  },
  {
    id: "q14",
    lessonId: "meme-trading",
    prompt: "On Solana, a 'bribe' or Jito tip most often means:",
    options: [
      "Extra SOL paid to improve chances your tx is prioritized in competitive launches",
      "A forex overnight swap fee",
      "A Polymarket resolution bond",
      "A CEX maker rebate only",
    ],
    correctIndex: 0,
  },
  {
    id: "q15",
    lessonId: "meme-trading",
    prompt: "All-in trading cost on a meme buy should include:",
    options: [
      "Network fee + any tip/bribe + slippage/price impact (+ CEX fees if applicable)",
      "Only the token’s market-cap number",
      "Only the chart emoji on Telegram",
      "Funding rate alone",
    ],
    correctIndex: 0,
  },
  {
    id: "q16",
    lessonId: "meme-trading",
    prompt: "Which is a common meme trading mistake?",
    options: [
      "Defining a stop before entry",
      "Taking partial profits into strength",
      "FOMO chasing after a large move has already printed",
      "Checking whether you can actually sell size",
    ],
    correctIndex: 2,
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
    lessonId: "solana-memes",
    prompt: "What does 'migration' often mean in Sol meme launches?",
    options: [
      "Moving from a launchpad/bonding phase to open DEX liquidity",
      "Converting SOL into USD forever",
      "Closing a forex position at London open",
      "Paying the other side of a prediction market",
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
    prompt: "Isolated margin means:",
    options: [
      "All account equity is shared across every position",
      "Collateral (and loss) is limited to that position's allocated margin",
      "You cannot use stop-loss orders",
      "Funding is always zero",
    ],
    correctIndex: 1,
  },
  {
    id: "q29",
    lessonId: "crypto-futures",
    prompt: "What is funding on perpetual futures?",
    options: [
      "A periodic payment between longs and shorts to keep perp price near spot",
      "A one-time exchange listing fee",
      "The pip value on EUR/USD",
      "A prediction market resolution bond",
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
    prompt: "The spread in FX is:",
    options: [
      "Ask price minus bid price — a cost of trading",
      "Your unrealized profit only",
      "The distance to liquidation only",
      "Always exactly one pip on every pair",
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
    lessonId: "advanced-markets",
    prompt: "Open interest (OI) on perps refers to:",
    options: [
      "The number of outstanding perpetual contracts still open",
      "The overnight forex swap only",
      "Your wallet seed backup count",
      "The number of meme Telegram channels",
    ],
    correctIndex: 0,
  },
  {
    id: "q38",
    lessonId: "chart-basics",
    prompt: "A doji candle usually suggests:",
    options: [
      "Open and close are nearly equal — indecision",
      "Guaranteed continuation of the prior trend",
      "A 10× leverage requirement",
      "That the pair has no spread",
    ],
    correctIndex: 0,
  },
  {
    id: "q39",
    lessonId: "psychology-journaling",
    prompt: "What should you do when you hit your daily loss limit?",
    options: [
      "Stop trading for the day — no exceptions for 'one more setup'",
      "Double size to recover faster",
      "Disable your stop-loss",
      "Only trade meme coins after that",
    ],
    correctIndex: 0,
  },
  {
    id: "q40",
    lessonId: "market-structure",
    prompt: "A liquidity grab is best described as:",
    options: [
      "A spike beyond obvious highs/lows that runs stops, often before reversing",
      "A guaranteed breakout that never fails",
      "The overnight forex swap payment",
      "A Solana priority tip only",
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

/** Set A = original bank (q1–q40). Sets B/C rotate for world-class variety. */
export const EXAM_SETS: Record<ExamSetId, UniversityQuizQuestion[]> = {
  A: TRADING_UNIVERSITY_QUIZ_BANK,
  B: EXAM_SET_B,
  C: EXAM_SET_C,
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
