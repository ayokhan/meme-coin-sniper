/**
 * Premium closed-trade PNL share card (social / CT), inspired by broker share cards.
 * Browser-only (canvas).
 */

export type ClosedTradeShareInput = {
  displaySymbol: string;
  direction: "long" | "short";
  openPrice: number;
  closePrice: number;
  roiPct: number;
  realizedPnlUsdt: number;
  closedAt?: string | null;
  modeLabel?: "Live" | "Demo";
};

const W = 1080;
const H = 1080;
const GREEN = "#0ecb81";
const RED = "#f6465d";
const CYAN = "#00d4ff";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

export function drawClosedTradeShareCard(input: ClosedTradeShareInput): Promise<Blob> {
  const profit = input.roiPct >= 0;
  const accent = profit ? GREEN : RED;
  const sharedDate =
    input.closedAt != null && input.closedAt !== ""
      ? new Date(Number(input.closedAt)).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });

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
  sideGlow.addColorStop(0, profit ? "rgba(14,203,129,0.12)" : "rgba(246,70,93,0.1)");
  sideGlow.addColorStop(1, "transparent");
  ctx.fillStyle = sideGlow;
  ctx.fillRect(0, 0, W, H);

  drawGlowArrow(ctx, profit);

  const pad = 56;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Brand row
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("NovaStaris", pad, pad);

  const mode = input.modeLabel ?? "Live";
  const badgeW = ctx.measureText(mode).width + 24;
  roundRect(ctx, pad + 168, pad + 4, badgeW, 28, 8);
  ctx.fillStyle = "rgba(148,163,184,0.2)";
  ctx.fill();
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(mode, pad + 180, pad + 10);

  ctx.textAlign = "right";
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Shared on ${sharedDate}`, W - pad, pad + 8);
  ctx.textAlign = "left";

  // Symbol + direction
  const symY = pad + 72;
  roundRect(ctx, pad, symY, 36, 36, 8);
  ctx.fillStyle = profit ? "rgba(14,203,129,0.25)" : "rgba(246,70,93,0.25)";
  ctx.fill();
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillStyle = accent;
  ctx.fillText(input.direction === "long" ? "L" : "S", pad + 12, symY + 9);

  ctx.font = "700 52px system-ui, sans-serif";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(input.displaySymbol, pad + 48, symY - 4);

  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillStyle = input.direction === "long" ? GREEN : RED;
  ctx.fillText(input.direction.toUpperCase(), pad + 48, symY + 52);

  // ROI hero
  const roiY = symY + 120;
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("ROI", pad, roiY);

  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.font = "700 96px system-ui, sans-serif";
  ctx.fillStyle = accent;
  const roiStr = `${input.roiPct >= 0 ? "+" : ""}${input.roiPct.toFixed(2)}%`;
  ctx.fillText(roiStr, pad, roiY + 28);
  ctx.shadowBlur = 0;

  // Realized USDT
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillStyle = "#94a3b8";
  const usdtStr = `${input.realizedPnlUsdt >= 0 ? "+" : ""}${input.realizedPnlUsdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT realized`;
  ctx.fillText(usdtStr, pad, roiY + 140);

  // Prices
  const priceY = roiY + 200;
  const colW = 220;
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Open Price", pad, priceY);
  ctx.fillText("Close Price", pad + colW, priceY);
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(formatPrice(input.openPrice), pad, priceY + 26);
  ctx.fillText(formatPrice(input.closePrice), pad + colW, priceY + 26);

  // Footer
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

/** Summary card for multiple closed trades. */
export function drawClosedTradesSummaryCard(
  trades: ClosedTradeShareInput[],
  totalRealized: number
): Promise<Blob> {
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
  ctx.fillText(new Date().toLocaleString(), pad, pad + 44);

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
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(
      `${t.realizedPnlUsdt >= 0 ? "+" : ""}${t.realizedPnlUsdt.toFixed(2)} USDT · ${formatPrice(t.openPrice)} → ${formatPrice(t.closePrice)}`,
      W - pad - 20,
      y + 48
    );
    ctx.textAlign = "left";
    y += 100;
  }

  y += 12;
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.fillStyle = profit ? GREEN : RED;
  ctx.fillText(
    `Total realized: ${totalRealized >= 0 ? "+" : ""}${totalRealized.toFixed(2)} USDT`,
    pad,
    y
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed"))), "image/jpeg", 0.94);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadClosedTradeShareCard(input: ClosedTradeShareInput, filename?: string) {
  const blob = await drawClosedTradeShareCard(input);
  const sym = input.displaySymbol.replace(/[^a-zA-Z0-9]/g, "_");
  downloadBlob(blob, filename ?? `NovaStaris_Closed_${sym}_${new Date().toISOString().slice(0, 10)}.jpg`);
}

export async function downloadClosedTradesSummaryCard(trades: ClosedTradeShareInput[], filename?: string) {
  const total = trades.reduce((s, t) => s + t.realizedPnlUsdt, 0);
  const blob = await drawClosedTradesSummaryCard(trades, total);
  downloadBlob(blob, filename ?? `NovaStaris_Closed_Summary_${new Date().toISOString().slice(0, 10)}.jpg`);
}
