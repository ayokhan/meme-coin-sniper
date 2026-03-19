import { NextResponse } from "next/server";
import { leverageDb } from "@/lib/leverage-db";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getLastFillTimeMs, getTopTradersPositions } from "@/lib/api-clients/hyperliquid";
import { sendLeverageTradeAlert } from "@/lib/telegram";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WalletItem = { address: string; nickname: string | null; userId?: string };
type SnapshotPayload = {
  positions: Array<{ coin: string; side: "long" | "short"; szi: string; entryPx: string; positionValue: string }>;
  lastFillTimeMs: number | null;
};

function toSnapshotPayload(positions: SnapshotPayload["positions"], lastFillTimeMs: number | null): SnapshotPayload {
  return { positions, lastFillTimeMs };
}

function parseSnapshot(raw: string | null | undefined): SnapshotPayload {
  if (!raw) return toSnapshotPayload([], null);
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      // Backward compatibility with old snapshots that stored only position arrays.
      const positions = parsed
        .filter((p): p is { coin: string; side: "long" | "short"; szi: string; entryPx?: string; positionValue?: string } => !!p && typeof p === "object")
        .map((p) => ({
          coin: p.coin,
          side: p.side,
          szi: p.szi,
          entryPx: p.entryPx ?? "0",
          positionValue: p.positionValue ?? "0",
        }));
      return toSnapshotPayload(positions, null);
    }
    if (parsed && typeof parsed === "object" && "positions" in parsed) {
      const obj = parsed as { positions?: SnapshotPayload["positions"]; lastFillTimeMs?: number | null };
      return toSnapshotPayload(Array.isArray(obj.positions) ? obj.positions : [], typeof obj.lastFillTimeMs === "number" ? obj.lastFillTimeMs : null);
    }
  } catch {
    // Ignore malformed historical snapshots.
  }
  return toSnapshotPayload([], null);
}

async function processWallets(
  wallets: WalletItem[],
  sendTelegram: boolean
): Promise<number> {
  if (wallets.length === 0) return 0;
  const tradersInput = wallets.map((r) => ({
    address: r.address,
    nickname: r.nickname,
    alertEnabled: true,
  }));
  const traders = await getTopTradersPositions(tradersInput);
  let sent = 0;
  for (const t of traders) {
    const positions = (t.positions ?? []).map((p) => ({ coin: p.coin, side: p.side, szi: p.szi, entryPx: p.entryPx, positionValue: p.positionValue })).sort((a, b) => a.coin.localeCompare(b.coin));
    const lastFillTimeMs = (await getLastFillTimeMs(t.address)) ?? null;
    const currentSnapshot = toSnapshotPayload(positions, lastFillTimeMs);
    const positionsJson = JSON.stringify(currentSnapshot);
    const snapshot = await leverageDb.leverageWalletSnapshot.findUnique({ where: { walletAddress: t.address } });
    const previousSnapshot = parseSnapshot(snapshot?.positionsJson ?? null);
    const prevJson = JSON.stringify(previousSnapshot);
    const currentJson = JSON.stringify(currentSnapshot);
    if (prevJson === currentJson) {
      await leverageDb.leverageWalletSnapshot.upsert({
        where: { walletAddress: t.address },
        create: { walletAddress: t.address, positionsJson },
        update: { positionsJson },
      });
      continue;
    }
    const hadNewTradeActivity =
      typeof currentSnapshot.lastFillTimeMs === "number" &&
      (!previousSnapshot.lastFillTimeMs || currentSnapshot.lastFillTimeMs > previousSnapshot.lastFillTimeMs);
    const hadPositionDelta = JSON.stringify(previousSnapshot.positions) !== JSON.stringify(currentSnapshot.positions);
    const shouldAlert = hadPositionDelta || hadNewTradeActivity;
    if (!shouldAlert) {
      await leverageDb.leverageWalletSnapshot.upsert({
        where: { walletAddress: t.address },
        create: { walletAddress: t.address, positionsJson },
        update: { positionsJson },
      });
      continue;
    }
    const wallet = wallets.find((w) => w.address.toLowerCase() === t.address.toLowerCase());
    const nickname = wallet?.nickname ?? t.nickname ?? null;
    const positionsSummary =
      (t.positions ?? []).length === 0
        ? "No open positions"
        : (t.positions ?? [])
            .map((p) => `${p.coin} ${p.side} $${Number(p.entryPx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
            .join(" | ");
    if (snapshot?.positionsJson != null && sendTelegram) {
      await sendLeverageTradeAlert({ nickname, address: t.address, positionsSummary });
      sent++;
    }
    await leverageDb.leverageAlert.create({
      data: {
        userId: wallet?.userId ?? null,
        walletAddress: t.address,
        nickname: nickname ?? undefined,
        positionsSummary,
      },
    });
    const total = await leverageDb.leverageAlert.count();
    if (total > 100) {
      const oldest = await leverageDb.leverageAlert.findMany({
        orderBy: { createdAt: "asc" },
        take: total - 100,
      });
      if (oldest.length > 0) {
        await leverageDb.leverageAlert.deleteMany({
          where: { id: { in: oldest.map((a) => a.id) } },
        });
      }
    }
    await leverageDb.leverageWalletSnapshot.upsert({
      where: { walletAddress: t.address },
      create: { walletAddress: t.address, positionsJson },
      update: { positionsJson },
    });
  }
  return sent;
}

/** Cron-only: detect position changes for admin + user leverage wallets; Telegram for admin only, in-app for all. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const telegramEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.TELEGRAM_LEVERAGE_ALERTS);
    const adminWallets = await leverageDb.leverageWallet.findMany({
      where: { active: true, alertEnabled: true },
      orderBy: { createdAt: "asc" },
    });
    const adminList: WalletItem[] = adminWallets.map((r) => ({ address: r.address, nickname: r.nickname }));
    let sent = await processWallets(adminList, !!telegramEnabled);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userWallets = await (prisma as any).userLeverageWallet.findMany({
      where: { alertEnabled: true },
      orderBy: { createdAt: "asc" },
    });
    const userList: WalletItem[] = userWallets.map((r: { address: string; nickname: string | null; userId: string }) => ({
      address: r.address,
      nickname: r.nickname,
      userId: r.userId,
    }));
    await processWallets(userList, false);

    return NextResponse.json({ success: true, sent, message: `${sent} Telegram leverage alert(s) sent; user wallets get in-app only.` });
  } catch (e) {
    console.error("Leverage wallet-tracker notify:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Notify failed." }, { status: 500 });
  }
}
