import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  createDiscoveryCallCompletion,
  deleteDiscoveryCallCompletion,
  listDiscoveryCallCompletions,
  updateDiscoveryCallCompletion,
} from "@/lib/discovery-call-completions";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const completions = await listDiscoveryCallCompletions();
    return NextResponse.json({ success: true, completions });
  } catch (e) {
    console.error("admin discovery-completions GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      phone?: string;
      userId?: string;
      completedAt?: string;
      notes?: string;
    };
    const row = await createDiscoveryCallCompletion({
      name: body.name ?? "",
      email: body.email,
      phone: body.phone,
      userId: body.userId,
      completedAt: body.completedAt,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, completion: row });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      email?: string | null;
      phone?: string | null;
      userId?: string | null;
      completedAt?: string;
      notes?: string;
    };
    if (!body.id?.trim()) {
      return NextResponse.json({ success: false, error: "id required." }, { status: 400 });
    }
    const row = await updateDiscoveryCallCompletion(body.id.trim(), body);
    return NextResponse.json({ success: true, completion: row });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to update." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ success: false, error: "id required." }, { status: 400 });
    await deleteDiscoveryCallCompletion(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to delete." },
      { status: 400 }
    );
  }
}
