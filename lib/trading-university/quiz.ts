/** Quiz bank — correctIndex is server-only; clients never receive it on GET. */

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
    id: "q2",
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
    id: "q3",
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
    id: "q4",
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
    id: "q5",
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
    id: "q6",
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
    id: "q7",
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
    id: "q8",
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
    id: "q9",
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
    id: "q10",
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
    id: "q11",
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
    id: "q12",
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
    id: "q13",
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
    id: "q14",
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
    id: "q15",
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
    id: "q16",
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
    id: "q17",
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
    id: "q18",
    lessonId: "forex",
    prompt: "In EUR/USD, which is the base currency?",
    options: ["USD", "EUR", "JPY", "GBP"],
    correctIndex: 1,
  },
  {
    id: "q19",
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
    id: "q20",
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
];

export type PublicQuizQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
};

export function getPublicQuizQuestions(): PublicQuizQuestion[] {
  return TRADING_UNIVERSITY_QUIZ_BANK.map(({ id, lessonId, prompt, options }) => ({
    id,
    lessonId,
    prompt,
    options: [...options],
  }));
}

export function scoreQuizAnswers(answers: Record<string, number>): {
  correct: number;
  total: number;
  scorePct: number;
  missedIds: string[];
} {
  const total = TRADING_UNIVERSITY_QUIZ_BANK.length;
  let correct = 0;
  const missedIds: string[] = [];
  for (const q of TRADING_UNIVERSITY_QUIZ_BANK) {
    const picked = answers[q.id];
    if (picked === q.correctIndex) correct += 1;
    else missedIds.push(q.id);
  }
  const scorePct = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
  return { correct, total, scorePct, missedIds };
}
