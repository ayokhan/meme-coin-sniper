/**
 * Premium PNL share cards (closed & open) — social / CT. Browser-only (canvas).
 */

import type { ClosedTradesAnalysis } from "@/lib/closed-trades";
import { downloadBlob } from "@/lib/pnl-share";

export type ClosedTradeShareInput = {
  displaySymbol: string;
  direction: "long" | "short";
  openPrice: number;
  closePrice: number;
  roiPct: number;
  realizedPnlUsdt: number;
  closedAt?: string | null;
  modeLabel?: "Live" | "Demo";
  leverage?: number | null;
};

export type OpenPositionShareInput = {
  displaySymbol: string;
  direction: "long" | "short";
  entryPrice: number;
  markPrice: number;
  roiPct: number;
  unrealizedPnlUsdt: number;
  modeLabel?: "Live" | "Demo";
  leverage?: number | null;
};

export type ClosedTradeShareOptions = {
  showRealizedUsdt?: boolean;
};

type PremiumCardParams = {
  displaySymbol: string;
  direction: "long" | "short";
  roiPct: number;
  pnlUsdt: number;
  priceLeft: number;
  priceRight: number;
  priceLeftLabel: string;
  priceRightLabel: string;
  pnlUsdtLabel: string;
  statusBadge: "CLOSED" | "OPEN";
  leverage?: number | null;
  modeLabel?: "Live" | "Demo";
  sharedDate?: string;
  showUsdt?: boolean;
};

const W = 1080;
const H = 1080;
const GREEN = "#0ecb81";
const RED = "#f6465d";
const CYAN = "#00d4ff";
const AMBER = "#f59e0b";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Green arrow when win rate is healthy or PnL is positive; red when losses dominate. */
function analysisShareArrowUp(analysis: ClosedTradesAnalysis, showPnlDetails: boolean): boolean {
  if (analysis.totalTrades === 0) return true;
  const strongWinRate = analysis.winRatePct >= 50 || analysis.wins > analysis.losses;
  if (!showPnlDetails) return strongWinRate;
  return analysis.totalRealizedUsdt >= 0 || strongWinRate;
}

function drawGlowArrow(ctx: CanvasRenderingContext2D, profit: boolean) {
  const cx = W * 0.78;
  const cy = H * 0.48;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);
  const grad = ctx.createLinearGradient(-120, 0, 120, 0);
  grad.addColorStop(0, "rgba(255,255,255,0.05)");
  grad.addColorStop(0.5, profit ? "rgba(14,203,129,0.35)" : "rgba(246,70,93,0.3)");
  grad.addColorStop(1, profit ? GREEN : RED);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-90, 28);
  ctx.lineTo(40, 28);
  ctx.lineTo(40, 55);
  ctx.lineTo(110, 0);
  ctx.lineTo(40, -55);
  ctx.lineTo(40, -28);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = profit ? GREEN : RED;
  ctx.shadowBlur = 48;
  ctx.strokeStyle = profit ? "rgba(14,203,129,0.6)" : "rgba(246,70,93,0.5)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg: string
): number {
  ctx.font = "600 12px system-ui, sans-serif";
  const tw = ctx.measureText(text).width + 20;
  roundRect(ctx, x, y, tw, 24, 6);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.fillText(text, x + 10, y + 6);
  return tw + 8;
}

function drawPremiumPnlShareCard(params: PremiumCardParams): Promise<Blob> {
  const showUsdt = params.showUsdt !== false;
  const profit = params.roiPct >= 0;
  const accent = profit ? GREEN : RED;
  const sharedDate =
    params.sharedDate ??
    new Date().toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));

  const bg = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, W);
  bg.addColorStop(0, "#0a0e17");
  bg.addColorStop(0.55, "#05080f");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const sideGlow = ctx.createRadialGradient(W, H * 0.4, 0, W, H * 0.4, W * 0.7);
  sideGlow.addColorStop(0, profit ? "rgba(14,203,129,0.14)" : "rgba(246,70,93,0.12)");
  sideGlow.addColorStop(1, "transparent");
  ctx.fillStyle = sideGlow;
  ctx.fillRect(0, 0, W, H);

  drawGlowArrow(ctx, profit);

  const pad = 56;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("NovaStaris", pad, pad);

  let bx = pad + 168;
  bx += drawBadge(ctx, params.modeLabel ?? "Live", bx, pad + 4, "rgba(148,163,184,0.2)", "#cbd5e1");
  const statusColor =
    params.statusBadge === "OPEN" ? "rgba(245,158,11,0.25)" : profit ? "rgba(14,203,129,0.2)" : "rgba(246,70,93,0.2)";
  bx += drawBadge(ctx, params.statusBadge, bx, pad + 4, statusColor, params.statusBadge === "OPEN" ? AMBER : accent);

  ctx.textAlign = "right";
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Shared on ${sharedDate}`, W - pad, pad + 8);
  ctx.textAlign = "left";

  const symY = pad + 72;
  roundRect(ctx, pad, symY, 36, 36, 8);
  ctx.fillStyle = profit ? "rgba(14,203,129,0.25)" : "rgba(246,70,93,0.25)";
  ctx.fill();
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(params.direction === "long" ? "L" : "S", pad + 12, symY + 9);

  ctx.font = "700 52px system-ui, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(params.displaySymbol, pad + 48, symY - 4);

  let subX = pad + 48;
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillStyle = params.direction === "long" ? GREEN : RED;
  ctx.fillText(params.direction.toUpperCase(), subX, symY + 52);
  subX += ctx.measureText(params.direction.toUpperCase()).width + 12;
  if (params.leverage != null && params.leverage > 0) {
    subX += drawBadge(ctx, `${Math.round(params.leverage)}X`, subX, symY + 48, "rgba(148,163,184,0.18)", "#94a3b8");
  }

  const roiY = symY + 120;
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("ROI", pad, roiY);

  ctx.shadowColor = accent;
  ctx.shadowBlur = 32;
  ctx.font = "700 96px system-ui, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(`${params.roiPct >= 0 ? "+" : ""}${params.roiPct.toFixed(2)}%`, pad, roiY + 28);
  ctx.shadowBlur = 0;

  let priceY = roiY + 120;
  if (showUsdt) {
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    const usdtStr = `${params.pnlUsdt >= 0 ? "+" : ""}${params.pnlUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${params.pnlUsdtLabel}`;
    ctx.fillText(usdtStr, pad, roiY + 140);
    priceY = roiY + 200;
  }

  const colW = 220;
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(params.priceLeftLabel, pad, priceY);
  ctx.fillText(params.priceRightLabel, pad + colW, priceY);
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(formatPrice(params.priceLeft), pad, priceY + 26);
  ctx.fillText(formatPrice(params.priceRight), pad + colW, priceY + 26);

  ctx.fillStyle = "rgba(148,163,184,0.2)";
  ctx.fillRect(pad, H - pad - 64, W - 2 * pad, 1);
  ctx.textAlign = "center";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillStyle = "#f1f5f9";
  ctx.fillText("NovaStaris AI", W / 2, H - pad - 48);
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillStyle = CYAN;
  ctx.fillText("www.novastaris.ai", W / 2, H - pad - 22);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create image"))),
      "image/jpeg",
      0.95
    );
  });
}

export function drawClosedTradeShareCard(
  input: ClosedTradeShareInput,
  options?: ClosedTradeShareOptions
): Promise<Blob> {
  const sharedDate =
    input.closedAt != null && input.closedAt !== ""
      ? new Date(Number(input.closedAt)).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" })
      : undefined;
  return drawPremiumPnlShareCard({
    displaySymbol: input.displaySymbol,
    direction: input.direction,
    roiPct: input.roiPct,
    pnlUsdt: input.realizedPnlUsdt,
    priceLeft: input.openPrice,
    priceRight: input.closePrice,
    priceLeftLabel: "Open Price",
    priceRightLabel: "Close Price",
    pnlUsdtLabel: "USDT realized",
    statusBadge: "CLOSED",
    leverage: input.leverage,
    modeLabel: input.modeLabel,
    sharedDate,
    showUsdt: options?.showRealizedUsdt,
  });
}

export function drawOpenPositionShareCard(
  input: OpenPositionShareInput,
  options?: ClosedTradeShareOptions
): Promise<Blob> {
  return drawPremiumPnlShareCard({
    displaySymbol: input.displaySymbol,
    direction: input.direction,
    roiPct: input.roiPct,
    pnlUsdt: input.unrealizedPnlUsdt,
    priceLeft: input.entryPrice,
    priceRight: input.markPrice,
    priceLeftLabel: "Entry Price",
    priceRightLabel: "Mark Price",
    pnlUsdtLabel: "USDT unrealized",
    statusBadge: "OPEN",
    leverage: input.leverage,
    modeLabel: input.modeLabel,
    showUsdt: options?.showRealizedUsdt,
  });
}

export function drawClosedTradesSummaryCard(
  trades: ClosedTradeShareInput[],
  totalRealized: number,
  options?: ClosedTradeShareOptions & { periodLabel?: string }
): Promise<Blob> {
  const showUsdt = options?.showRealizedUsdt !== false;
  const items = trades.slice(0, 8);
  const profit = totalRealized >= 0;
  const H2 = 520 + items.length * 100;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));

  ctx.fillStyle = "#05080f";
  ctx.fillRect(0, 0, W, H2);

  const pad = 48;
  ctx.fillStyle = "#fff";
  ctx.font = "700 36px system-ui, sans-serif";
  ctx.fillText("NovaStaris — Closed PNL", pad, pad);
  ctx.font = "500 15px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  const sub = options?.periodLabel ? `${options.periodLabel} · ${new Date().toLocaleString()}` : new Date().toLocaleString();
  ctx.fillText(sub, pad, pad + 44);

  let y = pad + 88;
  for (const t of items) {
    const col = t.roiPct >= 0 ? GREEN : RED;
    roundRect(ctx, pad, y, W - 2 * pad, 88, 12);
    ctx.fillStyle = "rgba(15,23,42,0.8)";
    ctx.fill();
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(`${t.displaySymbol} ${t.direction.toUpperCase()}`, pad + 20, y + 18);
    ctx.textAlign = "right";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillStyle = col;
    ctx.fillText(`${t.roiPct >= 0 ? "+" : ""}${t.roiPct.toFixed(2)}%`, W - pad - 20, y + 14);
    if (showUsdt) {
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(
        `${t.realizedPnlUsdt >= 0 ? "+" : ""}${t.realizedPnlUsdt.toFixed(2)} USDT · ${formatPrice(t.openPrice)} → ${formatPrice(t.closePrice)}`,
        W - pad - 20,
        y + 48
      );
    } else {
      ctx.font = "600 14px system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${formatPrice(t.openPrice)} → ${formatPrice(t.closePrice)}`, W - pad - 20, y + 48);
    }
    ctx.textAlign = "left";
    y += 100;
  }

  y += 12;
  if (showUsdt) {
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.fillStyle = profit ? GREEN : RED;
    ctx.fillText(
      `Total realized: ${totalRealized >= 0 ? "+" : ""}${totalRealized.toFixed(2)} USDT`,
      pad,
      y
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed"))), "image/jpeg", 0.94);
  });
}

export async function downloadClosedTradeShareCard(
  input: ClosedTradeShareInput,
  filename?: string,
  options?: ClosedTradeShareOptions
) {
  const blob = await drawClosedTradeShareCard(input, options);
  const sym = input.displaySymbol.replace(/[^a-zA-Z0-9]/g, "_");
  downloadBlob(blob, filename ?? `NovaStaris_Closed_${sym}_${new Date().toISOString().slice(0, 10)}.jpg`);
}

export async function downloadOpenPositionShareCard(
  input: OpenPositionShareInput,
  filename?: string,
  options?: ClosedTradeShareOptions
) {
  const blob = await drawOpenPositionShareCard(input, options);
  const sym = input.displaySymbol.replace(/[^a-zA-Z0-9]/g, "_");
  downloadBlob(blob, filename ?? `NovaStaris_Open_${sym}_${new Date().toISOString().slice(0, 10)}.jpg`);
}

export type AnalysisShareCardOptions = {
  periodLabel: string;
  modeLabel?: "Live" | "Demo";
  /** When true, include total PNL, avg win, and avg loss on the card. */
  showPnlDetails: boolean;
};

export function drawAnalysisShareCard(
  analysis: ClosedTradesAnalysis,
  options: AnalysisShareCardOptions
): Promise<Blob> {
  const { periodLabel, modeLabel, showPnlDetails } = options;
  const profit = analysis.totalRealizedUsdt >= 0;
  const arrowUp = analysisShareArrowUp(analysis, showPnlDetails);
  const H2 = showPnlDetails ? 920 : 780;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));

  const bg = ctx.createLinearGradient(0, 0, W, H2);
  bg.addColorStop(0, "#05080f");
  bg.addColorStop(0.5, "#0a1220");
  bg.addColorStop(1, "#05080f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H2);

  const pad = 56;
  ctx.fillStyle = CYAN;
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText("NOVASTARIS AI", pad, pad + 8);
  ctx.fillStyle = "#fff";
  ctx.font = "700 42px system-ui, sans-serif";
  ctx.fillText("Trading results", pad, pad + 58);
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  const sub = [periodLabel, modeLabel, new Date().toLocaleDateString()].filter(Boolean).join(" · ");
  ctx.fillText(sub, pad, pad + 96);

  const statW = (W - 2 * pad - 36) / 4;
  const statY = pad + 140;
  const stats: { label: string; value: string; color: string }[] = [
    { label: "TRADES", value: String(analysis.totalTrades), color: "#f8fafc" },
    { label: "WINS", value: String(analysis.wins), color: GREEN },
    { label: "LOSSES", value: String(analysis.losses), color: RED },
    { label: "WIN RATE", value: `${analysis.winRatePct.toFixed(1)}%`, color: "#f8fafc" },
  ];
  stats.forEach((s, i) => {
    const x = pad + i * (statW + 12);
    roundRect(ctx, x, statY, statW, 120, 16);
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,212,255,0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(s.label, x + 20, statY + 32);
    ctx.font = "700 40px system-ui, sans-serif";
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, x + 20, statY + 88);
  });

  let y = statY + 160;
  if (showPnlDetails) {
    roundRect(ctx, pad, y, W - 2 * pad, 200, 20);
    ctx.fillStyle = "rgba(15,23,42,0.9)";
    ctx.fill();
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("PNL SUMMARY", pad + 28, y + 40);
    ctx.font = "700 36px system-ui, sans-serif";
    ctx.fillStyle = profit ? GREEN : RED;
    const sign = analysis.totalRealizedUsdt >= 0 ? "+" : "";
    ctx.fillText(`Total PNL  ${sign}${analysis.totalRealizedUsdt.toFixed(2)} USDT`, pad + 28, y + 92);
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    const avgParts: string[] = [];
    if (analysis.avgWinUsdt != null) avgParts.push(`Avg win +${analysis.avgWinUsdt.toFixed(2)} USDT`);
    if (analysis.avgLossUsdt != null) avgParts.push(`Avg loss ${analysis.avgLossUsdt.toFixed(2)} USDT`);
    if (avgParts.length) ctx.fillText(avgParts.join("   ·   "), pad + 28, y + 140);
    y += 230;
  }

  ctx.font = "500 15px system-ui, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("novastaris.ai", pad, H2 - pad);

  drawGlowArrow(ctx, arrowUp);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed"))), "image/jpeg", 0.94);
  });
}

export async function downloadClosedTradesSummaryCard(
  trades: ClosedTradeShareInput[],
  filename?: string,
  options?: ClosedTradeShareOptions & { periodLabel?: string; totalRealized?: number }
) {
  const total = options?.totalRealized ?? trades.reduce((s, t) => s + t.realizedPnlUsdt, 0);
  const blob = await drawClosedTradesSummaryCard(trades, total, options);
  downloadBlob(blob, filename ?? `NovaStaris_Closed_Summary_${new Date().toISOString().slice(0, 10)}.jpg`);
}
