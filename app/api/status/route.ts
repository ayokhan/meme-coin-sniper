import { NextResponse } from "next/server";

type ServiceStatus = "ok" | "degraded" | "error" | "skip";

/**
 * GET /api/status
 * Lightweight health check for key APIs (DexScreener, Moralis).
 * Used by /status page so you can see when an integration is down.
 */
export async function GET() {
  const timeoutMs = 8000;
  const results: Array<{ name: string; status: ServiceStatus; message: string }> = [];

  // DexScreener
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("https://api.dexscreener.com/latest/dex/search?q=SOL", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(id);
    const data = await res.json().catch(() => ({}));
    const pairs = data?.pairs ?? [];
    const count = Array.isArray(pairs) ? pairs.length : 0;
    if (res.ok && count > 0) {
      results.push({ name: "DexScreener", status: "ok", message: `${count} pairs (sample OK)` });
    } else if (res.ok) {
      results.push({ name: "DexScreener", status: "degraded", message: "Response OK but no pairs" });
    } else {
      results.push({ name: "DexScreener", status: "error", message: `HTTP ${res.status}` });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    results.push({ name: "DexScreener", status: "error", message: msg });
  }

  // Moralis (only if key is set)
  if (process.env.MORALIS_API_KEY) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch("https://solana-gateway.moralis.io/token/mainnet/exchange/pumpfun/new?limit=1", {
        headers: {
          Accept: "application/json",
          "X-API-Key": process.env.MORALIS_API_KEY,
        },
        signal: controller.signal,
        next: { revalidate: 0 },
      });
      clearTimeout(id);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const list = data?.result ?? [];
        results.push({ name: "Moralis", status: "ok", message: Array.isArray(list) ? "API OK" : "Response OK" });
      } else {
        results.push({ name: "Moralis", status: res.status === 429 ? "degraded" : "error", message: `HTTP ${res.status}` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      results.push({ name: "Moralis", status: "error", message: msg });
    }
  } else {
    results.push({ name: "Moralis", status: "skip", message: "Not configured" });
  }

  return NextResponse.json({ success: true, services: results });
}
