/** Common mistakes callouts shown at the end of each Trading University module. */

export const COMMON_MISTAKES_BY_LESSON: Record<string, string[]> = {
  "intro-crypto": [
    "Treating every token like Bitcoin — most alts and memes have different risk.",
    "Confusing CEX custody with self-custody on a DEX.",
    "Ignoring that USDT/USDC are useful but not risk-free.",
  ],
  "wallets-security": [
    "Typing a seed phrase into a website, bot, or 'support' chat.",
    "Keeping life savings on the same hot wallet used for degen trades.",
    "Ignoring unlimited token approvals on EVM chains.",
  ],
  "risk-fundamentals": [
    "Sizing from FOMO instead of stop distance.",
    "Moving stops farther after entry without a new thesis.",
    "Skipping a daily loss limit and revenge trading.",
  ],
  "chart-basics": [
    "Trading a single candle pattern with no structure or invalidation.",
    "Using a 1m stop on a daily idea (timeframe mismatch).",
    "Treating Fib levels as guarantees instead of confluence zones.",
    "Forcing trend lines through noise and trading every touch.",
  ],
  "orders-execution": [
    "Entering without a stop-loss already planned.",
    "Using a market order in a thin book and blaming 'manipulation' for slippage.",
    "Leaving working limits live after the thesis changed.",
    "Moving a stop farther from entry after you are already wrong.",
  ],
  "psychology-journaling": [
    "Forcing a trade to 'win back' a loss the same session.",
    "Raising size after a win because you feel invincible.",
    "Journaling only P&L screenshots with no process notes.",
  ],
  "trading-styles": [
    "Turning a failed scalp into a multi-day hope hold.",
    "Using scalp size with a swing-wide stop (silent 5–10R risk).",
    "Picking a style you cannot actually monitor with your schedule.",
  ],
  "market-structure": [
    "Chasing every breakout through obvious highs/lows (liquidity grabs).",
    "Calling CHOCH a full trend change after one candle.",
    "Fighting higher-timeframe structure on a lower timeframe scalp.",
    "Calling mid-range chop a bull or bear 'regime' and overtrading it.",
  ],
  "volume-vwap": [
    "Treating VWAP as a guaranteed bounce button.",
    "Trusting tiny-cap 'volume' without considering wash trading.",
    "Ignoring that some FX/CFD feeds have unreliable volume bars.",
  ],
  "ethereum-l2s": [
    "Swapping a CA on the wrong network because the ticker matched.",
    "Leaving unlimited approvals on random routers forever.",
    "Using random bridges from DMs instead of known routes.",
  ],
  "options-volatility": [
    "Buying calls only because 'chart looks bullish' with no vol/expiry plan.",
    "Selling naked crypto options without defined risk.",
    "Confusing perp liquidations with option premium decay.",
  ],
  "backtesting-expectancy": [
    "Optimizing 10 indicators on one bull month and calling it edge.",
    "Ignoring fees/funding in the backtest.",
    "Going full size after 12 lucky paper trades.",
  ],
  "meme-coins": [
    "Sizing memes like blue-chip holds.",
    "Buying narrative without checking liquidity and holders.",
    "Assuming a funny ticker equals due diligence.",
  ],
  "meme-trading": [
    "Overpaying tips/bribes on tiny size so fees dominate PnL.",
    "Averaging down with no invalidation.",
    "FOMO chasing after a multi-x already printed.",
  ],
  solana: [
    "Trusting ticker/logo clones without verifying the mint.",
    "Mixing savings with a sniper/trading wallet.",
    "Ignoring congestion and tip costs during mania.",
  ],
  "solana-memes": [
    "Treating every bonding-curve launch as free money.",
    "Ignoring bundles / coordinated launch wallets.",
    "Entering late distribution as if it were early discovery.",
  ],
  "bsc-memes": [
    "Skipping honeypot/tax checks on BEP-20 contracts.",
    "Assuming LP is locked because a site said so.",
    "Copying CA from social without verifying on BscScan.",
  ],
  "crypto-futures": [
    "Using max leverage because 'it is only a small move.'",
    "Ignoring funding and liquidation distance.",
    "Cross-margining everything without understanding contagion risk.",
  ],
  predictions: [
    "Buying Yes because the story feels good, not because price is wrong.",
    "Ignoring resolution criteria and dispute risk.",
    "Sizing into thin books near expiry.",
  ],
  forex: [
    "Trading exotics with size meant for majors.",
    "Blind trading into NFP/CPI with a scalp stop.",
    "Forgetting swap costs on multi-day holds.",
  ],
  "novastaris-workflow": [
    "Letting a green AI score override missing invalidation.",
    "Tab-hopping without a market path (meme vs perps vs FX).",
    "Doubling size when tools disagree.",
  ],
  "advanced-markets": [
    "Fading extreme funding without a plan for squeezes.",
    "Skipping unlock/holder red flags on memes.",
    "Breaking prop-firm daily loss rules to 'make it back.'",
  ],
};

export function getCommonMistakes(lessonId: string): string[] {
  return COMMON_MISTAKES_BY_LESSON[lessonId] ?? [];
}
