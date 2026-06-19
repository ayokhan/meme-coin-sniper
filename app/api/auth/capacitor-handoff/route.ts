import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCapacitorAuthToken } from "@/lib/capacitor-auth-token";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  const token = createCapacitorAuthToken(session.user.id);
  return NextResponse.json({ success: true, token });
}
