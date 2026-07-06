import { NextResponse } from "next/server";

export type PublicServiceStatus = "ok" | "degraded" | "error";

/**
 * GET /api/status/public
 * Lightweight health for all users (no auth). Cached briefly.
 */
export async function GET() {
  const timeoutMs = 6000;
  let worst: PublicServiceStatus = "ok";
  let detail = "";

  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("https://api.dexscreener.com/latest/dex/search?q=SOL", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(id);
    const data = await res.json().catch(() => ({}));
    const pairs = data?.pairs ?? [];
    const count = Array.isArray(pairs) ? pairs.length : 0;
    if (!res.ok) {
      worst = "error";
      detail = "Market data API unavailable";
    } else if (count === 0) {
      worst = "degraded";
      detail = "Market data responding slowly";
    }
  } catch {
    worst = "error";
    detail = "Market data API unreachable";
  }

  const status = worst === "ok" ? "operational" : worst === "degraded" ? "degraded" : "outage";

  return NextResponse.json(
    {
      success: true,
      status,
      message: detail || undefined,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
