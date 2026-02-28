import { NextResponse } from "next/server";
import { leverageDb } from "@/lib/leverage-db";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getTopTradersPositions } from "@/lib/api-clients/hyperliquid";
import { sendLeverageTradeAlert } from "@/lib/telegram";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WalletItem = { address: string; nickname: string | null; userId?: string };

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
    const positionsJson = JSON.stringify(
      (t.positions ?? []).map((p) => ({ coin: p.coin, side: p.side, szi: p.szi, entryPx: p.entryPx })).sort((a, b) => a.coin.localeCompare(b.coin))
    );
    const snapshot = await leverageDb.leverageWalletSnapshot.findUnique({ where: { walletAddress: t.address } });
    const prevJson = snapshot?.positionsJson ?? null;
    if (prevJson === positionsJson) {
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
    if (prevJson !== null && sendTelegram) {
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

    const userWallets = await prisma.userLeverageWallet.findMany({
      where: { alertEnabled: true },
      orderBy: { createdAt: "asc" },
    });
    const userList: WalletItem[] = userWallets.map((r) => ({
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
