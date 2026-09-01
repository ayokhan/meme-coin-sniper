import type { Session } from "next-auth";
import { prisma } from "@/lib/db";
import { executeGmgnSwap, type GmgnChain } from "@/lib/gmgn-client";
import { getGmgnVipBotConfigView, resolveUserGmgnCredentials } from "@/lib/gmgn-vip-bot-config";
import { resolveWalletForChain } from "@/lib/gmgn-vip-bot-rules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function executeGmgnVipBotSignal(
  userId: string,
  session: Session | null,
  signalId: string
): Promise<{ ok: true; orderId: string | null } | { ok: false; error: string }> {
  const config = await getGmgnVipBotConfigView(userId);
  const sig = await db.gmgnVipBotSignal.findFirst({ where: { id: signalId, userId } });
  if (!sig || !["pending", "approved"].includes(sig.status)) {
    return { ok: false, error: "Signal not found or already handled." };
  }

  const creds = await resolveUserGmgnCredentials(userId, session);
  const chain = sig.chain as GmgnChain;
  const fromAddress = resolveWalletForChain(chain, config.walletAddresses);

  if (!creds?.privateKey || !fromAddress) {
    const hint = !fromAddress
      ? `Add an EVM wallet (0x…) bound to GMGN for ${chain.toUpperCase()} trades.`
      : "GMGN private key required to sign swaps — add it in credentials or set GMGN_PRIVATE_KEY.";
    return { ok: false, error: hint };
  }

  const amountIn =
    chain === "sol"
      ? String(Math.max(0.01, config.maxTradeUsd / 150))
      : String(Math.max(0.001, config.maxTradeUsd / 600));

  try {
    const swap = await executeGmgnSwap({
      chain,
      creds,
      fromAddress,
      baseToken: sig.tokenAddress,
      amountIn,
      slippagePct: config.slippagePct,
    });
    const orderId =
      typeof (swap as { order_id?: string }).order_id === "string"
        ? (swap as { order_id: string }).order_id
        : null;
    await db.gmgnVipBotSignal.update({
      where: { id: signalId },
      data: { status: "executed", orderId, quoteJson: swap as object },
    });
    return { ok: true, orderId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Swap failed";
    await db.gmgnVipBotSignal.update({
      where: { id: signalId },
      data: { status: "failed", reason: msg },
    });
    return { ok: false, error: msg };
  }
}
