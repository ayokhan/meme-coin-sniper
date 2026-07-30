import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatRebateReward,
  isRebateBrokerId,
  isRebateRewardType,
  isRebateStatus,
  rebateBrokerLabel,
} from "@/lib/forex-partner-rebates";

export const dynamic = "force-dynamic";

function rebateDb() {
  return prisma as unknown as {
    forexPartnerRebatePayout: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
      create: (args: unknown) => Promise<Record<string, unknown>>;
      update: (args: unknown) => Promise<Record<string, unknown>>;
      delete: (args: unknown) => Promise<unknown>;
    };
  };
}

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "Owner only." }, { status: 403 }) };
  }
  return { ok: true as const };
}

function serialize(row: Record<string, unknown>) {
  return {
    ...row,
    brokerLabel: rebateBrokerLabel(String(row.broker ?? "")),
    rewardLabel: formatRebateReward(String(row.rewardType ?? ""), Number(row.rewardValue) || 0),
    lotsTraded: row.lotsTraded != null ? Number(row.lotsTraded) : null,
    suggestedAmountUsd: row.suggestedAmountUsd != null ? Number(row.suggestedAmountUsd) : null,
    amountPaidUsd: row.amountPaidUsd != null ? Number(row.amountPaidUsd) : null,
    paidAt: row.paidAt instanceof Date ? row.paidAt.toISOString() : row.paidAt,
    createdAt: row.createdAt instanceof Date ? (row.createdAt as Date).toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? (row.updatedAt as Date).toISOString() : row.updatedAt,
  };
}

function parseOptionalNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function suggestedFromLots(rewardType: string, rewardValue: number, lotsTraded: number | null): number | null {
  if (rewardType !== "per_lot" || lotsTraded == null || lotsTraded < 0) return null;
  return Math.round(lotsTraded * rewardValue * 100) / 100;
}

/** GET — list rebate payouts (optional ?broker=&status=). */
export async function GET(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  const { searchParams } = new URL(request.url);
  const broker = searchParams.get("broker")?.trim();
  const status = searchParams.get("status")?.trim();

  const where: Record<string, unknown> = {};
  if (broker && isRebateBrokerId(broker)) where.broker = broker;
  if (status && isRebateStatus(status)) where.status = status;

  const rows = await rebateDb().forexPartnerRebatePayout.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
  });

  return NextResponse.json({
    success: true,
    payouts: rows.map(serialize),
  });
}

/** POST — create a rebate payout record. */
export async function POST(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const customerName = String(body.customerName ?? "").trim().slice(0, 120);
  if (!customerName) {
    return NextResponse.json({ success: false, error: "Customer name is required." }, { status: 400 });
  }
  if (!isRebateBrokerId(body.broker)) {
    return NextResponse.json({ success: false, error: "Select a broker." }, { status: 400 });
  }
  if (!isRebateRewardType(body.rewardType)) {
    return NextResponse.json({ success: false, error: "Select reward type (% / $ / per lot)." }, { status: 400 });
  }
  const rewardValue = Number(body.rewardValue);
  if (!Number.isFinite(rewardValue) || rewardValue < 0) {
    return NextResponse.json({ success: false, error: "Reward value must be a number ≥ 0." }, { status: 400 });
  }

  const status = isRebateStatus(body.status) ? body.status : "pending";
  const amountPaidUsd = parseOptionalNumber(body.amountPaidUsd);
  const lotsTraded = parseOptionalNumber(body.lotsTraded);
  const suggestedExplicit = parseOptionalNumber(body.suggestedAmountUsd);
  const suggestedAmountUsd =
    suggestedExplicit ?? suggestedFromLots(String(body.rewardType), rewardValue, lotsTraded);

  const row = await rebateDb().forexPartnerRebatePayout.create({
    data: {
      broker: body.broker,
      customerName,
      customerEmail: String(body.customerEmail ?? "").trim().toLowerCase().slice(0, 200) || null,
      userId: String(body.userId ?? "").trim().slice(0, 64) || null,
      rewardType: body.rewardType,
      rewardValue,
      lotsTraded,
      suggestedAmountUsd,
      amountPaidUsd,
      status,
      periodNote: String(body.periodNote ?? "").trim().slice(0, 200) || null,
      notes: String(body.notes ?? "").trim().slice(0, 4000) || null,
      paidAt: status === "paid" ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true, payout: serialize(row) });
}

/** PATCH — update payout (status, amounts, notes, etc.). Body must include id. */
export async function PATCH(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
  }

  const existing = await rebateDb().forexPartnerRebatePayout.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.customerName === "string") {
    const n = body.customerName.trim().slice(0, 120);
    if (!n) return NextResponse.json({ success: false, error: "Customer name is required." }, { status: 400 });
    data.customerName = n;
  }
  if ("customerEmail" in body) {
    data.customerEmail = String(body.customerEmail ?? "").trim().toLowerCase().slice(0, 200) || null;
  }
  if ("userId" in body) {
    data.userId = String(body.userId ?? "").trim().slice(0, 64) || null;
  }
  if (isRebateBrokerId(body.broker)) data.broker = body.broker;
  if (isRebateRewardType(body.rewardType)) data.rewardType = body.rewardType;
  if ("rewardValue" in body) {
    const rewardValue = Number(body.rewardValue);
    if (!Number.isFinite(rewardValue) || rewardValue < 0) {
      return NextResponse.json({ success: false, error: "Invalid reward value." }, { status: 400 });
    }
    data.rewardValue = rewardValue;
  }
  if ("amountPaidUsd" in body) {
    data.amountPaidUsd = parseOptionalNumber(body.amountPaidUsd);
  }
  if ("lotsTraded" in body) {
    data.lotsTraded = parseOptionalNumber(body.lotsTraded);
  }
  if ("suggestedAmountUsd" in body || "lotsTraded" in body || "rewardValue" in body || "rewardType" in body) {
    const rewardType = String(data.rewardType ?? existing.rewardType ?? "per_lot");
    const rewardValue = Number(data.rewardValue ?? existing.rewardValue ?? 2);
    const lots =
      "lotsTraded" in data ? (data.lotsTraded as number | null) : parseOptionalNumber(existing.lotsTraded);
    const explicit =
      "suggestedAmountUsd" in body ? parseOptionalNumber(body.suggestedAmountUsd) : parseOptionalNumber(existing.suggestedAmountUsd);
    data.suggestedAmountUsd = explicit ?? suggestedFromLots(rewardType, rewardValue, lots);
  }
  if ("periodNote" in body) {
    data.periodNote = String(body.periodNote ?? "").trim().slice(0, 200) || null;
  }
  if ("notes" in body) {
    data.notes = String(body.notes ?? "").trim().slice(0, 4000) || null;
  }
  if (isRebateStatus(body.status)) {
    data.status = body.status;
    if (body.status === "paid") {
      data.paidAt = existing.paidAt instanceof Date ? existing.paidAt : new Date();
      if (body.paidAt) {
        const d = new Date(String(body.paidAt));
        if (!Number.isNaN(d.getTime())) data.paidAt = d;
      }
      // If marking paid without amount, use suggested
      if (!("amountPaidUsd" in body) && (existing.amountPaidUsd == null || existing.amountPaidUsd === "")) {
        const suggested =
          (data.suggestedAmountUsd as number | null | undefined) ??
          parseOptionalNumber(existing.suggestedAmountUsd);
        if (suggested != null) data.amountPaidUsd = suggested;
      }
    } else {
      data.paidAt = null;
    }
  }

  const row = await rebateDb().forexPartnerRebatePayout.update({ where: { id }, data });
  return NextResponse.json({ success: true, payout: serialize(row) });
}

/** DELETE — remove a payout record. Body: { id } or ?id= */
export async function DELETE(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id")?.trim() || "";
  if (!id) {
    try {
      const body = await request.json();
      id = String(body.id ?? "").trim();
    } catch {
      /* ignore */
    }
  }
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
  }

  await rebateDb().forexPartnerRebatePayout.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
