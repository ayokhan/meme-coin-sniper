/**
 * Owner/admin marketing postcards — VIP, Affiliate, Nova Pulse, Investor one-pager.
 * 1080×1080 for X, IG, WhatsApp, Telegram, LinkedIn.
 */
import { downloadBlob } from "@/lib/pnl-share";

export type MarketingPostcardId = "vip-upgrade" | "affiliate" | "nova-pulse" | "investor-onepager";

type Spec = {
  assetPath: string;
  filePrefix: string;
  caption: string;
  joinUrl: string;
};

const SPECS: Record<MarketingPostcardId, Spec> = {
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
