"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  FOREX_BROKER_LABELS,
  type ForexPartnerBrokerId,
  isForexPartnerBrokerId,
} from "@/lib/forex-broker-user-config";
import {
  DEFAULT_REBATE_REWARD_VALUE,
  formatRebateReward,
  shortenWallet,
  brokerOffersPartnerRebate,
} from "@/lib/forex-partner-rebates";

type Enrollment = {
  id: string;
  broker: string;
  brokerLabel: string;
  customerName: string;
  customerEmail: string;
  mtLogin: string;
  usdcWallet: string;
  rewardLabel: string;
};

type RebateStatusSummary = {
  pendingUsd: number;
  paidThisMonthUsd: number;
  paidAllTimeUsd: number;
  pendingCount: number;
  paidCount: number;
};

type RebatePayoutRow = {
  id: string;
  brokerLabel: string;
  status: string;
  amountPaidUsd: number | null;
  suggestedAmountUsd: number | null;
  periodNote: string | null;
  createdAt: string;
};

type Props = {
  broker: ForexPartnerBrokerId;
  className?: string;
  /** Expand form by default (e.g. deep-link). */
  defaultOpen?: boolean;
};

const inputClass =
  "mt-1 w-full h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 text-sm text-zinc-100 placeholder:text-zinc-500";

export function ForexPartnerRebateEnrollForm({ broker, className = "", defaultOpen = false }: Props) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(defaultOpen);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [mtLogin, setMtLogin] = useState("");
  const [usdcWallet, setUsdcWallet] = useState("");
  const [existing, setExisting] = useState<Enrollment | null>(null);
  const [summary, setSummary] = useState<RebateStatusSummary | null>(null);
  const [payouts, setPayouts] = useState<RebatePayoutRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const partnerBroker: ForexPartnerBrokerId | null =
    isForexPartnerBrokerId(broker) && brokerOffersPartnerRebate(broker) ? broker : null;
  const brokerLabel = partnerBroker ? FOREX_BROKER_LABELS[partnerBroker] : broker;

  const loadStatus = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/forex-partner-rebate/status", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) return;
      setSummary(data.summary ?? null);
      setPayouts((data.payouts ?? []).slice(0, 5));
    } catch {
      /* ignore */
    }
  }, [status]);

  const load = useCallback(async () => {
    if (!partnerBroker || status !== "authenticated") return;
    try {
      const res = await fetch(`/api/forex-partner-rebate/enroll?broker=${partnerBroker}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) return;
      const e = data.enrollment as Enrollment | null;
      if (e) {
        setExisting(e);
        setCustomerName(e.customerName);
        setCustomerEmail(e.customerEmail);
        setMtLogin(e.mtLogin);
        setUsdcWallet(e.usdcWallet);
      } else {
        setExisting(null);
        setCustomerName(session?.user?.name ?? "");
        setCustomerEmail(session?.user?.email ?? "");
      }
    } catch {
      /* ignore */
    }
  }, [partnerBroker, session?.user?.email, session?.user?.name, status]);

  useEffect(() => {
    void load();
    void loadStatus();
  }, [load, loadStatus]);

  useEffect(() => {
    if (status === "authenticated" && !customerName && session?.user?.name) {
      setCustomerName(session.user.name);
    }
    if (status === "authenticated" && !customerEmail && session?.user?.email) {
      setCustomerEmail(session.user.email);
    }
  }, [status, session?.user?.name, session?.user?.email, customerName, customerEmail]);

  if (!partnerBroker) {
    return null;
  }

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/forex-partner-rebate/enroll", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broker: partnerBroker,
          customerName,
          customerEmail,
          mtLogin,
          usdcWallet,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not save details.");
        return;
      }
      setExisting(data.enrollment);
      setNotice(data.message || "Saved.");
      setOpen(true);
      void loadStatus();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      id="forex-partner-rebate"
      className={`rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-zinc-950/80 to-zinc-900/60 p-4 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            ${DEFAULT_REBATE_REWARD_VALUE}/lot USDC rebate — {brokerLabel}
          </p>
          <p className="text-xs text-zinc-400 mt-1 max-w-prose">
            Register through NovaStaris, then submit your MT login and Solana USDC wallet. We pay{" "}
            {formatRebateReward("per_lot", DEFAULT_REBATE_REWARD_VALUE)} in USDC for your traded lots.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide form" : existing ? "Update details" : "Submit rebate details"}
        </Button>
      </div>

      {status === "authenticated" && summary && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-2.5 py-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Pending</p>
            <p className="text-sm font-semibold text-amber-300">${summary.pendingUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-2.5 py-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Paid this month</p>
            <p className="text-sm font-semibold text-emerald-300">${summary.paidThisMonthUsd.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/50 px-2.5 py-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Paid all-time</p>
            <p className="text-sm font-semibold text-zinc-100">${summary.paidAllTimeUsd.toFixed(2)}</p>
          </div>
        </div>
      )}

      {status === "authenticated" && payouts.length > 0 && (
        <div className="mt-2 space-y-1">
          {payouts.map((p) => (
            <p key={p.id} className="text-[11px] text-zinc-400 flex flex-wrap gap-x-2">
              <span
                className={
                  p.status === "paid" ? "text-emerald-400" : "text-amber-400"
                }
              >
                {p.status === "paid" ? "Paid" : "Pending"}
              </span>
              <span>
                $
                {(p.amountPaidUsd ?? p.suggestedAmountUsd ?? 0).toFixed(2)}
              </span>
              <span>{p.brokerLabel}</span>
              {p.periodNote && <span>· {p.periodNote}</span>}
            </p>
          ))}
        </div>
      )}

      {existing && !open && (
        <p className="mt-2 text-[11px] text-emerald-400/90">
          Details on file · MT {existing.mtLogin} · wallet {shortenWallet(existing.usdcWallet)} ·{" "}
          {existing.rewardLabel}
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-2.5">
          {status === "unauthenticated" && (
            <p className="text-xs text-amber-300">
              Sign in to NovaStaris first, then submit your rebate payout details.
            </p>
          )}
          {status === "authenticated" && (
            <>
              <label className="block text-[11px] text-zinc-400">
                Full name *
                <input
                  className={inputClass}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="block text-[11px] text-zinc-400">
                Email *
                <input
                  type="email"
                  className={inputClass}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="block text-[11px] text-zinc-400">
                {brokerLabel} / MT4 / MT5 account login *
                <input
                  className={inputClass}
                  value={mtLogin}
                  onChange={(e) => setMtLogin(e.target.value)}
                  placeholder="Account number / login"
                />
              </label>
              <label className="block text-[11px] text-zinc-400">
                Solana USDC wallet (payout address) *
                <input
                  className={inputClass}
                  value={usdcWallet}
                  onChange={(e) => setUsdcWallet(e.target.value)}
                  placeholder="Solana address"
                  spellCheck={false}
                />
              </label>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Offer: {formatRebateReward("per_lot", DEFAULT_REBATE_REWARD_VALUE)} in USDC. We match volume on
                your MT login, then send USDC to this wallet. Update anytime before payout.
              </p>
              {error && <p className="text-xs text-rose-400">{error}</p>}
              {notice && <p className="text-xs text-emerald-400">{notice}</p>}
              <Button
                type="button"
                size="sm"
                disabled={busy || !customerName.trim() || !mtLogin.trim() || !usdcWallet.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white"
                onClick={() => void save()}
              >
                {busy ? "Saving…" : existing ? "Update rebate details" : "Save rebate details"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
