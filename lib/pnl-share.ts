/** Share PNL JPEG from the browser (download, native share, Telegram text, Instagram via share/download). */

export type SharePnlResult = "native" | "download" | "cancelled" | "unsupported";

import type { ClosedTradesAnalysis } from "@/lib/closed-trades";

export function buildAnalysisShareCaption(parts: {
  periodLabel: string;
  analysis: ClosedTradesAnalysis;
  showPnlDetails: boolean;
}): string {
  const { analysis: a, periodLabel, showPnlDetails } = parts;
  const lines = [
    `NovaStaris trading results · ${periodLabel}`,
    `${a.totalTrades} trades · ${a.wins}W / ${a.losses}L · ${a.winRatePct.toFixed(1)}% win rate`,
  ];
  if (showPnlDetails) {
    const sign = a.totalRealizedUsdt >= 0 ? "+" : "";
    lines.push(`Total PNL: ${sign}${a.totalRealizedUsdt.toFixed(2)} USDT`);
    if (a.avgWinUsdt != null) lines.push(`Avg win: +${a.avgWinUsdt.toFixed(2)} USDT`);
    if (a.avgLossUsdt != null) lines.push(`Avg loss: ${a.avgLossUsdt.toFixed(2)} USDT`);
  }
  lines.push("", "https://novastaris.ai");
  return lines.join("\n");
}

export function buildPnlShareCaption(parts: {
  symbol: string;
  roiPct: number;
  pnlUsdt?: number;
  showUsdt: boolean;
  kind: "open" | "closed";
}): string {
  const roi = `${parts.roiPct >= 0 ? "+" : ""}${parts.roiPct.toFixed(2)}%`;
  const usdt =
    parts.showUsdt && parts.pnlUsdt != null
      ? ` · ${parts.pnlUsdt >= 0 ? "+" : ""}${parts.pnlUsdt.toFixed(2)} USDT`
      : "";
  const label = parts.kind === "open" ? "open position" : "closed trade";
  return `${parts.symbol} ${label} ${roi}${usdt} on NovaStaris AI\n\nhttps://novastaris.ai`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Mobile / supported browsers: share image to Telegram, Instagram, etc. */
export async function nativeSharePnlBlob(
  blob: Blob,
  filename: string,
  caption: string
): Promise<SharePnlResult> {
  if (typeof navigator === "undefined" || !navigator.share) return "unsupported";
  try {
    const file = new File([blob], filename, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "NovaStaris PNL", text: caption });
      return "native";
    }
    await navigator.share({ title: "NovaStaris PNL", text: caption, url: "https://novastaris.ai" });
    return "native";
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

export function openTelegramShare(caption: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent("https://novastaris.ai")}&text=${encodeURIComponent(caption)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Instagram has no web image API — try native share, else download for upload to Stories. */
export async function shareToInstagram(blob: Blob, filename: string, caption: string): Promise<SharePnlResult> {
  const native = await nativeSharePnlBlob(blob, filename, caption);
  if (native === "native") return native;
  downloadBlob(blob, filename);
  return "download";
}

export async function sharePnlWithFallback(
  blob: Blob,
  filename: string,
  caption: string
): Promise<SharePnlResult> {
  const native = await nativeSharePnlBlob(blob, filename, caption);
  if (native === "native" || native === "cancelled") return native;
  downloadBlob(blob, filename);
  return "download";
}
