import type { Session } from "next-auth";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getSubscriptionTier } from "@/lib/subscription";
import {
  countPnlCalculatorUsesToday,
  getPnlCalculatorConfig,
  getPnlCalculatorUserLimit,
  resolvePnlCalculatorDailyLimit,
} from "@/lib/pnl-calculator-quota";

export type PnlCalculatorAccess =
  | {
      ok: true;
      userId: string;
      isOwner: boolean;
      isVip: boolean;
      unlimited: boolean;
      used: number;
      limit: number | null;
      remaining: number | null;
    }
  | { ok: false; status: number; error: string; locked?: boolean; disabled?: boolean; needsSignIn?: boolean };

export async function getPnlCalculatorAccess(
  session: Session | null,
  opts?: { isOwner?: boolean }
): Promise<PnlCalculatorAccess> {
  const masterOn = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_PULSE_PNL_CALCULATOR);
  if (!masterOn) {
    return {
      ok: false,
      status: 403,
      error: "PnL Calculator is not available right now.",
      disabled: true,
      locked: true,
    };
  }

  const config = await getPnlCalculatorConfig();
  const isOwner = !!opts?.isOwner;

  if (!config.enabled && !isOwner) {
    return {
      ok: false,
      status: 403,
      error: "PnL Calculator is currently disabled by admin.",
      disabled: true,
      locked: true,
    };
  }

  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      status: 401,
      error: "Sign in to use the PnL Calculator.",
      needsSignIn: true,
      locked: true,
    };
  }

  const tier = await getSubscriptionTier(userId);
  const isVip = tier === "vip";

  if (isOwner) {
    return {
      ok: true,
      userId,
      isOwner: true,
      isVip,
      unlimited: true,
      used: 0,
      limit: null,
      remaining: null,
    };
  }

  const individual = await getPnlCalculatorUserLimit(userId);
  const limit = resolvePnlCalculatorDailyLimit({
    individualLimit: individual,
    isVip,
    freeDailyLimit: config.freeDailyLimit,
    vipDailyLimit: config.vipDailyLimit,
  });

  if (limit === 0) {
    return {
      ok: false,
      status: 403,
      error: "Your access to the PnL Calculator has been disabled.",
      locked: true,
    };
  }

  const used = await countPnlCalculatorUsesToday(userId);
  const unlimited = limit == null;

  return {
    ok: true,
    userId,
    isOwner: false,
    isVip,
    unlimited,
    used,
    limit,
    remaining: unlimited ? null : Math.max(0, limit - used),
  };
}

export async function assertPnlCalculatorCalculate(
  session: Session | null,
  opts?: { isOwner?: boolean }
): Promise<PnlCalculatorAccess> {
  const access = await getPnlCalculatorAccess(session, opts);
  if (!access.ok) return access;
  if (access.unlimited) return access;

  if (access.limit != null && access.used >= access.limit) {
    return {
      ok: false,
      status: 429,
      error: `Daily limit reached (${access.limit} calculation${access.limit !== 1 ? "s" : ""} per day — resets midnight UTC).${
        !access.isVip ? " Upgrade to VIP for unlimited." : ""
      }`,
      locked: true,
    };
  }

  return access;
}
