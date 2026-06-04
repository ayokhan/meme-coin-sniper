import { NextResponse } from "next/server";
import { getTicker } from "@/lib/hyperliquid";
import { getBlofinMetalTicker } from "@/lib/blofin-metals";

export const dynamic = "force-dynamic";

type ServiceStatus = "ok" | "degraded" | "error";

export async function GET() {
  const timeoutMs = 8000;
  const services: Array<{ name: string; status: ServiceStatus; message: string }> = [];

  async function probe(
    name: string,
    fn: () => Promise<{ ok: boolean; message: string }>
  ) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const r = await fn();
      clearTimeout(t);
      services.push({ name, status: r.ok ? "ok" : "degraded", message: r.message });
    } catch (e) {
      services.push({
        name,
        status: "error",
        message: e instanceof Error ? e.message : "Unavailable",
      });
    }
  }

  await probe("Blofin (XAU)", async () => {
    const t = await getBlofinMetalTicker("XAU");
    const last = t?.last ? Number(t.last) : NaN;
    return Number.isFinite(last) && last > 0
      ? { ok: true, message: `Gold ~$${last.toFixed(0)}` }
      : { ok: false, message: "No XAU price" };
  });

  await probe("Hyperliquid (BTC)", async () => {
    const t = await getTicker("BTC");
    const last = t?.last ? Number(t.last) : NaN;
    return Number.isFinite(last) && last > 0
      ? { ok: true, message: `BTC ~$${last.toLocaleString()}` }
      : { ok: false, message: "No BTC price" };
  });

  await probe("DexScreener", async () => {
    const res = await fetch("https://api.dexscreener.com/latest/dex/search?q=SOL", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    const count = Array.isArray(data?.pairs) ? data.pairs.length : 0;
    return res.ok && count > 0
      ? { ok: true, message: "Meme data OK" }
      : { ok: false, message: `HTTP ${res.status}` };
  });

  const allOk = services.every((s) => s.status === "ok");
  const anyError = services.some((s) => s.status === "error");

  return NextResponse.json({
    success: true,
    overall: allOk ? "ok" : anyError ? "degraded" : "degraded",
    checkedAt: new Date().toISOString(),
    services,
  });
}
