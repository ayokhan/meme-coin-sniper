import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isTwoFactorGloballyEnabled, isUserTwoFactorActive } from "@/lib/two-factor";
import { getTwoFactorSecurityNudgeBannerForPublic } from "@/lib/two-factor-security-nudge-banner";

/** Whether the signed-in user should see the 2FA security modal. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ success: true, show: false });
  }

  try {
    if (!(await isTwoFactorGloballyEnabled())) {
      return NextResponse.json({ success: true, show: false });
    }

    const banner = await getTwoFactorSecurityNudgeBannerForPublic();
    if (!banner.enabled) {
      return NextResponse.json({ success: true, show: false, banner });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const u = user as { hashedPassword?: string | null; twoFactorMethod?: string | null } | null;
    if (!u?.hashedPassword || isUserTwoFactorActive(u)) {
      return NextResponse.json({ success: true, show: false, banner });
    }

    return NextResponse.json({
      success: true,
      show: true,
      banner: {
        enabled: banner.enabled,
        title: banner.title,
        body: banner.body,
        ctaLabel: banner.ctaLabel,
      },
    });
  } catch (e) {
    console.error("account two-factor-nudge GET:", e);
    return NextResponse.json({ success: false, error: "Failed to check 2FA nudge." }, { status: 500 });
  }
}
