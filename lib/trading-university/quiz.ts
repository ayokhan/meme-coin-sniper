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
  {
    id: "q21",
    lessonId: "meme-coins",
    prompt: "Why can a few wallets strongly affect a meme coin’s price?",
    options: [
      "Meme coins always have infinite liquidity",
      "Supply is often concentrated, so large sells or buys move price sharply",
      "Regulators set a fixed daily price band",
      "Funding rates force price to move only upward",
    ],
    correctIndex: 1,
  },
  {
    id: "q22",
    lessonId: "meme-coins",
    prompt: "What should you treat meme trading capital as?",
    options: [
      "Money you can lose entirely without harming essential expenses",
      "Rent and bill money leveraged 50x",
      "Guaranteed yield similar to a savings account",
      "Collateral that cannot be liquidated",
    ],
    correctIndex: 0,
  },
  {
    id: "q23",
    lessonId: "meme-trading",
    prompt: "A complete trade plan should usually include:",
    options: [
      "Only a take-profit target",
      "Entry, invalidation (stop), targets, and risk size",
      "A social media announcement schedule",
      "Unlimited average-downs with no exit",
    ],
    correctIndex: 1,
  },
  {
    id: "q24",
    lessonId: "meme-trading",
    prompt: "What is slippage?",
    options: [
      "The difference between expected fill and actual fill, often worse in thin markets",
      "A type of funding payment on perps",
      "The overnight interest on a forex swap",
      "A certificate awarded after a quiz",
    ],
    correctIndex: 0,
  },
  {
    id: "q25",
    lessonId: "solana",
    prompt: "What is SOL primarily used for on Solana?",
    options: [
      "Only as a meme ticker with no network use",
      "Network fees and staking, among other uses",
      "Settling EUR/USD forex trades",
      "Paying Polymarket resolution oracles only",
    ],
    correctIndex: 1,
  },
  {
    id: "q26",
    lessonId: "solana",
    prompt: "Why should traders verify mint addresses carefully?",
    options: [
      "Scammers frequently clone tickers and logos",
      "Every mint address is identical across chains",
      "Mint addresses expire every hour",
      "Exchanges ban all unverified memes automatically",
    ],
    correctIndex: 0,
  },
  {
    id: "q27",
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
    id: "q28",
    lessonId: "solana-memes",
    prompt: "A coordinated set of wallets buying at launch to control supply is often called a:",
    options: ["Pip", "Bundle", "Funding rate", "Cross margin"],
    correctIndex: 1,
  },
  {
    id: "q29",
    lessonId: "bsc-memes",
    prompt: "BSC token contracts typically use which address format?",
    options: [
      "0x… EVM-style addresses",
      "Only Solana base58 mints",
      "IBAN bank account numbers",
      "Forex pair tickers like EURUSD",
    ],
    correctIndex: 0,
  },
  {
    id: "q30",
    lessonId: "bsc-memes",
    prompt: "Before sizing up on a BSC meme, a prudent check is to:",
    options: [
      "Assume every LP is permanently locked",
      "Simulate or verify that you can sell (watch for honeypots / extreme taxes)",
      "Max leverage the position on a CEX immediately",
      "Ignore BscScan and holder distribution",
    ],
    correctIndex: 1,
  },
  {
    id: "q31",
    lessonId: "crypto-futures",
    prompt: "How does spot trading differ from trading perps?",
    options: [
      "Spot owns the asset; perps trade leveraged price exposure via a contract",
      "Perps always expire in 24 hours; spot never settles",
      "Spot requires funding payments every hour",
      "Perps cannot go short",
    ],
    correctIndex: 0,
  },
  {
    id: "q32",
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
    id: "q33",
    lessonId: "crypto-futures",
    prompt: "Cross margin generally means:",
    options: [
      "Collateral is shared across positions, raising capital efficiency and contagion risk",
      "Each position’s loss is hard-capped to its own isolated collateral only",
      "You cannot open more than one trade",
      "Liquidation is impossible",
    ],
    correctIndex: 0,
  },
  {
    id: "q34",
    lessonId: "crypto-futures",
    prompt: "Notional position size is best described as:",
    options: [
      "Roughly the total exposure (related to margin × leverage)",
      "Only the funding you paid this hour",
      "The number of quiz questions remaining",
      "The bid–ask spread in pips",
    ],
    correctIndex: 0,
  },
  {
    id: "q35",
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
    id: "q36",
    lessonId: "predictions",
    prompt: "A binary prediction market typically pays out based on:",
    options: [
      "Yes/No (or equivalent) outcome of a defined event",
      "Continuous dividend yield forever",
      "Pip distance from entry only",
      "Whether funding is positive",
    ],
    correctIndex: 0,
  },
  {
    id: "q37",
    lessonId: "forex",
    prompt: "In GBP/USD, USD is the:",
    options: ["Base currency", "Quote currency", "Pipette only", "Funding currency on Solana"],
    correctIndex: 1,
  },
  {
    id: "q38",
    lessonId: "forex",
    prompt: "A standard lot in FX is typically:",
    options: [
      "100,000 units of the base currency",
      "1 unit of the base currency",
      "40 quiz questions",
      "The same as one Solana mint",
    ],
    correctIndex: 0,
  },
  {
    id: "q39",
    lessonId: "forex",
    prompt: "Higher FX leverage mainly:",
    options: [
      "Removes the need for a stop-loss",
      "Increases exposure and shortens the distance to a margin call / forced close",
      "Guarantees profit during London open",
      "Converts CFDs into spot ownership of cash",
    ],
    correctIndex: 1,
  },
  {
    id: "q40",
    lessonId: "forex",
    prompt: "Why do CPI, NFP, and central bank decisions matter to FX traders?",
    options: [
      "They can cause sharp volatility spikes around releases",
      "They permanently freeze all currency pairs",
      "They only affect meme coins on BSC",
      "They replace the need for position sizing",
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
