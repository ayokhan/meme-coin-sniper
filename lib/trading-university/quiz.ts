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
    lessonId: "intro-crypto",
    prompt: "An altcoin generally means:",
    options: [
      "Any cryptocurrency other than Bitcoin",
      "Only stablecoins pegged to gold",
      "Only tokens listed on NYSE",
      "A pipette on EUR/USD",
    ],
    correctIndex: 0,
  },
  {
    id: "q3",
    lessonId: "intro-crypto",
    prompt: "DeFi primarily refers to:",
    options: [
      "Financial services run via smart contracts instead of traditional intermediaries",
      "Only centralized bank wire transfers",
      "Printing physical cash",
      "Forex dealing desks only",
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
    lessonId: "intro-crypto",
    prompt: "A key difference between a CEX and a DEX is:",
    options: [
      "CEXs typically custody funds for you; DEXs trade from your own wallet",
      "DEXs always require government KYC before any swap",
      "CEXs cannot list futures",
      "DEXs eliminate all scams automatically",
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
    id: "q38",
    lessonId: "intro-crypto",
    prompt: "Stablecoins like USDT or USDC are designed mainly to:",
    options: [
      "Track a fiat currency such as the US dollar",
      "Always outperform Bitcoin",
      "Replace seed phrases",
      "Eliminate CEX custody risk",
    ],
    correctIndex: 0,
  },
  {
    id: "q39",
    lessonId: "wallets-security",
    prompt: "Why separate a degen trading wallet from long-term savings?",
    options: [
      "To limit blast radius if a hot wallet or approval is compromised",
      "Because exchanges ban wallets with more than one address",
      "Because seed phrases only work on one wallet forever",
      "Because DEXs reject savings wallets",
    ],
    correctIndex: 0,
  },
  {
    id: "q40",
    lessonId: "meme-trading",
    prompt: "What is slippage?",
    options: [
      "The difference between expected fill and actual fill, often worse in thin markets",
      "A type of funding payment on perps",
      "The overnight interest on a forex swap",
      "A certificate ID code",
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
