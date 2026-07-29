import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setSiteAnnouncementBanner } from "@/lib/site-announcement-banner";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST — publish this session as the in-app site announcement. */
export async function POST(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const demo = await (
    prisma as unknown as {
      demoSession: {
        findUnique: (args: unknown) => Promise<{
          slug: string;
          title: string;
          description: string | null;
          sessionAt: Date | null;
          locationNote: string | null;
        } | null>;
      };
    }
  ).demoSession.findUnique({ where: { id } });

  if (!demo) {
    return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
  }

  const when = demo.sessionAt
    ? `\n\nDate: ${demo.sessionAt.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}`
    : "";
  const where = demo.locationNote ? `\n${demo.locationNote}` : "\nOnline demo session";
  const body = `${(demo.description || "Free live demo with NovaStaris.").trim()}${when}${where}\n\nRegister free — spots may be limited.`;

  const banner = await setSiteAnnouncementBanner({
    enabled: true,
    title: demo.title,
    body,
    ctaLabel: "Register for demo",
    ctaHref: `/demo/${demo.slug}`,
    showPartnerLogos: false,
  });

  return NextResponse.json({ success: true, banner });
}
