import Anthropic from "@anthropic-ai/sdk";
import type { NovaFiveMinsTapeRegime } from "@/lib/ai-nova-five-mins";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NovaDeepTiming = "start_now" | "wait_for_boundary" | "wait_for_tape";

export type NovaFiveMinsDeepResult = {
  timingRecommendation: NovaDeepTiming;
  nextSlotNote: string;
  directionLean: "Up" | "Down" | "Unclear";
  confidencePct: number;
  tapeRegime: NovaFiveMinsTapeRegime;
  summary: string;
  factors: string[];
  riskNote: string;
};

function parseTapeRegime(raw: string | undefined): NovaFiveMinsTapeRegime {
  const t = (raw ?? "").toLowerCase().replace(/[^a-z_]/g, "");
  if (t === "up_slope" || t === "upslope") return "up_slope";
  if (t === "down_slope" || t === "downslope") return "down_slope";
  if (t === "sideways" || t === "range" || t === "chop") return "sideways";
  if (t === "mixed" || t === "two_way" || t === "twoway") return "mixed";
  return "mixed";
}

function parseTiming(raw: string | undefined): NovaDeepTiming {
  const t = (raw ?? "").toLowerCase().replace(/[^a-z_]/g, "");
  if (t === "start_now" || t === "startnow") return "start_now";
  if (t === "wait_for_boundary" || t === "waitforboundary" || t === "boundary") return "wait_for_boundary";
  return "wait_for_tape";
}

function parseDeepLines(text: string): NovaFiveMinsDeepResult {
  const timingMatch = text.match(/TIMING:\s*(start_now|wait_for_boundary|wait_for_tape)/i);
  const nextNoteMatch = text.match(/NEXT_SLOT_NOTE:\s*([\s\S]+?)(?=LEAN:|SUMMARY:|$)/i);
  const leanMatch = text.match(/LEAN:\s*(Up|Down|Unclear)/i);
  const confMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
  const regimeMatch = text.match(/REGIME:\s*(up_slope|down_slope|sideways|mixed|upslope|downslope|range|chop|two_way|twoway)/i);
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]+?)(?=FACTORS:|RISK:|$)/i);
  const factorsMatch = text.match(/FACTORS:\s*([\s\S]+?)(?=RISK:|$)/i);
  const riskMatch = text.match(/RISK:\s*([\s\S]+?)$/im);

  const timingRecommendation = parseTiming(timingMatch?.[1]);
  const nextSlotNote = nextNoteMatch?.[1]?.trim().replace(/\n+/g, " ") || "No timing note returned.";
  const lr = leanMatch?.[1]?.toLowerCase();
  const directionLean: "Up" | "Down" | "Unclear" =
    lr === "up" ? "Up" : lr === "down" ? "Down" : "Unclear";
  const confidencePct = confMatch ? Math.min(100, Math.max(0, parseInt(confMatch[1]!, 10))) : 0;
  const tapeRegime = parseTapeRegime(regimeMatch?.[1]);
  const summary = summaryMatch?.[1]?.trim().replace(/\n+/g, " ") || "No summary returned.";
  const factorsText = factorsMatch?.[1]?.trim() ?? "";
  const factors = factorsText
    ? factorsText
        .split(/[;\n•]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const riskNote =
    riskMatch?.[1]?.trim() ||
    "Not financial advice. Timing is on Binance 1m structure only; Polymarket uses Chainlink and its own clock.";

  return {
    timingRecommendation,
    nextSlotNote,
    directionLean,
    confidencePct,
    tapeRegime,
    summary,
    factors,
    riskNote,
  };
}

export type NovaDeepSource = "nova_deep" | "post_cycle";

/**
 * Nova Deep: entry timing vs next 5m UTC-aligned slot + directional context (Binance tape only).
 */
export async function runNovaFiveMinsDeepAnalysis(
  marketFacts: string,
  symbolLabel: string,
  opts: {
    nextSlotUtcIso: string;
    secondsUntilNextSlot: number;
    source: NovaDeepSource;
    cycleEndedAtIso?: string | null;
  }
): Promise<NovaFiveMinsDeepResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      timingRecommendation: "wait_for_tape",
      nextSlotNote: "ANTHROPIC_API_KEY is not set.",
      directionLean: "Unclear",
      confidencePct: 0,
      tapeRegime: "mixed",
      summary: "Nova Deep is unavailable.",
      factors: [],
      riskNote: "Configure Anthropic on the server.",
    };
  }

  const post = opts.source === "post_cycle" && opts.cycleEndedAtIso
    ? `The user JUST finished a personal 5-minute trade cycle that ended at (their clock / ISO): ${opts.cycleEndedAtIso}. They may start another cycle soon. `
    : "";

  const prompt = `You are **Nova Deep** — a senior crypto microstructure + *timing* analyst for VIP users who trade short-horizon Up/Down style ideas (Polymarket-inspired; settlement is NOT this feed).

${post}Hard fact: the next **5-minute UTC-aligned** boundary (epoch grid — :00, :05, :10… UTC) starts at **${opts.nextSlotUtcIso}**, in approximately **${opts.secondsUntilNextSlot}** seconds from when this prompt was built.

Context (1m candles — NOT Chainlink):
${marketFacts}

Asset: ${symbolLabel}

Task:
1) Recommend when they should tap **Start** on their next 5m cycle: **start_now** if the tape already offers a clean edge and waiting risks missing the move; **wait_for_boundary** if chop/noise makes waiting for the next UTC 5m slot materially better; **wait_for_tape** if they should stand aside until structure improves (even past the next slot).
2) Give a **direction lean** (LEAN) for how spot might resolve over the *next* 5m window after that decision — still Unclear if appropriate.
3) NEXT_SLOT_NOTE must explicitly mention the UTC time above when you choose wait_for_boundary, and what to watch before then.

Rules:
- Never promise profit; no trade orders.
- Output EXACTLY these lines and nothing else:
TIMING: start_now|wait_for_boundary|wait_for_tape
NEXT_SLOT_NOTE: one or two sentences
LEAN: Up|Down|Unclear
CONFIDENCE: 0-100
REGIME: up_slope|down_slope|sideways|mixed
SUMMARY: two or three sentences (dense insight)
FACTORS: bullet phrases separated by semicolons (max 7)
RISK: one sentence`;

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 720,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    msg.content?.find((b) => b.type === "text")?.type === "text"
      ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
      : "";

  return parseDeepLines(text);
}
