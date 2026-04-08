import crypto from "crypto";
import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import { isOwnerEmail } from "@/lib/auth";
import { getPolymarketConfigForUser } from "@/lib/polymarket-user-config";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function signL2(secretB64: string, timestamp: string, method: string, requestPath: string, body = ""): string {
  const payload = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  const key = Buffer.from(secretB64, "base64");
  const sig = crypto.createHmac("sha256", key).update(payload).digest("base64");
  return sig.replace(/\+/g, "-").replace(/\//g, "_");
}

async function canUsePolymarket() {
  const { tier, userId, session } = await getSessionAndSubscription();
  const owner = isOwnerEmail(session?.user?.email ?? null);
  if (owner) return { allowed: true, userId };
  if (!userId || tier !== "vip") return { allowed: false, userId: null as string | null };
  const user = await (prisma as { user: { findUnique: (args: unknown) => Promise<{ polymarketBotOnDemand?: boolean } | null> } }).user.findUnique({
    where: { id: userId },
    select: { polymarketBotOnDemand: true },
  });
  return { allowed: !!user?.polymarketBotOnDemand, userId };
}

export async function POST(request: Request) {
  try {
    const { allowed, userId } = await canUsePolymarket();
    if (!allowed) {
      return NextResponse.json({ success: false, locked: true, error: "Nova Polymarket Bot access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");
    let address = String(body.address ?? "").trim();
    let apiKey = String(body.apiKey ?? "").trim();
    let passphrase = String(body.passphrase ?? "").trim();
    let secret = String(body.secret ?? "").trim();
    const useStored = body.useStored === true;

    if (useStored && userId) {
      const stored = await getPolymarketConfigForUser(userId);
      if (stored) {
        address = stored.address;
        apiKey = stored.apiKey;
        passphrase = stored.passphrase;
        secret = stored.secret;
      }
    }

    if (!address || !apiKey || !passphrase || !secret) {
      return NextResponse.json({ success: false, error: "Missing address/apiKey/passphrase/secret." }, { status: 400 });
    }

    if (action === "open_orders") {
      const path = `/data/orders?limit=50`;
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = signL2(secret, ts, "GET", path, "");
      const res = await fetch(`https://clob.polymarket.com${path}`, {
        method: "GET",
        headers: {
          POLY_ADDRESS: address,
          POLY_SIGNATURE: sig,
          POLY_TIMESTAMP: ts,
          POLY_API_KEY: apiKey,
          POLY_PASSPHRASE: passphrase,
        },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return NextResponse.json({ success: false, error: data?.error ?? `Open orders failed (${res.status})` }, { status: 400 });
      const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      return NextResponse.json({ success: true, orders: items });
    }

    if (action === "cancel_order") {
      const orderID = String(body.orderID ?? "").trim();
      if (!orderID) return NextResponse.json({ success: false, error: "orderID required." }, { status: 400 });
      const reqBody = JSON.stringify({ orderID });
      const path = "/order";
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = signL2(secret, ts, "DELETE", path, reqBody);
      const res = await fetch(`https://clob.polymarket.com${path}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          POLY_ADDRESS: address,
          POLY_SIGNATURE: sig,
          POLY_TIMESTAMP: ts,
          POLY_API_KEY: apiKey,
          POLY_PASSPHRASE: passphrase,
        },
        body: reqBody,
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return NextResponse.json({ success: false, error: data?.error ?? `Cancel failed (${res.status})` }, { status: 400 });
      return NextResponse.json({ success: true, result: data });
    }

    if (action === "cancel_all") {
      const path = `/data/orders?limit=200`;
      const tsList = String(Math.floor(Date.now() / 1000));
      const sigList = signL2(secret, tsList, "GET", path, "");
      const listRes = await fetch(`https://clob.polymarket.com${path}`, {
        method: "GET",
        headers: {
          POLY_ADDRESS: address,
          POLY_SIGNATURE: sigList,
          POLY_TIMESTAMP: tsList,
          POLY_API_KEY: apiKey,
          POLY_PASSPHRASE: passphrase,
        },
        cache: "no-store",
      });
      const listData = await listRes.json().catch(() => ({}));
      if (!listRes.ok) return NextResponse.json({ success: false, error: listData?.error ?? `Open orders failed (${listRes.status})` }, { status: 400 });
      const items = Array.isArray(listData?.data) ? listData.data : (Array.isArray(listData) ? listData : []);
      const ids: string[] = items.map((it: any) => String(it?.id ?? it?.orderID ?? "")).filter(Boolean);
      let cancelled = 0;
      for (const orderID of ids) {
        const reqBody = JSON.stringify({ orderID });
        const cancelPath = "/order";
        const ts = String(Math.floor(Date.now() / 1000));
        const sig = signL2(secret, ts, "DELETE", cancelPath, reqBody);
        const res = await fetch(`https://clob.polymarket.com${cancelPath}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            POLY_ADDRESS: address,
            POLY_SIGNATURE: sig,
            POLY_TIMESTAMP: ts,
            POLY_API_KEY: apiKey,
            POLY_PASSPHRASE: passphrase,
          },
          body: reqBody,
          cache: "no-store",
        });
        if (res.ok) cancelled += 1;
      }
      return NextResponse.json({ success: true, cancelled, total: ids.length });
    }

    return NextResponse.json({ success: false, error: "Unsupported action." }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Polymarket L2 proxy failed";
    console.error("polymarket/l2-proxy:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

