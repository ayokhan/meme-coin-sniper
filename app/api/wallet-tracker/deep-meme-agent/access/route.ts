import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDeepMemeAgentAccess } from "@/lib/deep-meme-agent-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const access = await getDeepMemeAgentAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      {
        success: false,
        error: access.error,
        disabled: access.disabled === true,
        locked: access.locked === true,
      },
      { status: access.status },
    );
  }
  return NextResponse.json({ success: true, isOwner: access.isOwner });
}
