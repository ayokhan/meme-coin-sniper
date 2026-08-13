"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NovaScalpAgentPanel from "@/components/NovaScalpAgentPanel";
import NovaForexScalpAgentPanel from "@/components/NovaForexScalpAgentPanel";
import NovaPulsePnlCalculator from "@/components/NovaPulsePnlCalculator";

export type NovaPulseSubTab = "futures" | "forex" | "pnl";

type Props = {
  isVip: boolean;
  canShareCoach?: boolean;
  novaScalpAgent: boolean;
  novaForexScalpAgent: boolean;
  novaPulsePnlCalculator?: boolean;
  novaForexBot?: boolean;
  novaForexScalpBot?: boolean;
  /** Controlled sub-tab (kept in URL by parent). */
  subTab: NovaPulseSubTab;
  onSubTabChange: (sub: NovaPulseSubTab) => void;
};

export default function NovaPulsePanel({
  isVip,
  canShareCoach = false,
  novaScalpAgent,
  novaForexScalpAgent,
  novaPulsePnlCalculator = false,
  novaForexBot = false,
  novaForexScalpBot = false,
  subTab,
  onSubTabChange,
}: Props) {
  const [localTab, setLocalTab] = useState<NovaPulseSubTab>(subTab);

  useEffect(() => {
    setLocalTab(subTab);
  }, [subTab]);

  useEffect(() => {
    const allowed =
      (localTab === "futures" && novaScalpAgent) ||
      (localTab === "forex" && novaForexScalpAgent) ||
      (localTab === "pnl" && novaPulsePnlCalculator);
    if (allowed) return;
    const fallback: NovaPulseSubTab | null = novaPulsePnlCalculator
      ? "pnl"
      : novaScalpAgent
        ? "futures"
        : novaForexScalpAgent
          ? "forex"
          : null;
    if (fallback) {
      setLocalTab(fallback);
      onSubTabChange(fallback);
    }
  }, [localTab, novaScalpAgent, novaForexScalpAgent, novaPulsePnlCalculator, onSubTabChange]);

  const select = (next: NovaPulseSubTab) => {
    setLocalTab(next);
    onSubTabChange(next);
  };

  if (!novaScalpAgent && !novaForexScalpAgent && !novaPulsePnlCalculator) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-2">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Pulse</h2>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Short-horizon trade plans from Nova AI for crypto futures and forex. This desk is not enabled on your account
          yet — contact support if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Nova Pulse</h2>
        <p className="text-xs text-muted-foreground">
          AI-assisted short-horizon setups for crypto futures and forex — decision support for faster entries, not
          guaranteed profits. Futures uses Nova Scalp Agent; Forex uses Nova Forex Agent; Calculate PnL sizes your own
          ticket before you send it to the scalper or NovaQ.
        </p>
      </div>

      <Tabs value={localTab} onValueChange={(v) => select(v as NovaPulseSubTab)} className="space-y-4">
        <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg flex-wrap h-auto gap-1">
          {novaPulsePnlCalculator && (
            <TabsTrigger
              value="pnl"
              className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-amber-500 data-[state=active]:text-white dark:data-[state=active]:bg-amber-600"
            >
              Calculate PnL
            </TabsTrigger>
          )}
          {novaScalpAgent && (
            <TabsTrigger
              value="futures"
              className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-sky-500 data-[state=active]:text-white dark:data-[state=active]:bg-sky-600"
            >
              Futures
            </TabsTrigger>
          )}
          {novaForexScalpAgent && (
            <TabsTrigger
              value="forex"
              className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-700"
            >
              Forex
            </TabsTrigger>
          )}
        </TabsList>

        {novaPulsePnlCalculator && (
          <TabsContent value="pnl" className="mt-0">
            <NovaPulsePnlCalculator
              enabled={novaPulsePnlCalculator}
              isVip={isVip}
              novaForexScalpBot={novaForexScalpBot}
            />
          </TabsContent>
        )}

        {novaScalpAgent && (
          <TabsContent value="futures" className="mt-0">
            <NovaScalpAgentPanel enabled={novaScalpAgent} isVip={isVip} canShareCoach={canShareCoach} />
          </TabsContent>
        )}

        {novaForexScalpAgent && (
          <TabsContent value="forex" className="mt-0">
            <NovaForexScalpAgentPanel
              enabled={novaForexScalpAgent}
              isVip={isVip}
              novaForexBot={novaForexBot}
              novaForexScalpBot={novaForexScalpBot}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
