/**
 * Draw PNL report to a canvas and return as JPEG blob.
 * Shows: trade name, type (long/short), PNL% in large font. NovaStaris branding + www.novastaris.ai.
 * For use in browser only (TradingBotPanel).
 */

export type PnlImageItem = {
  name: string;
  side: string;
  pnlDisplay: string;
};

export type PnlImageOptions = {
  title: string;
  subtitle?: string;
  items: PnlImageItem[];
  totalLabel: string;
  totalValue: number;
  dateLabel?: string;
};

const W = 820;
const PAD = 32;
const LINE_HEIGHT = 22;
const TITLE_SIZE = 24;
const SUBTITLE_SIZE = 14;
const ROW_HEIGHT = 52;
const NAME_SIZE = 15;
const SIDE_SIZE = 12;
const PNL_SIZE = 28;
const FOOTER_SIZE = 13;
const BRAND_SIZE = 56;
const WATERMARK_OPACITY = 0.08;

const GREEN_PROFIT = "#22c55e";
const RED_LOSS = "#ef4444";
const CYAN_ACCENT = "#06b6d4";
const SLATE_LIGHT = "#e2e8f0";
const SLATE_MUTED = "#94a3b8";
const SLATE_DIM = "#64748b";

function drawWatermark(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = WATERMARK_OPACITY;
  ctx.font = `700 ${BRAND_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = CYAN_ACCENT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NovaStaris", W / 2, 200);
  ctx.restore();
}

export function drawPnlToJpegBlob(options: PnlImageOptions): Promise<Blob> {
  const { title, subtitle, items, totalLabel, totalValue, dateLabel } = options;
  const dateStr = dateLabel ?? new Date().toLocaleString();
  const itemCount = Math.min(items.length, 12);
  const isProfit = totalValue >= 0;
  const contentH = 60 + (subtitle ? LINE_HEIGHT : 0) + LINE_HEIGHT + itemCount * ROW_HEIGHT + 50 + 36;
  const H = Math.min(640, Math.max(440, contentH));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#1e293b");
  grad.addColorStop(0.4, "#0f172a");
  grad.addColorStop(0.8, "#020617");
  grad.addColorStop(1, "#0c1222");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createLinearGradient(0, 0, 0, 120);
  glow.addColorStop(0, "rgba(6, 182, 212, 0.06)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 120);

  ctx.strokeStyle = isProfit ? "rgba(6, 182, 212, 0.4)" : "rgba(239, 68, 68, 0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  drawWatermark(ctx);

  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let y = PAD + 8;

  ctx.font = `600 ${TITLE_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(title, PAD, y);
  y += TITLE_SIZE + 4;

  if (subtitle) {
    ctx.font = `400 ${SUBTITLE_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = SLATE_MUTED;
    ctx.fillText(subtitle, PAD, y);
    y += LINE_HEIGHT;
  }

  ctx.font = `400 ${SUBTITLE_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = SLATE_DIM;
  ctx.fillText(dateStr, PAD, y);
  y += LINE_HEIGHT + 14;

  for (let i = 0; i < itemCount; i++) {
    const item = items[i];
    const sideUpper = (item.side ?? "").toUpperCase();
    const isItemProfit = item.pnlDisplay.startsWith("+") || item.pnlDisplay.startsWith("$+") || (item.pnlDisplay.startsWith("$") && item.pnlDisplay.length > 1 && item.pnlDisplay[1] !== "-");
    const pnlColor = isItemProfit ? GREEN_PROFIT : RED_LOSS;

    ctx.font = `600 ${NAME_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = SLATE_LIGHT;
    ctx.fillText(item.name, PAD, y);

    ctx.font = `500 ${SIDE_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = sideUpper === "LONG" ? GREEN_PROFIT : RED_LOSS;
    ctx.fillText(sideUpper, PAD, y + NAME_SIZE + 4);

    ctx.font = `700 ${PNL_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = pnlColor;
    ctx.textAlign = "right";
    ctx.fillText(item.pnlDisplay, W - PAD, y + 4);
    ctx.textAlign = "left";

    y += ROW_HEIGHT;
  }

  y += 10;

  const totalStr = `${totalLabel}: ${totalValue >= 0 ? "+" : ""}${totalValue.toFixed(2)} USDT`;
  ctx.font = `700 ${NAME_SIZE + 2}px system-ui, sans-serif`;
  ctx.fillStyle = isProfit ? GREEN_PROFIT : RED_LOSS;
  ctx.fillText(totalStr, PAD, y);
  y += 28;

  ctx.font = `500 ${FOOTER_SIZE - 1}px system-ui, sans-serif`;
  if (isProfit) {
    ctx.fillStyle = GREEN_PROFIT;
    ctx.fillText("Keep winning.", PAD, y);
  } else {
    ctx.fillStyle = SLATE_MUTED;
    ctx.fillText("Next trade.", PAD, y);
  }
  y += 22;

  ctx.font = `600 ${FOOTER_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.fillText("NovaStaris", W / 2, H - PAD - 22);
  ctx.font = `500 ${FOOTER_SIZE - 1}px system-ui, sans-serif`;
  ctx.fillStyle = CYAN_ACCENT;
  ctx.fillText("www.novastaris.ai", W / 2, H - PAD - 6);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create image blob"));
      },
      "image/jpeg",
      0.92
    );
  });
}
