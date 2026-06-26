export type ScalpPlanMarket = "crypto" | "forex";

export function scalpPlanPriceApi(market: ScalpPlanMarket): string {
  return market === "forex" ? "/api/nova-forex/scalp/price" : "/api/nova-scalp-agent/price";
}

export function scalpPlanFeedbackApi(market: ScalpPlanMarket): string {
  return market === "forex" ? "/api/nova-forex/scalp/feedback" : "/api/nova-scalp-agent/feedback";
}

export function scalpPlanWatchLabel(market: ScalpPlanMarket): string {
  return market === "forex" ? "Nova Forex Scalp" : "Nova Scalp";
}
