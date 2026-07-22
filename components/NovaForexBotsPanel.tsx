"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NovaForexBotPanel from "@/components/NovaForexBotPanel";
import NovaForexScalperPanel from "@/components/NovaForexScalperPanel";
import { hasNovaForexScalperPrefill } from "@/lib/nova-forex-scalper-prefill";

type Props = {
  /** From feature flags: Off / Owner only / All VIP via getNovaForexBotAccess */
  novaForexBot: boolean;
  /** From feature flags: Off / Owner only / All VIP via getNovaForexScalpBotAccess */
  novaForexScalpBot: boolean;
};

/**
 * Focus → Bots home for Nova Forex execution bots (Vantage Markets / TIOmarkets via MetaAPI).
 * Visibility is controlled by the same tri-state feature flags as before (not a separate page-tab flag).
 */
export default function NovaForexBotsPanel({ novaForexBot, novaForexScalpBot }: Props) {
  const defaultTab =
    novaForexScalpBot && (typeof window !== "undefined" ? hasNovaForexScalperPrefill() : false)
      ? "scalp-bot"
      : novaForexBot
        ? "forex-bot"
        : "scalp-bot";

  const [subTab, setSubTab] = useState<"forex-bot" | "scalp-bot">(defaultTab);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const forex = params.get("forex");
    if (forex === "scalp-bot" && novaForexScalpBot) setSubTab("scalp-bot");
    else if (forex === "forex-bot" && novaForexBot) setSubTab("forex-bot");
    else if (hasNovaForexScalperPrefill() && novaForexScalpBot) setSubTab("scalp-bot");
  }, [novaForexBot, novaForexScalpBot]);

  if (!novaForexBot && !novaForexScalpBot) {
    return (
      <div className="rounded-2xl border border-amber-200/80 dark:border-amber-800/80 bg-gradient-to-b from-amber-50/80 to-white dark:from-amber-950/40 dark:to-zinc-900/80 p-8 text-center max-w-lg mx-auto">
        <Flame className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400 mb-3" aria-hidden />
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Nova Forex Bots</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These bots are not available on your account yet. They are VIP-only and controlled by the owner (Off / Owner only /
          All VIP). Contact support if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Flame className="h-5 w-5 flame-hot-tab text-emerald-600 dark:text-emerald-400" aria-hidden />
          Nova Forex Bots
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Trade forex, metals, and indices on your own <strong className="text-foreground">Vantage Markets</strong> or{" "}
          <strong className="text-foreground">TIOmarkets</strong> MT4/MT5 account via MetaAPI. VIP only — same Off / Owner
          only / All VIP flags as in Admin → Feature flags.
        </p>
      </div>

      <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "forex-bot" | "scalp-bot")}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {novaForexBot && <TabsTrigger value="forex-bot">Nova Forex Bot</TabsTrigger>}
          {novaForexScalpBot && <TabsTrigger value="scalp-bot">Nova Forex Scalper</TabsTrigger>}
        </TabsList>

        {novaForexBot && (
          <TabsContent value="forex-bot" className="mt-4">
            <NovaForexBotPanel />
          </TabsContent>
        )}
        {novaForexScalpBot && (
          <TabsContent value="scalp-bot" className="mt-4">
            <NovaForexScalperPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
