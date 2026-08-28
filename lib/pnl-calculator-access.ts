import type { Session } from "next-auth";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getSubscriptionTier } from "@/lib/subscription";
import {
  countPnlCalculatorGuestUsesToday,
  countPnlCalculatorUsesToday,
  getPnlCalculatorConfig,
  getPnlCalculatorUserLimit,
  resolvePnlCalculatorDailyLimit,
} from "@/lib/pnl-calculator-quota";

export type PnlCalculatorAccess =
  | {
      ok: true;
      userId: string | null;
      visitorId: string | null;
      isGuest: boolean;
      isOwner: boolean;
      isVip: boolean;
      unlimited: boolean;
      used: number;
      limit: number | null;
      remaining: number | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
      locked?: boolean;
      disabled?: boolean;
      needsRegister?: boolean;
      limitReached?: boolean;
    };

export async function getPnlCalculatorAccess(
  session: Session | null,
  opts?: { isOwner?: boolean; visitorId?: string | null }
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
  const userId = session?.user?.id ?? null;

  if (!config.enabled && !isOwner) {
    return {
      ok: false,
      status: 403,
      error: "PnL Calculator is currently disabled by admin.",
      disabled: true,
      locked: true,
    };
  }

  if (isOwner && userId) {
    const tier = await getSubscriptionTier(userId);
    return {
      ok: true,
      userId,
      visitorId: opts?.visitorId ?? null,
      isGuest: false,
      isOwner: true,
      isVip: tier === "vip",
      unlimited: true,
      used: 0,
      limit: null,
      remaining: null,
    };
  }

  if (!userId) {
    const visitorId = opts?.visitorId ?? null;
    if (!visitorId) {
      return {
        ok: false,
        status: 400,
        error: "Could not identify this browser session. Enable cookies/local storage and refresh.",
        locked: true,
      };
    }

    const limit = resolvePnlCalculatorDailyLimit({
      individualLimit: null,
      isVip: false,
      isGuest: true,
      guestDailyLimit: config.guestDailyLimit,
      freeDailyLimit: config.freeDailyLimit,
      vipDailyLimit: config.vipDailyLimit,
    });

    if (limit === 0) {
      return {
        ok: false,
        status: 403,
        error: "Guest access to the PnL Calculator is currently disabled.",
        locked: true,
      };
    }

    const used = await countPnlCalculatorGuestUsesToday(visitorId);
    return {
      ok: true,
      userId: null,
      visitorId,
      isGuest: true,
      isOwner: false,
      isVip: false,
      unlimited: false,
      used,
      limit,
      remaining: limit == null ? null : Math.max(0, limit - used),
    };
  }

  const tier = await getSubscriptionTier(userId);
  const isVip = tier === "vip";

  const individual = await getPnlCalculatorUserLimit(userId);
  const limit = resolvePnlCalculatorDailyLimit({
    individualLimit: individual,
    isVip,
    isGuest: false,
    guestDailyLimit: config.guestDailyLimit,
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
    visitorId: opts?.visitorId ?? null,
    isGuest: false,
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
  opts?: { isOwner?: boolean; visitorId?: string | null }
): Promise<PnlCalculatorAccess> {
  const access = await getPnlCalculatorAccess(session, opts);
  if (!access.ok) return access;
  if (access.unlimited) return access;

  if (access.limit != null && access.used >= access.limit) {
    if (access.isGuest) {
      return {
        ok: false,
        status: 429,
        error: `You've used your ${access.limit} free guest calculation${access.limit !== 1 ? "s" : ""} today (resets midnight UTC). Register for free to get ${(await getPnlCalculatorConfig()).freeDailyLimit} per day — VIP unlimited.`,
        locked: true,
        needsRegister: true,
        limitReached: true,
      };
    }
    return {
      ok: false,
      status: 429,
      error: `Daily limit reached (${access.limit} calculation${access.limit !== 1 ? "s" : ""} per day — resets midnight UTC).${
        !access.isVip ? " Upgrade to VIP for unlimited." : ""
      }`,
      locked: true,
      limitReached: true,
    };
  }

  return access;
}
