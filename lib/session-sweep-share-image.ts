/**
 * Session Sweep launch postcards (rendered by scripts/generate-session-sweep-assets.mjs).
 * Square 1080×1080 for X / IG feed / WhatsApp / Telegram, story 1080×1920 for IG / WhatsApp status.
 */
import { downloadBlob } from "@/lib/pnl-share";

export type SessionSweepPostcardSize = "square" | "story";

const ASSETS: Record<SessionSweepPostcardSize, string> = {
  square: "/marketing/novastaris-session-sweep-postcard-premium.png",
  story: "/marketing/novastaris-session-sweep-story-premium.png",
};

export async function drawSessionSweepPostcard(size: SessionSweepPostcardSize): Promise<Blob> {
  const res = await fetch(ASSETS[size]);
  if (!res.ok) throw new Error("Session Sweep postcard asset not found.");
  return res.blob();
}

export function sessionSweepPostcardFilename(size: SessionSweepPostcardSize): string {
  const suffix = size === "story" ? "Story" : "Square";
  return `NovaStaris_Session_Sweep_${suffix}_${new Date().toISOString().slice(0, 10)}.png`;
}

export async function downloadSessionSweepPostcard(size: SessionSweepPostcardSize) {
  const blob = await drawSessionSweepPostcard(size);
  downloadBlob(blob, sessionSweepPostcardFilename(size));
}

export function buildSessionSweepShareCaption(size: SessionSweepPostcardSize = "square"): string {
  if (size === "story") {
    return [
      "New on NovaStaris VIP: Session Sweep.",
      "Sweep → CHoCH → BOS, tracked live on gold, silver, forex & crypto perps.",
      "https://novastaris.ai/?tab=session-sweep",
      "Educational only — not financial advice.",
    ].join("\n");
  }
  return [
    "New on NovaStaris VIP: Session Sweep.",
    "",
    "Most session highs and lows get swept before the real move. Session Sweep tracks the Asia, London & New York ranges and waits for the full sequence:",
    "1. Sweep: price runs the stops past a session high/low and snaps back",
    "2. CHoCH: first close against the old trend",
    "3. BOS: structure breaks, with entry, stop and a 3R target mapped",
    "",
    "Gold, silver, forex & crypto perps. Backtests include spread and fees.",
    "https://novastaris.ai/?tab=session-sweep",
    "",
    "Not every sweep reverses. Educational only — not financial advice.",
  ].join("\n");
}
