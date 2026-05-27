/**
 * Draw PNL report to a canvas and return as JPEG blob.
 * Blofin-aligned: USDT + ROE %, leverage badge, premium card layout.
 */

export type PnlImageItem = {
  name: string;
  side: string;
  /** Full line e.g. "-267.86 USDT (-26.23%)" — used when pnlUsdt omitted */
  pnlDisplay?: string;
  pnlUsdt?: number;
  pnlPct?: number | null;
  leverage?: number | null;
  marginMode?: string | null;
  entryPrice?: number | null;
  markPrice?: number | null;
};

export type PnlImageOptions = {
  title: string;
  subtitle?: string;
  items: PnlImageItem[];
  totalLabel: string;
  totalValue: number;
  dateLabel?: string;
  /** When false, cards show ROI % only (no USDT lines or total). Default true. */
  showUsdt?: boolean;
};

const W = 960;
const PAD = 44;
const ROW_HEIGHT = 108;
const TITLE_SIZE = 34;
const SUBTITLE_SIZE = 15;
const FOOTER_SIZE = 14;

const GREEN = "#0ecb81";
const RED = "#f6465d";
const CYAN = "#00d4ff";
const SLATE_LIGHT = "#f8fafc";
const SLATE_MUTED = "#94a3b8";
const SLATE_DIM = "#64748b";
const CARD_BG = "rgba(15, 23, 42, 0.65)";
const CARD_BORDER = "rgba(148, 163, 184, 0.18)";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWatermark(ctx: CanvasRenderingContext2D, h: number) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.font = "700 88px system-ui, sans-serif";
  ctx.fillStyle = CYAN;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NovaStaris", W / 2, h * 0.42);
  ctx.restore();
}

function formatUsdt(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
}

function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function drawPnlToJpegBlob(options: PnlImageOptions): Promise<Blob> {
  const { title, subtitle, items, totalLabel, totalValue, dateLabel, showUsdt = true } = options;
  const dateStr = dateLabel ?? new Date().toLocaleString();
  const itemCount = Math.min(items.length, 10);
  const isProfit = totalValue >= 0;
  const contentH = 100 + (subtitle ? 22 : 0) + 22 + itemCount * ROW_HEIGHT + 88 + 56;
  const H = Math.min(900, Math.max(520, contentH));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0f1a");
  bg.addColorStop(0.45, "#070b14");
  bg.addColorStop(1, "#030508");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, W * 0.9);
  glow.addColorStop(0, isProfit ? "rgba(0, 212, 255, 0.14)" : "rgba(246, 70, 93, 0.1)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 320);

  ctx.strokeStyle = isProfit ? "rgba(0, 212, 255, 0.45)" : "rgba(246, 70, 93, 0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, W - 2, H - 2, 16);
  ctx.stroke();

  drawWatermark(ctx, H);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  let y = PAD;

  ctx.fillStyle = CYAN;
  ctx.fillRect(PAD, y, 72, 4);
  y += 14;

  ctx.font = `700 ${TITLE_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = SLATE_LIGHT;
  ctx.fillText(title, PAD, y);
  y += TITLE_SIZE + 8;

  if (subtitle) {
    ctx.font = `500 ${SUBTITLE_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = SLATE_MUTED;
    ctx.fillText(subtitle, PAD, y);
    y += 22;
  }

  ctx.font = `500 ${SUBTITLE_SIZE - 1}px system-ui, sans-serif`;
  ctx.fillStyle = SLATE_DIM;
  ctx.fillText(dateStr, PAD, y);
  y += 28;

  for (let i = 0; i < itemCount; i++) {
    const item = items[i];
    const sideUpper = (item.side ?? "").toUpperCase();
    const pnlUsdt = item.pnlUsdt ?? 0;
    const hasUsdt = item.pnlUsdt != null;
    const itemProfit = hasUsdt ? pnlUsdt >= 0 : item.pnlDisplay?.startsWith("+") || item.pnlDisplay?.includes("(+");
    const color = itemProfit ? GREEN : RED;
    const cardY = y;
    const cardH = ROW_HEIGHT - 10;

    ctx.fillStyle = CARD_BG;
    roundRect(ctx, PAD, cardY, W - 2 * PAD, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = itemProfit ? "rgba(14, 203, 129, 0.25)" : "rgba(246, 70, 93, 0.22)";
    ctx.lineWidth = 1;
    roundRect(ctx, PAD, cardY, W - 2 * PAD, cardH, 12);
    ctx.stroke();

    const innerY = cardY + 14;
    ctx.font = `700 20px system-ui, sans-serif`;
    ctx.fillStyle = SLATE_LIGHT;
    ctx.fillText(item.name, PAD + 16, innerY);

    let pillX = PAD + 16;
    const pillY = innerY + 28;
    const pills: { label: string; bg: string; fg: string }[] = [
      { label: sideUpper === "LONG" || sideUpper === "BUY" ? "LONG" : "SHORT", bg: sideUpper === "LONG" || sideUpper === "BUY" ? "rgba(14,203,129,0.2)" : "rgba(246,70,93,0.2)", fg: sideUpper === "LONG" || sideUpper === "BUY" ? GREEN : RED },
    ];
    if (item.leverage != null && item.leverage > 0) {
      pills.push({ label: `${Math.round(item.leverage)}X`, bg: "rgba(148,163,184,0.15)", fg: SLATE_MUTED });
    }
    if (item.marginMode) {
      const mm = item.marginMode.charAt(0).toUpperCase() + item.marginMode.slice(1);
      pills.push({ label: mm, bg: "rgba(148,163,184,0.12)", fg: SLATE_DIM });
    }
    for (const pill of pills) {
      ctx.font = "600 11px system-ui, sans-serif";
      const tw = ctx.measureText(pill.label).width + 16;
      ctx.fillStyle = pill.bg;
      roundRect(ctx, pillX, pillY, tw, 20, 6);
      ctx.fill();
      ctx.fillStyle = pill.fg;
      ctx.fillText(pill.label, pillX + 8, pillY + 5);
      pillX += tw + 8;
    }

    if (item.entryPrice != null && item.markPrice != null && item.entryPrice > 0) {
      ctx.font = `500 12px system-ui, sans-serif`;
      ctx.fillStyle = SLATE_DIM;
      ctx.fillText(
        `Entry ${item.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} → Mark ${item.markPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        PAD + 16,
        pillY + 26
      );
    }

    ctx.textAlign = "right";
    if (item.pnlPct != null) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.font = `700 36px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(formatPct(item.pnlPct), W - PAD - 16, innerY - 2);
      ctx.shadowBlur = 0;
      if (showUsdt && hasUsdt) {
        ctx.font = `600 15px system-ui, sans-serif`;
        ctx.fillStyle = SLATE_MUTED;
        ctx.fillText(formatUsdt(pnlUsdt), W - PAD - 16, innerY + 38);
      }
    } else if (hasUsdt && showUsdt) {
      ctx.font = `700 28px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(formatUsdt(pnlUsdt), W - PAD - 16, innerY + 8);
    } else {
      ctx.font = `700 28px system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(item.pnlDisplay ?? "—", W - PAD - 16, innerY + 8);
    }
    ctx.textAlign = "left";
    y += ROW_HEIGHT;
  }

  y += 8;
  ctx.strokeStyle = CARD_BORDER;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 22;

  if (showUsdt) {
    const totalStr = `${totalLabel}: ${formatUsdt(totalValue)}`;
    ctx.font = `700 22px system-ui, sans-serif`;
    ctx.fillStyle = isProfit ? GREEN : RED;
    ctx.shadowColor = isProfit ? "rgba(0,212,255,0.4)" : "rgba(246,70,93,0.35)";
    ctx.shadowBlur = 12;
    ctx.fillText(totalStr, PAD, y);
    ctx.shadowBlur = 0;
    y += 36;
  }

  ctx.font = `600 ${FOOTER_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = isProfit ? GREEN : SLATE_MUTED;
  ctx.fillText(isProfit ? "Keep winning." : "Next trade.", PAD, y);

  ctx.fillStyle = CARD_BORDER;
  ctx.fillRect(0, H - 54, W, 1);
  ctx.textAlign = "center";
  ctx.font = `700 ${FOOTER_SIZE + 1}px system-ui, sans-serif`;
  ctx.fillStyle = SLATE_LIGHT;
  ctx.fillText("NovaStaris", W / 2, H - 40);
  ctx.fillStyle = CYAN;
  ctx.font = `600 ${FOOTER_SIZE}px system-ui, sans-serif`;
  ctx.fillText("www.novastaris.ai", W / 2, H - 22);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create image blob"))),
      "image/jpeg",
      0.94
    );
  });
}
