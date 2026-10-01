import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { getStrongRunnerConfig, updateStrongRunnerConfig, type StrongRunnerConfig } from "@/lib/strong-runners-store";

export const dynamic = "force-dynamic";

const NUMERIC_FIELDS: Array<[keyof StrongRunnerConfig, number]> = [
  ["vipDailyLimit", 0],
  ["minMarketCapUsd", 0],
  ["maxMarketCapUsd", 10_000],
  ["minLiquidityUsd", 0],
  ["minLiquidityRatio", 0],
  ["minVolume24hUsd", 0],
  ["minAgeHours", 0],
  ["minConvictionScore", 0],
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  return NextResponse.json({ success: true, config: await getStrongRunnerConfig() });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = (await request.json()) as Record<string, unknown>;
  const patch: Partial<StrongRunnerConfig> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  for (const [key, min] of NUMERIC_FIELDS) {
    const v = body[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      const n = Math.max(min, v);
      (patch as Record<string, number>)[key] = key === "vipDailyLimit" || key === "minConvictionScore" ? Math.round(n) : n;
    }
  }
  try {
    return NextResponse.json({ success: true, config: await updateStrongRunnerConfig(patch) });
  } catch (e) {
    console.error("strong-runners-config PATCH:", e);
    return NextResponse.json({ success: false, error: "Save failed." }, { status: 500 });
  }
}
