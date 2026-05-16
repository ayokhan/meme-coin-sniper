import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/auth";
import { getMemeRunnerSolConfig, saveMemeRunnerSolConfig } from "@/lib/meme-runner/config";
import { DEFAULT_MEME_RUNNER_SOL_CONFIG, parseMemeRunnerSolConfig } from "@/lib/meme-runner/defaults";

export const dynamic = "force-dynamic";

async function assertOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isOwnerEmail(session.user.email)) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "Owner only." }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function GET() {
  const auth = await assertOwner();
  if (!auth.ok) return auth.res;
  try {
    const config = await getMemeRunnerSolConfig();
    return NextResponse.json({ success: true, config, defaults: DEFAULT_MEME_RUNNER_SOL_CONFIG });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await assertOwner();
  if (!auth.ok) return auth.res;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseMemeRunnerSolConfig(body.config ?? body);
    const saved = await saveMemeRunnerSolConfig(parsed);
    return NextResponse.json({ success: true, config: saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save config";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
