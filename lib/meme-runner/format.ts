import type { MemeRunnerToken } from "@/lib/meme-runner/types";

export function formatMemeRunnerShareForCoach(t: MemeRunnerToken): { title: string; content: string } {
  const title = `Meme Runner · ${t.symbol} (${t.lane})`;
  const lines = [
    `${t.name} · ${t.symbol}`,
    `Contract: ${t.contractAddress}`,
    `Lane: ${t.lane} · Score ${t.runnerScore}`,
    `MC ${t.marketCapUsd != null ? `$${Math.round(t.marketCapUsd).toLocaleString()}` : "—"} · Age ${t.tokenAgeMinutes}m`,
    `Vol ${t.volume24hUsd != null ? `$${Math.round(t.volume24hUsd).toLocaleString()}` : "—"} · Est. fees ~${t.estimatedFeesSol} SOL`,
    t.bondingProgressPct != null ? `Bonding curve ~${t.bondingProgressPct}%` : null,
    t.dexUrl ? `Chart: ${t.dexUrl}` : null,
    `pump.fun: https://pump.fun/coin/${t.contractAddress}`,
  ].filter(Boolean);
  return { title, content: lines.join("\n") };
}
