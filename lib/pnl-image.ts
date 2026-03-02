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

const W = 900;
const PAD = 40;
const LINE_HEIGHT = 24;
const TITLE_SIZE = 32;
const SUBTITLE_SIZE = 15;
const ROW_HEIGHT = 58;
const NAME_SIZE = 17;
const SIDE_SIZE = 13;
const PNL_SIZE = 34;
const FOOTER_SIZE = 14;
const BRAND_SIZE = 64;
const WATERMARK_OPACITY = 0.06;
const ACCENT_LINE_HEIGHT = 3;

const GREEN_PROFIT = "#22c55e";
const RED_LOSS = "#ef4444";
const CYAN_ACCENT = "#06b6d4";
const CYAN_GLOW = "rgba(6, 182, 212, 0.35)";
const SLATE_LIGHT = "#f1f5f9";
const SLATE_MUTED = "#94a3b8";
const SLATE_DIM = "#64748b";
const BORDER_SUBTLE = "rgba(148, 163, 184, 0.12)";

function drawWatermark(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = WATERMARK_OPACITY;
  ctx.font = `700 ${BRAND_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = CYAN_ACCENT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NovaStaris", W / 2, 220);
  ctx.restore();
}

export function drawPnlToJpegBlob(options: PnlImageOptions): Promise<Blob> {
  const { title, subtitle, items, totalLabel, totalValue, dateLabel } = options;
  const dateStr = dateLabel ?? new Date().toLocaleString();
  const itemCount = Math.min(items.length, 12);
  const isProfit = totalValue >= 0;
  const contentH = 80 + (subtitle ? LINE_HEIGHT : 0) + LINE_HEIGHT + itemCount * ROW_HEIGHT + 60 + 44;
  const H = Math.min(720, Math.max(500, contentH));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));

  // Background gradient — deeper and richer
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(0.35, "#0c1222");
  grad.addColorStop(0.7, "#020617");
  grad.addColorStop(1, "#030712");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top glow — stronger and wider
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.8);
  glow.addColorStop(0, isProfit ? "rgba(6, 182, 212, 0.12)" : "rgba(239, 68, 68, 0.06)");
  glow.addColorStop(0.5, "rgba(6, 182, 212, 0.04)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 280);

  // Accent line under header
  ctx.fillStyle = isProfit ? CYAN_ACCENT : RED_LOSS;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(PAD, 0, 120, ACCENT_LINE_HEIGHT);
  ctx.globalAlpha = 1;

  // Border — gradient stroke for premium look
  const borderGrad = ctx.createLinearGradient(0, 0, W, H);
  borderGrad.addColorStop(0, isProfit ? "rgba(6, 182, 212, 0.5)" : "rgba(239, 68, 68, 0.3)");
  borderGrad.addColorStop(0.5, "rgba(148, 163, 184, 0.15)");
  borderGrad.addColorStop(1, isProfit ? "rgba(6, 182, 212, 0.25)" : "rgba(239, 68, 68, 0.2)");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  drawWatermark(ctx);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let y = PAD + 12;

  // Title — bolder, larger
  ctx.font = `700 ${TITLE_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = SLATE_LIGHT;
  ctx.fillText(title, PAD, y);
  y += TITLE_SIZE + 6;

  if (subtitle) {
    ctx.font = `500 ${SUBTITLE_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = SLATE_MUTED;
    ctx.fillText(subtitle, PAD, y);
    y += LINE_HEIGHT;
  }

  ctx.font = `500 ${SUBTITLE_SIZE - 1}px system-ui, sans-serif`;
  ctx.fillStyle = SLATE_DIM;
  ctx.fillText(dateStr, PAD, y);
  y += LINE_HEIGHT + 18;

  // Divider line before rows
  ctx.strokeStyle = BORDER_SUBTLE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 16;

  for (let i = 0; i < itemCount; i++) {
    const item = items[i];
    const sideUpper = (item.side ?? "").toUpperCase();
    const isItemProfit = item.pnlDisplay.startsWith("+") || item.pnlDisplay.startsWith("$+") || (item.pnlDisplay.startsWith("$") && item.pnlDisplay.length > 1 && item.pnlDisplay[1] !== "-");
    const pnlColor = isItemProfit ? GREEN_PROFIT : RED_LOSS;

    // Row background (very subtle)
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent";
    ctx.fillRect(PAD, y - 4, W - 2 * PAD, ROW_HEIGHT - 2);

    ctx.font = `600 ${NAME_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = SLATE_LIGHT;
    ctx.fillText(item.name, PAD, y);

    ctx.font = `600 ${SIDE_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = sideUpper === "LONG" ? GREEN_PROFIT : RED_LOSS;
    ctx.fillText(sideUpper, PAD, y + NAME_SIZE + 6);

    // PNL with subtle glow on profit/loss
    if (isItemProfit) {
      ctx.shadowColor = GREEN_PROFIT;
      ctx.shadowBlur = 12;
    } else {
      ctx.shadowColor = RED_LOSS;
      ctx.shadowBlur = 8;
    }
    ctx.font = `700 ${PNL_SIZE}px system-ui, sans-serif`;
    ctx.fillStyle = pnlColor;
    ctx.textAlign = "right";
    ctx.fillText(item.pnlDisplay, W - PAD, y + 6);
    ctx.textAlign = "left";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    y += ROW_HEIGHT;
  }

  y += 14;

  // Divider before total
  ctx.strokeStyle = BORDER_SUBTLE;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 20;

  const totalStr = `${totalLabel}: ${totalValue >= 0 ? "+" : ""}${totalValue.toFixed(2)} USDT`;
  ctx.font = `700 ${NAME_SIZE + 4}px system-ui, sans-serif`;
  ctx.fillStyle = isProfit ? GREEN_PROFIT : RED_LOSS;
  if (isProfit) {
    ctx.shadowColor = CYAN_GLOW;
    ctx.shadowBlur = 16;
  }
  ctx.fillText(totalStr, PAD, y);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  y += 34;

  ctx.font = `600 ${FOOTER_SIZE}px system-ui, sans-serif`;
  if (isProfit) {
    ctx.fillStyle = GREEN_PROFIT;
    ctx.fillText("Keep winning.", PAD, y);
  } else {
    ctx.fillStyle = SLATE_MUTED;
    ctx.fillText("Next trade.", PAD, y);
  }
  y += 28;

  // Footer bar
  ctx.fillStyle = BORDER_SUBTLE;
  ctx.fillRect(0, H - 52, W, 1);
  ctx.font = `600 ${FOOTER_SIZE}px system-ui, sans-serif`;
  ctx.fillStyle = SLATE_LIGHT;
  ctx.textAlign = "center";
  ctx.fillText("NovaStaris", W / 2, H - PAD - 26);
  ctx.font = `600 ${FOOTER_SIZE - 1}px system-ui, sans-serif`;
  ctx.fillStyle = CYAN_ACCENT;
  ctx.fillText("www.novastaris.ai", W / 2, H - PAD - 8);
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
