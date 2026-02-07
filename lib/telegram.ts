/**
 * Send messages to Telegram via Bot API.
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TELEGRAM_API = 'https://api.telegram.org/bot';

export type TokenForAlert = {
  symbol: string;
  name: string;
  contractAddress: string;
  viralScore: number;
  liquidity?: number | null;
  priceUSD?: number | null;
  pairAddress?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  website?: string | null;
};

export function isTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN && CHAT_ID);
}

/**
 * Send a plain text message to the configured Telegram chat.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('Telegram: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set');
    return false;
  }
  try {
    const res = await fetch(`${TELEGRAM_API}${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('Telegram sendMessage failed:', res.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Telegram sendMessage error:', e);
    return false;
  }
}

/**
 * Format and send a single token alert (HTML for Telegram).
 */
export async function sendTokenAlert(token: TokenForAlert): Promise<boolean> {
  const dexUrl = token.pairAddress
    ? `https://dexscreener.com/solana/${token.pairAddress}`
    : `https://dexscreener.com/solana/${token.contractAddress}`;
  const liq = token.liquidity != null ? `$${(token.liquidity / 1000).toFixed(1)}k` : '—';
  const price = token.priceUSD != null ? `$${token.priceUSD < 0.01 ? token.priceUSD.toExponential(2) : token.priceUSD.toFixed(6)}` : '—';

  const lines = [
    `🪙 <b>${escapeHtml(token.symbol)}</b> — ${escapeHtml(token.name)}`,
    `📊 Viral: <b>${token.viralScore}</b> · Liq: ${liq} · Price: ${price}`,
    `🔗 <a href="${dexUrl}">DexScreener</a>`,
  ];
  if (token.twitter) lines.push(`🐦 <a href="${token.twitter}">Twitter</a>`);
  if (token.telegram) lines.push(`✈️ <a href="${token.telegram}">Telegram</a>`);
  if (token.website) lines.push(`🌐 <a href="${token.website}">Website</a>`);

  const text = lines.join('\n');
  return sendTelegramMessage(text);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send alerts for multiple tokens (one message per token to avoid length limits).
 */
export async function sendTokenAlerts(tokens: TokenForAlert[]): Promise<void> {
  if (!isTelegramConfigured() || tokens.length === 0) return;
  for (const token of tokens) {
    await sendTokenAlert(token);
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Wallet Tracker alert: 3+ tracked wallets bought the same token. */
export type WalletAlertForTelegram = {
  contractAddress: string;
  symbol: string;
  name: string;
  buyerCount: number;
  buyers: Array<{ address: string; label?: string }>;
  liquidity?: number | null;
  priceUSD?: number | null;
};

/**
 * Format and send a single wallet-tracker alert to Telegram.
 */
export async function sendWalletAlert(alert: WalletAlertForTelegram): Promise<boolean> {
  const dexUrl = `https://dexscreener.com/solana/${alert.contractAddress}`;
  const gmgnUrl = `https://gmgn.ai/sol/token/${encodeURIComponent(alert.contractAddress)}`;
  const liq = alert.liquidity != null ? `$${(alert.liquidity / 1000).toFixed(1)}k` : '—';
  const price = alert.priceUSD != null ? `$${alert.priceUSD < 0.01 ? alert.priceUSD.toExponential(2) : alert.priceUSD.toFixed(6)}` : '—';
  const who = alert.buyers.map((b) => b.label || `${b.address.slice(0, 4)}…${b.address.slice(-4)}`).join(', ');

  const lines = [
    `🔔 <b>Wallet Tracker</b> — 3+ tracked wallets bought`,
    `🪙 <b>${escapeHtml(alert.symbol)}</b> — ${escapeHtml(alert.name)}`,
    `👥 <b>${alert.buyerCount}</b> buyers: ${escapeHtml(who)}`,
    `📊 Liq: ${liq} · Price: ${price}`,
    `🔗 <a href="${dexUrl}">DexScreener</a> · <a href="${gmgnUrl}">GMGN</a>`,
  ];

  const text = lines.join('\n');
  return sendTelegramMessage(text);
}

/**
 * Send wallet-tracker alerts to Telegram (one message per alert).
 */
export async function sendWalletAlerts(alerts: WalletAlertForTelegram[]): Promise<void> {
  if (!isTelegramConfigured() || alerts.length === 0) return;
  for (const alert of alerts) {
    await sendWalletAlert(alert);
    await new Promise((r) => setTimeout(r, 300));
  }
}
