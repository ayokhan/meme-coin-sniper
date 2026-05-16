import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getMemeRunnerAccess } from "@/lib/meme-runner-access";
import { getMemeRunnerSolConfig } from "@/lib/meme-runner/config";
import { DEFAULT_MEME_RUNNER_SOL_CONFIG } from "@/lib/meme-runner/defaults";
import { getLaunchpad, MEME_RUNNER_LAUNCHPADS } from "@/lib/meme-runner/launchpads";
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
      launchpads: MEME_RUNNER_LAUNCHPADS.map((p) => ({ id: p.id, label: p.label })),
      enabledLaunchpadLabels: config.enabledLaunchpads
        .map((id) => getLaunchpad(id)?.label ?? id)
        .join(", "),
      researchNote:
        "Per-lane filters + admin-selected launchpads (default Pump, Bonk, Bags). Soon band targets ~$50k MC.",
      laneLegend: {
        new: "Early bonding-curve token (low MC on selected launchpad).",
        soon: "MC in Soon band on bonding launchpad (target ~$50k).",
        migrated: "Listed on Raydium, Orca, or Meteora after graduation.",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bootstrap failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
