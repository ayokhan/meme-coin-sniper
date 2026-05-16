import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemeRunnerAccess } from "@/lib/meme-runner-access";
import { getMemeRunnerSolConfig } from "@/lib/meme-runner/config";
import { scanMemeRunnerSol } from "@/lib/meme-runner/scan-sol";
import type { MemeRunnerLane } from "@/lib/meme-runner/types";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseLane(v: string | null): MemeRunnerLane | "all" {
  if (v === "new" || v === "soon" || v === "migrated") return v;
  return "all";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getMemeRunnerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }
    const { searchParams } = new URL(request.url);
    const chain = (searchParams.get("chain") || "sol").toLowerCase();
    const lane = parseLane(searchParams.get("lane"));

    if (chain !== "sol") {
      return NextResponse.json({
        success: true,
        chain,
        lane,
        tokens: [],
        counts: { new: 0, soon: 0, migrated: 0, passed: 0 },
        message: `${chain.toUpperCase()} Meme Runner is coming soon. SOL is live.`,
      });
    }

    const [config, moralisOn] = await Promise.all([
      getMemeRunnerSolConfig(),
      getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_GO_HUNTING),
    ]);

    const allScanned = await scanMemeRunnerSol(config, "all", moralisOn);
    const tokens = lane === "all" ? allScanned : allScanned.filter((t) => t.lane === lane);
    const counts = {
      new: allScanned.filter((t) => t.lane === "new").length,
      soon: allScanned.filter((t) => t.lane === "soon").length,
      migrated: allScanned.filter((t) => t.lane === "migrated").length,
      passed: tokens.length,
    };

    return NextResponse.json({
      success: true,
      chain: "sol",
      lane,
      scannedAt: new Date().toISOString(),
      config,
      tokens,
      counts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scan failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
