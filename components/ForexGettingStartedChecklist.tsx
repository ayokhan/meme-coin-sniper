"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";
import { brokerOffersPartnerRebate } from "@/lib/forex-partner-rebates";

const STORAGE_KEY = "novastaris-forex-checklist-v1";

type StepId = "broker" | "rebate" | "affiliate";

type Step = {
  id: StepId;
  label: string;
  href?: string;
  hash?: string;
};

type Props = {
  /** Active broker tab — rebate step only on TIOmarkets (or other rebate partners). */
  activeBroker?: ForexBrokerId | null;
};

export function ForexGettingStartedChecklist({ activeBroker = null }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [done, setDone] = useState<Record<StepId, boolean>>({
    broker: false,
    rebate: false,
    affiliate: false,
  });
  const [manual, setManual] = useState<Partial<Record<StepId, boolean>>>({});

  const showRebateStep = brokerOffersPartnerRebate(activeBroker);

  const steps = useMemo((): Step[] => {
    const list: Step[] = [{ id: "broker", label: "Register / connect your broker" }];
    if (showRebateStep) {
      list.push({
        id: "rebate",
        label: "Submit TIOmarkets rebate details ($2/lot USDC)",
        hash: "#forex-partner-rebate",
      });
    }
    list.push({
      id: "affiliate",
      label: "Get your affiliate link",
      href: "/affiliate",
    });
    return list;
  }, [showRebateStep]);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      /* ignore */
    }
    setDismissed(false);
  }, []);

  const loadProgress = useCallback(async () => {
    const next: Record<StepId, boolean> = { broker: false, rebate: false, affiliate: false };
    try {
      const fetches: Promise<Response>[] = [
        fetch("/api/user/forex-broker-config", { credentials: "include", cache: "no-store" }),
        fetch("/api/affiliate", { credentials: "include", cache: "no-store" }),
      ];
      if (showRebateStep) {
        fetches.splice(
          1,
          0,
          fetch("/api/forex-partner-rebate/status", { credentials: "include", cache: "no-store" })
        );
      }
      const results = await Promise.all(fetches);
      const brokerRes = results[0];
      const rebateRes = showRebateStep ? results[1] : null;
      const affiliateRes = showRebateStep ? results[2] : results[1];

      if (brokerRes?.ok) {
        const data = await brokerRes.json();
        next.broker =
          Array.isArray(data.connections) && data.connections.some((c: { connected?: boolean }) => c.connected);
      }
      if (rebateRes?.ok) {
        const data = await rebateRes.json();
        next.rebate = !!data.enrolled || (Array.isArray(data.enrollments) && data.enrollments.length > 0);
      } else {
        next.rebate = true; // not applicable
      }
      if (affiliateRes?.ok) {
        const data = await affiliateRes.json();
        next.affiliate = !!data.referralLink || !!data.referralCode;
      }
    } catch {
      /* ignore — fall back to manual checks */
    }
    setDone(next);
  }, [showRebateStep]);

  useEffect(() => {
    if (dismissed) return;
    void loadProgress();
  }, [dismissed, loadProgress]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  const isDone = (id: StepId) => !!(done[id] || manual[id]);
  const completedCount = steps.filter((s) => isDone(s.id)).length;
  if (completedCount === steps.length) return null;

  const blurb = showRebateStep
    ? "Connect a broker, enroll for the TIOmarkets $2/lot rebate, then share your affiliate link."
    : "Connect your broker, then share your affiliate link. Lot rebates apply on TIOmarkets only.";

  return (
    <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 dark:bg-teal-950/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Getting started</p>
          <p className="text-[11px] text-muted-foreground">
            {completedCount}/{steps.length} complete — {blurb}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={dismiss} aria-label="Dismiss checklist">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {steps.map((step, i) => {
          const checked = isDone(step.id);
          const content = (
            <span className="flex items-center gap-2 text-xs">
              {checked ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
              )}
              <span className={checked ? "text-muted-foreground line-through" : "text-zinc-800 dark:text-zinc-200"}>
                {i + 1}. {step.label}
              </span>
            </span>
          );
          return (
            <li key={step.id} className="flex items-center justify-between gap-2">
              {step.href ? (
                <Link href={step.href} className="hover:underline">
                  {content}
                </Link>
              ) : step.hash ? (
                <a href={step.hash} className="hover:underline">
                  {content}
                </a>
              ) : (
                content
              )}
              {!checked && (
                <button
                  type="button"
                  className="text-[10px] text-teal-700 dark:text-teal-300 hover:underline shrink-0"
                  onClick={() => setManual((m) => ({ ...m, [step.id]: true }))}
                >
                  Mark done
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
