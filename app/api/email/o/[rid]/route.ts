import { studioDb } from "@/lib/email-studio-db";

export const dynamic = "force-dynamic";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Email Studio open pixel. Apple Mail prefetches images, so opens are an upper bound. */
export async function GET(_request: Request, { params }: { params: Promise<{ rid: string }> }) {
  const { rid } = await params;
  if (rid) {
    await studioDb()
      .emailStudioRecipient
      .updateMany({ where: { id: rid, openedAt: null }, data: { openedAt: new Date() } })
      .catch(() => null);
  }
  return new Response(new Uint8Array(PIXEL), {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Length": String(PIXEL.length),
    },
  });
}
