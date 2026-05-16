import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getMemeRunnerAccess } from "@/lib/meme-runner-access";
import { getMemeRunnerSolConfig } from "@/lib/meme-runner/config";
import { DEFAULT_MEME_RUNNER_SOL_CONFIG } from "@/lib/meme-runner/defaults";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getMemeRunnerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }
    const [config, moralisGoHunting] = await Promise.all([
      getMemeRunnerSolConfig(),
      getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_GO_HUNTING),
    ]);
    const isCoachUser = (session?.user as { isCoachUser?: boolean })?.isCoachUser === true;
    return NextResponse.json({
      success: true,
      enabled: true,
      isOwner: isOwnerSession(session),
      isCoachUser,
      canShareCoach: isOwnerSession(session) || isCoachUser,
      chains: { sol: true, bsc: false, eth: false },
      config,
      defaults: DEFAULT_MEME_RUNNER_SOL_CONFIG,
      moralisGoHunting,
      researchNote:
        "Defaults mirror Padre Trenches: ≥45m age, ≥2 SOL est. fees, ~$50k MC band pre pump.fun graduation (~$69k).",
      laneLegend: {
        new: "pump.fun token with market cap below laneNewMaxMcapUsd (early curve).",
        soon: "pump.fun token with MC between laneSoonMinMcapUsd and laneSoonMaxMcapUsd (target ~$50k band).",
        migrated: "Listed on Raydium, Orca, or Meteora (post pump.fun migration).",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bootstrap failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
