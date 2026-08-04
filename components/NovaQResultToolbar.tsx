"use client";

import { useEffect, useState } from "react";
import { Star, RefreshCw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NovaQTradePlan } from "@/lib/nova-q-trade-plan";
import type { NovaQTool } from "@/lib/nova-q-watch";
import {
  findNovaQFavorite,
  isNovaQFavorited,
  removeNovaQFavorite,
  renameNovaQFavorite,
  upsertNovaQFavorite,
} from "@/lib/nova-q-watch";
import {
  NOVA_SCALPER_HANDOFF_URL,
  writeNovaScalperPrefill,
} from "@/lib/nova-scalper-prefill";
import { useScalpHandoffNav } from "@/components/useScalpHandoffNav";
import { normalizeNovaQSymbol } from "@/lib/nova-q-symbol";

type Props = {
  tool: NovaQTool;
  symbol: string;
  timeframes: string[];
  tradePlan?: NovaQTradePlan | null;
  onRerun: () => void;
  onOpenOtherTool?: (symbol: string, timeframes: string[]) => void;
  otherToolLabel?: string;
};

/**
 * Compact actions on NovaQ / Fib result headers: ★, rename, re-run, other tool, Send to Scalper.
 */
export default function NovaQResultToolbar({
  tool,
  symbol,
  timeframes,
  tradePlan,
  onRerun,
  onOpenOtherTool,
  otherToolLabel,
}: Props) {
  const { requestHandoff, dialog: handoffDialog } = useScalpHandoffNav();
  const [favorited, setFavorited] = useState(false);
  const [favId, setFavId] = useState<string | null>(null);

  const refreshFav = () => {
    const f = findNovaQFavorite(symbol, timeframes);
    setFavorited(!!f);
    setFavId(f?.id ?? null);
  };

  useEffect(() => {
    refreshFav();
    const onWatch = () => refreshFav();
    window.addEventListener("nova-q-watch-changed", onWatch);
    return () => window.removeEventListener("nova-q-watch-changed", onWatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframes.join(",")]);

  const toggleFavorite = () => {
    const sym = normalizeNovaQSymbol(symbol) || symbol.trim().toUpperCase();
    if (!sym || timeframes.length === 0) return;
    if (isNovaQFavorited(sym, timeframes)) {
      const match = findNovaQFavorite(sym, timeframes);
      if (match) removeNovaQFavorite(match.id);
    } else {
      upsertNovaQFavorite({ symbol: sym, timeframes, preferredTool: tool });
    }
    window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
    refreshFav();
  };

  const rename = () => {
    if (!favId) {
      toggleFavorite();
      const f = findNovaQFavorite(symbol, timeframes);
      if (!f) return;
      const label = window.prompt("Favorite label", f.label ?? f.symbol);
      if (label === null) return;
      renameNovaQFavorite(f.id, label.trim() ? label : null);
      window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
      refreshFav();
      return;
    }
    const f = findNovaQFavorite(symbol, timeframes);
    const label = window.prompt("Favorite label (empty to clear)", f?.label ?? symbol);
    if (label === null) return;
    renameNovaQFavorite(favId, label.trim() ? label : null);
    window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
    refreshFav();
  };

  const canSendToScalper =
    tradePlan != null &&
    (tradePlan.side === "long" || tradePlan.side === "short") &&
    tradePlan.entryType !== "wait" &&
    tradePlan.suggestedEntryPrice != null &&
    Number.isFinite(tradePlan.suggestedEntryPrice) &&
    tradePlan.takeProfitPrice != null &&
    Number.isFinite(tradePlan.takeProfitPrice);

  const sendToScalper = () => {
    if (!canSendToScalper || !tradePlan) return;
    const side = tradePlan.side as "long" | "short";
    const prefill = {
      symbol: normalizeNovaQSymbol(symbol) || symbol,
      side,
      entryPrice: tradePlan.suggestedEntryPrice as number,
      exitPrice: tradePlan.takeProfitPrice as number,
      stopLossPrice: tradePlan.stopLossPrice,
      leverage: 5,
      marginUsd: 50,
      source: "NovaQ trade plan",
      createdAt: new Date().toISOString(),
    };
    requestHandoff({
      label: "NovaScalper",
      url: NOVA_SCALPER_HANDOFF_URL,
      prepare: () => writeNovaScalperPrefill(prefill),
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={toggleFavorite}
          title={favorited ? "Remove favorite" : "Save as favorite"}
        >
          <Star className={`h-3.5 w-3.5 mr-1 ${favorited ? "fill-amber-400 text-amber-500" : ""}`} />
          {favorited ? "Saved" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={rename}
          title="Rename favorite"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onRerun}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Rerun
        </Button>
        {onOpenOtherTool && otherToolLabel && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onOpenOtherTool(normalizeNovaQSymbol(symbol) || symbol, timeframes)}
          >
            {otherToolLabel}
          </Button>
        )}
        {canSendToScalper && (
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={sendToScalper}
            title="Prefill NovaScalper with this plan (review before save)"
          >
            Send to Scalper
          </Button>
        )}
      </div>
      {handoffDialog}
    </>
  );
}
