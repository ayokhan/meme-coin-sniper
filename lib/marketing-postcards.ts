/**
 * Owner/admin marketing postcards — VIP, Affiliate, Nova Pulse, Investor one-pager.
 * 1080×1080 for X, IG, WhatsApp, Telegram, LinkedIn.
 */
import { downloadBlob } from "@/lib/pnl-share";

export type MarketingPostcardId =
  | "vip-upgrade"
  | "affiliate"
  | "nova-pulse"
  | "investor-onepager"
  | "vip-strategy-session"
  | "play-store-usdc"
  | "nova-pro"
  | "nova-pro-story";

const NOVA_PRO_CAPTION = [
  "Introducing Nova Pro — VIP-level AI desks for focused traders.",
  "Every VIP AI desk with 7 AI runs + 5 Nova Pulse runs per day.",
  "$58/month by card, or $50 with USDC (save $8). 6 months: 1 free · 12 months: 2 free.",
  "",
  "Limited edition: the first 100 subscribers become Founding members and lock today's price.",
  "",
  "Claim your seat: https://novastaris.ai/subscribe?plan=pro",
  "Educational only — not financial advice.",
].join("\n");

type Spec = {
  assetPath: string;
  filePrefix: string;
  caption: string;
  joinUrl: string;
};

const SPECS: Record<MarketingPostcardId, Spec> = {
  "nova-pro": {
    assetPath: "/marketing/novastaris-nova-pro-postcard-premium.png",
    filePrefix: "NovaStaris_Nova_Pro",
    joinUrl: "https://novastaris.ai/subscribe?plan=pro",
    caption: NOVA_PRO_CAPTION,
  },
  "nova-pro-story": {
    assetPath: "/marketing/novastaris-nova-pro-story-premium.png",
    filePrefix: "NovaStaris_Nova_Pro_Story",
    joinUrl: "https://novastaris.ai/subscribe?plan=pro",
    caption: NOVA_PRO_CAPTION,
  },
  "vip-upgrade": {
    assetPath: "/marketing/novastaris-vip-upgrade-postcard-premium.png",
    filePrefix: "NovaStaris_VIP_Upgrade",
    joinUrl: "https://novastaris.ai/subscribe",
    caption: [
      "Ready for the full NovaStaris desk?",
      "VIP unlocks NovaForecast, NovaRadar, Forex Agent, bots, Polymarket & higher AI limits.",
      "",
      "See plans: https://novastaris.ai/subscribe",
      "Educational only — not financial advice.",
    ].join("\n"),
  },
  affiliate: {
    assetPath: "/marketing/novastaris-affiliate-postcard-premium.png",
    filePrefix: "NovaStaris_Affiliate",
    joinUrl: "https://novastaris.ai/affiliate",
    caption: [
      "NovaStaris Affiliate — invite friends. Earn 10%.",
      "When someone you refer subscribes to VIP, you earn 10% of the subscription fee.",
      "",
      "Get your link: https://novastaris.ai/affiliate",
      "Educational only — not financial advice.",
    ].join("\n"),
  },
  "nova-pulse": {
    assetPath: "/marketing/novastaris-nova-pulse-postcard-premium.png",
    filePrefix: "NovaStaris_Nova_Pulse",
    joinUrl: "https://novastaris.ai/?tab=nova-pulse",
    caption: [
      "Nova Pulse — trade ideas in minutes.",
      "AI scalp plans with handoff to NovaScalper. Futures & forex in one Pulse workspace.",
      "",
      "Open Nova Pulse: https://novastaris.ai/?tab=nova-pulse",
      "Educational only — not financial advice.",
    ].join("\n"),
  },
  "investor-onepager": {
    assetPath: "/marketing/novastaris-investor-onepager-postcard-premium.png",
    filePrefix: "NovaStaris_Investor_OnePager",
    joinUrl: "https://novastaris.ai",
    caption: [
      "NovaStaris — AI trading platform. Live product. Pre-scale on paid VIP.",
      "Built first: bots, Pulse, VIP desk + Blofin, Coinbase, TIOmarkets, Vantage.",
      "Next: distribution — partners & capital to turn product into subscribers.",
      "Non-custodial: AI on traders’ own exchange/broker accounts.",
      "",
      "Partnership & investment: novastaris.ai@gmail.com",
      "https://novastaris.ai",
    ].join("\n"),
  },
  "vip-strategy-session": {
    assetPath: "/marketing/novastaris-vip-strategy-session-postcard-premium.png",
    filePrefix: "NovaStaris_VIP_Strategy_Session",
    joinUrl: "https://novastaris.ai/subscribe",
    caption: [
      "VIP promo — includes $150 strategy session free with VIP (30 min with a NovaStaris coach).",
      "Book within 7 days of subscription. After your session, cancel within 3 days for a 100% refund if you’re not satisfied.",
      "See Payment Terms for details: https://novastaris.ai/payment-terms",
      "",
      "See plans: https://novastaris.ai/subscribe",
    ].join("\n"),
  },
  "play-store-usdc": {
    assetPath: "/marketing/novastaris-play-store-usdc-postcard-premium.png",
    filePrefix: "NovaStaris_Play_Store_USDC",
    joinUrl: "https://play.google.com/store/apps/details?id=ai.novastaris.app",
    caption: [
      "NovaStaris is live on Google Play.",
      "Download the Android app — or register free for a chance to win $250 USDC (draw by October 31).",
      "",
      "Google Play: https://play.google.com/store/apps/details?id=ai.novastaris.app",
      "Register: https://novastaris.ai/register",
      "Terms: https://novastaris.ai/promo-terms",
      "",
      "Follow: Instagram @Novastaris · TikTok @novastaris.ai · X @Novastaris",
      "https://www.instagram.com/novastaris/",
      "https://www.tiktok.com/@novastaris.ai",
      "https://x.com/Novastaris",
    ].join("\n"),
  },
};

async function loadAssetBlob(path: string): Promise<Blob> {
  const res = await fetch(path);
  if (!res.ok) throw new Error("Postcard asset not found.");
  return res.blob();
}

export function drawMarketingPostcard(id: MarketingPostcardId): Promise<Blob> {
  return loadAssetBlob(SPECS[id].assetPath);
}

export async function downloadMarketingPostcard(id: MarketingPostcardId, filename?: string) {
  const blob = await drawMarketingPostcard(id);
  const ext = blob.type.includes("png") ? "png" : "jpg";
  downloadBlob(
    blob,
    filename ?? `${SPECS[id].filePrefix}_${new Date().toISOString().slice(0, 10)}.${ext}`
  );
}

export function buildMarketingPostcardCaption(id: MarketingPostcardId): string {
  return SPECS[id].caption;
}

export function marketingPostcardJoinUrl(id: MarketingPostcardId): string {
  return SPECS[id].joinUrl;
}

export function marketingPostcardFilePrefix(id: MarketingPostcardId): string {
  return SPECS[id].filePrefix;
}

export function marketingPostcardAssetPath(id: MarketingPostcardId): string {
  return SPECS[id].assetPath;
}
