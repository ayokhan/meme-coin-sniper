import { NextResponse } from "next/server";
import { leverageDb } from "@/lib/leverage-db";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getTopTradersPositions } from "@/lib/api-clients/hyperliquid";
import { sendLeverageTradeAlert } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Cron-only: detect position changes for alert-enabled leverage wallets and send Telegram. */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.TELEGRAM_LEVERAGE_ALERTS);
    if (!enabled) {
      return NextResponse.json({ success: true, sent: 0, message: "Telegram leverage alerts disabled." });
    }

    const wallets = await leverageDb.leverageWallet.findMany({
      where: { active: true, alertEnabled: true },
      orderBy: { createdAt: "asc" },
    });
    if (wallets.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No alert-enabled wallets." });
    }

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
      if (prevJson !== null) {
        const wallet = wallets.find((w) => w.address.toLowerCase() === t.address.toLowerCase());
        const nickname = wallet?.nickname ?? t.nickname ?? null;
        const positionsSummary =
          (t.positions ?? []).length === 0
            ? "No open positions"
            : (t.positions ?? [])
                .map((p) => `${p.coin} ${p.side} $${Number(p.entryPx).toLocaleString(undefined, { maximumFractionDigits: 0 })}`)
                .join(" | ");
        await sendLeverageTradeAlert({ nickname, address: t.address, positionsSummary });
        await leverageDb.leverageAlert.create({
          data: { walletAddress: t.address, nickname: nickname ?? undefined, positionsSummary },
        });
        sent++;
        // Cap in-app alerts to last 100
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
      }
      await leverageDb.leverageWalletSnapshot.upsert({
        where: { walletAddress: t.address },
        create: { walletAddress: t.address, positionsJson },
        update: { positionsJson },
      });
    }

    return NextResponse.json({ success: true, sent, message: `${sent} leverage alert(s) sent.` });
  } catch (e) {
    console.error("Leverage wallet-tracker notify:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Notify failed." }, { status: 500 });
  }
}
