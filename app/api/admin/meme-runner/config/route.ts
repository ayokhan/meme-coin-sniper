import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/auth";
import { getMemeRunnerConfig, saveMemeRunnerConfig } from "@/lib/meme-runner/config";
import { defaultMemeRunnerConfig, parseMemeRunnerConfig } from "@/lib/meme-runner/defaults";
import { getLaunchpadsForChain } from "@/lib/meme-runner/launchpads";
import type { MemeRunnerChain } from "@/lib/meme-runner/types";

export const dynamic = "force-dynamic";

async function assertOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isOwnerEmail(session.user.email)) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "Owner only." }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

function parseChainParam(v: string | null): MemeRunnerChain {
  const c = (v || "sol").toLowerCase();
  if (c === "bsc" || c === "eth") return c;
  return "sol";
}

export async function GET(request: Request) {
  const auth = await assertOwner();
  if (!auth.ok) return auth.res;
  const chain = parseChainParam(new URL(request.url).searchParams.get("chain"));
  try {
    const config = await getMemeRunnerConfig(chain);
    return NextResponse.json({
      success: true,
      chain,
      config,
      defaults: defaultMemeRunnerConfig(chain),
      launchpads: getLaunchpadsForChain(chain).map((p) => ({
        id: p.id,
        label: p.label,
        defaultEnabled: p.defaultEnabled,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await assertOwner();
  if (!auth.ok) return auth.res;
  const chain = parseChainParam(new URL(request.url).searchParams.get("chain"));
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseMemeRunnerConfig(chain, body.config ?? body);
    const saved = await saveMemeRunnerConfig(chain, parsed);
    return NextResponse.json({ success: true, chain, config: saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
