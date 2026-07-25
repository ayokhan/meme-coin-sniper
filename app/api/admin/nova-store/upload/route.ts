import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { authOptions, isOwnerEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** POST multipart — upload product image to Vercel Blob (owner only). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ success: false, error: "Expected multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return NextResponse.json({ success: false, error: "Missing file." }, { status: 400 });
  }
  const f = file as File;
  if (f.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: "Image must be under 8 MB." }, { status: 400 });
  }
  const type = f.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ success: false, error: "Use JPG, PNG, WebP, or GIF." }, { status: 400 });
  }

  const buf = Buffer.from(await f.arrayBuffer());
  const safeName = (f.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  try {
    const blob = await put(`nova-store/${Date.now()}-${safeName}`, buf, {
      access: "public",
      contentType: type,
    });
    return NextResponse.json({ success: true, url: blob.url });
  } catch (e) {
    console.error("Nova Store image upload:", e);
    return NextResponse.json(
      { success: false, error: "Upload failed. Ensure BLOB_READ_WRITE_TOKEN is set." },
      { status: 500 }
    );
  }
}
