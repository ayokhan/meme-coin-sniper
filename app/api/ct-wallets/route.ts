import { NextResponse } from "next/server";
import { TRACKED_WALLETS } from "@/lib/config/ct-wallets";

export async function GET() {
  return NextResponse.json({
    success: true,
    wallets: TRACKED_WALLETS,
  });
}
