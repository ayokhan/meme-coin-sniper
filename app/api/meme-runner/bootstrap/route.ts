import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getMemeRunnerAccess } from "@/lib/meme-runner-access";
import { getChainMeta } from "@/lib/meme-runner/chain-meta";
import { getMemeRunnerConfig } from "@/lib/meme-runner/config";
import {
  DEFAULT_MEME_RUNNER_BSC_CONFIG,
  DEFAULT_MEME_RUNNER_ETH_CONFIG,
  DEFAULT_MEME_RUNNER_SOL_CONFIG,
} from "@/lib/meme-runner/defaults";
import { getLaunchpad, getLaunchpadsForChain } from "@/lib/meme-runner/launchpads";
import type { MemeRunnerChain } from "@/lib/meme-runner/types";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

function launchpadLabels(chain: MemeRunnerChain, enabledIds: string[]): string {
  return enabledIds.map((id) => getLaunchpad(chain, id)?.label ?? id).join(", ");
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
    const chainParam = (searchParams.get("chain") || "sol").toLowerCase();
    const chain: MemeRunnerChain =
      chainParam === "bsc" || chainParam === "eth" ? chainParam : "sol";

    const [config, moralisGoHunting, solConfig, bscConfig, ethConfig] = await Promise.all([
      getMemeRunnerConfig(chain),
      getFeatureFlag(FEATURE_FLAG_KEYS.MORALIS_GO_HUNTING),
      getMemeRunnerConfig("sol"),
      getMemeRunnerConfig("bsc"),
      getMemeRunnerConfig("eth"),
    ]);
    const meta = getChainMeta(chain);
    const isCoachUser = (session?.user as { isCoachUser?: boolean })?.isCoachUser === true;
    return NextResponse.json({
      success: true,
      enabled: true,
      isOwner: isOwnerSession(session),
      isCoachUser,
      canShareCoach: isOwnerSession(session) || isCoachUser,
      chain,
      chains: { sol: true, bsc: true, eth: true },
      config,
      configs: { sol: solConfig, bsc: bscConfig, eth: ethConfig },
      defaults: {
        sol: DEFAULT_MEME_RUNNER_SOL_CONFIG,
        bsc: DEFAULT_MEME_RUNNER_BSC_CONFIG,
        eth: DEFAULT_MEME_RUNNER_ETH_CONFIG,
      },
      moralisGoHunting,
      nativeSymbol: meta.nativeSymbol,
      launchpads: getLaunchpadsForChain(chain).map((p) => ({
        id: p.id,
        label: p.label,
        defaultEnabled: p.defaultEnabled,
      })),
      enabledLaunchpadLabels: launchpadLabels(chain, config.enabledLaunchpads),
      laneLegend: {
        new: "Early bonding-curve token (low MC on selected launchpad).",
        soon: "MC in Soon band on bonding launchpad (target ~$50k).",
        migrated: `Listed on ${meta.migratedPoolsLabel} after graduation.`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bootstrap failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
