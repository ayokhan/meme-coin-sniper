"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Star, History, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sortNovaTimeframeIds } from "@/lib/nova-timeframes";
import {
  normalizeNovaQSymbol,
  novaQSymbolRewriteNote,
  searchNovaQSymbolSuggestions,
  softUnknownSymbolNote,
  type NovaQSymbolSuggestion,
} from "@/lib/nova-q-symbol";
import {
  NOVA_Q_QUICK_PICKS,
  NOVA_Q_TF_PRESETS,
  type NovaQFavorite,
  type NovaQRecent,
  type NovaQTfPresetId,
  type NovaQTool,
  clampTimeframesToAllowed,
  clearNovaQRecents,
  detectNovaQPreset,
  findNovaQFavorite,
  isNovaQFavorited,
  loadNovaQFavorites,
  loadNovaQRecents,
  pushNovaQRecent,
  removeNovaQFavorite,
  renameNovaQFavorite,
  upsertNovaQFavorite,
  writeLastNovaQPresetHint,
  writeNovaQSession,
} from "@/lib/nova-q-watch";

type Props = {
  tool: NovaQTool;
  symbol: string;
  timeframes: string[];
  onSymbolChange: (symbol: string) => void;
  onTimeframesChange: (timeframes: string[]) => void;
  /** Apply symbol+TFs; when run:true, parent should set state and execute with those values. */
  onApplySetup: (symbol: string, timeframes: string[], opts?: { run?: boolean }) => void;
  onRun: () => void;
  loading: boolean;
  runLabel: string;
  allowedTimeframes: string[];
  onOpenOtherTool?: (symbol: string, timeframes: string[]) => void;
  otherToolLabel?: string;
  helpSummary?: string;
  disabled?: boolean;
};

export default function NovaQRunBar({
  tool,
  symbol,
  timeframes,
  onSymbolChange,
  onTimeframesChange,
  onApplySetup,
  onRun,
  loading,
  runLabel,
  allowedTimeframes,
  onOpenOtherTool,
  otherToolLabel,
  helpSummary,
  disabled = false,
}: Props) {
  const [favorites, setFavorites] = useState<NovaQFavorite[]>([]);
  const [recents, setRecents] = useState<NovaQRecent[]>([]);
  const [showCustomTf, setShowCustomTf] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const allowed = useMemo(() => allowedTimeframes, [allowedTimeframes]);

  const suggestions = useMemo(() => {
    const extras: { symbol: string; group: "recent" | "favorite" }[] = [
      ...favorites.map((f) => ({ symbol: f.symbol, group: "favorite" as const })),
      ...recents.map((r) => ({ symbol: r.symbol, group: "recent" as const })),
    ];
    return searchNovaQSymbolSuggestions(symbol, extras, 10);
  }, [symbol, favorites, recents]);

  const rewriteNote = novaQSymbolRewriteNote(symbol);
  const softWarn = softUnknownSymbolNote(symbol);

  useEffect(() => {
    setFavorites(loadNovaQFavorites());
    setRecents(loadNovaQRecents());
    setShowCustomTf(detectNovaQPreset(timeframes) === "custom");
  }, []);

  useEffect(() => {
    if (detectNovaQPreset(timeframes) === "custom") setShowCustomTf(true);
  }, [timeframes]);

  useEffect(() => {
    const refresh = () => {
      setFavorites(loadNovaQFavorites());
      setRecents(loadNovaQRecents());
    };
    window.addEventListener("nova-q-watch-changed", refresh);
    window.addEventListener("nova-q-run-success", refresh);
    return () => {
      window.removeEventListener("nova-q-watch-changed", refresh);
      window.removeEventListener("nova-q-run-success", refresh);
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const activePreset: NovaQTfPresetId = detectNovaQPreset(timeframes);
  const favorited = isNovaQFavorited(symbol, timeframes);
  const activeFavorite = findNovaQFavorite(symbol, timeframes);

  const commitSymbol = (raw: string) => {
    const next = normalizeNovaQSymbol(raw) || raw.trim().toUpperCase();
    onSymbolChange(next);
    if (next && timeframes.length) writeNovaQSession(next, timeframes);
    return next;
  };

  const runNormalized = () => {
    const next = commitSymbol(symbol);
    if (!next || timeframes.length === 0) return;
    writeNovaQSession(next, timeframes);
    onRun();
  };

  const pickSuggestion = (item: NovaQSymbolSuggestion) => {
    const next = commitSymbol(item.symbol);
    setSuggestOpen(false);
    setHighlight(0);
    if (next && timeframes.length) writeNovaQSession(next, timeframes);
  };

  const applyPreset = (id: Exclude<NovaQTfPresetId, "custom">) => {
    const tfs = clampTimeframesToAllowed(NOVA_Q_TF_PRESETS[id].timeframes, allowed);
    onTimeframesChange(tfs);
    writeLastNovaQPresetHint(id);
    setShowCustomTf(false);
    if (symbol.trim()) writeNovaQSession(normalizeNovaQSymbol(symbol) || symbol, tfs);
  };

  const toggleTf = (tf: string) => {
    const next = timeframes.includes(tf)
      ? timeframes.filter((t) => t !== tf)
      : sortNovaTimeframeIds([...timeframes, tf]);
    onTimeframesChange(next);
    writeLastNovaQPresetHint(detectNovaQPreset(next));
    setShowCustomTf(true);
    if (symbol.trim()) writeNovaQSession(normalizeNovaQSymbol(symbol) || symbol, next);
  };

  const toggleFavorite = () => {
    const sym = normalizeNovaQSymbol(symbol) || symbol.trim().toUpperCase();
    if (!sym || timeframes.length === 0) return;
    if (favorited) {
      const match = findNovaQFavorite(sym, timeframes);
      if (match) {
        setFavorites(removeNovaQFavorite(match.id));
        window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
      }
      return;
    }
    const next = upsertNovaQFavorite({
      symbol: sym,
      timeframes,
      preferredTool: tool,
    });
    setFavorites(next);
    window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
  };

  const renameFavorite = (f: NovaQFavorite) => {
    const label = window.prompt("Favorite label (leave empty to clear)", f.label ?? f.symbol);
    if (label === null) return;
    setFavorites(renameNovaQFavorite(f.id, label.trim() ? label : null));
    window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
  };

  return (
    <div className="space-y-3">
      {helpSummary && (
        <div className="text-xs text-muted-foreground">
          <button
            type="button"
            className="text-violet-700 dark:text-violet-300 hover:underline font-medium"
            onClick={() => setHelpOpen((v) => !v)}
          >
            {helpOpen ? "Hide how this works" : "How this reads markets"}
          </button>
          {helpOpen && <p className="mt-1.5 leading-relaxed">{helpSummary}</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <Star className="h-3 w-3" />
          Favorites
        </div>
        {favorites.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Star a symbol + timeframe mix to re-run later without reconfiguring. Pencil renames chips.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onApplySetup(f.symbol, f.timeframes, { run: true })}
                  className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-mono font-medium text-violet-800 dark:text-violet-200 hover:bg-violet-500/20"
                  title={`${f.symbol} · ${f.timeframes.join(" ")}`}
                >
                  {f.label || f.symbol}
                  <span className="ml-1 text-[10px] opacity-70 font-sans">{f.timeframes.length}tf</span>
                </button>
                <button
                  type="button"
                  aria-label={`Rename ${f.symbol}`}
                  className="rounded p-0.5 text-zinc-400 hover:text-violet-500"
                  onClick={() => renameFavorite(f)}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${f.symbol}`}
                  className="rounded p-0.5 text-zinc-400 hover:text-rose-500"
                  onClick={() => {
                    setFavorites(removeNovaQFavorite(f.id));
                    window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            <History className="h-3 w-3" />
            Recent
            {recents.length > 0 && (
              <button
                type="button"
                className="ml-1 text-[10px] normal-case font-normal text-zinc-500 hover:underline"
                onClick={() => {
                  clearNovaQRecents();
                  setRecents([]);
                  window.dispatchEvent(new CustomEvent("nova-q-watch-changed"));
                }}
              >
                Clear
              </button>
            )}
          </div>
          {recents.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Successful runs land here for one-tap replay.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recents.slice(0, 8).map((r) => (
                <button
                  key={`${r.tool}-${r.symbol}-${r.timeframes.join()}-${r.at}`}
                  type="button"
                  onClick={() => onApplySetup(r.symbol, r.timeframes, { run: true })}
                  className="rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-100/80 dark:bg-zinc-800/80 px-2.5 py-1 text-xs font-mono text-zinc-800 dark:text-zinc-200 hover:border-violet-400/60"
                  title={`${r.tool.toUpperCase()} · ${r.timeframes.join(" ")}`}
                >
                  {r.symbol}
                  <span className="ml-1 text-[10px] opacity-60 font-sans">{r.tool}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Majors</div>
          <div className="flex flex-wrap gap-1.5">
            {NOVA_Q_QUICK_PICKS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  commitSymbol(s);
                }}
                className={`rounded-md border px-2 py-1 text-xs font-mono transition-colors ${
                  normalizeNovaQSymbol(symbol) === s || symbol.trim().toUpperCase() === s
                    ? "border-violet-500 bg-violet-500/15 text-violet-800 dark:text-violet-200"
                    : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Timeframes</div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(NOVA_Q_TF_PRESETS) as Array<keyof typeof NOVA_Q_TF_PRESETS>).map((id) => {
            const p = NOVA_Q_TF_PRESETS[id];
            const presetTfs = clampTimeframesToAllowed(p.timeframes, allowed);
            const active = activePreset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
                  active
                    ? "border-violet-500 bg-violet-500 text-white"
                    : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {p.label}
                <span className="ml-1 opacity-70 font-normal">{presetTfs.join(" · ")}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowCustomTf((v) => !v)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
              activePreset === "custom" || showCustomTf
                ? "border-violet-500 bg-violet-500/15 text-violet-800 dark:text-violet-200"
                : "border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Custom…
          </button>
        </div>
        {(showCustomTf || activePreset === "custom") && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 px-2.5 py-2">
            {allowed.map((tf) => (
              <label key={`${tool}-${tf}`} className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeframes.includes(tf)}
                  onChange={() => toggleTf(tf)}
                  className="rounded border-zinc-400 dark:border-zinc-500"
                />
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{tf}</span>
              </label>
            ))}
          </div>
        )}
        {!showCustomTf && activePreset !== "custom" && timeframes.length > 0 && (
          <p className="text-[11px] text-muted-foreground font-mono">Active: {timeframes.join(" · ")}</p>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-2">
        <div className="relative" ref={wrapRef}>
          <input
            type="text"
            placeholder="Symbol e.g. BTC, GOLD, BTCUSDT"
            value={symbol}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              onSymbolChange(e.target.value.toUpperCase());
              setSuggestOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => {
              // Defer so suggestion click can fire
              window.setTimeout(() => {
                const next = normalizeNovaQSymbol(symbol);
                if (next && next !== symbol.trim().toUpperCase()) onSymbolChange(next);
              }, 120);
            }}
            onKeyDown={(e) => {
              if (suggestOpen && suggestions.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                  return;
                }
                if (e.key === "Escape") {
                  setSuggestOpen(false);
                  return;
                }
                if (e.key === "Tab" && suggestions[highlight]) {
                  e.preventDefault();
                  pickSuggestion(suggestions[highlight]);
                  return;
                }
              }
              if (e.key === "Enter" && !loading && !disabled && symbol.trim() && timeframes.length > 0) {
                e.preventDefault();
                if (suggestOpen && suggestions[highlight] && suggestions[highlight].symbol !== normalizeNovaQSymbol(symbol)) {
                  pickSuggestion(suggestions[highlight]);
                }
                runNormalized();
                setSuggestOpen(false);
              }
            }}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2.5 py-1.5 w-48 sm:w-56 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 font-mono"
          />
          {suggestOpen && suggestions.length > 0 && (
            <ul
              className="absolute z-30 mt-1 max-h-56 w-64 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg text-xs"
              role="listbox"
            >
              {suggestions.map((item, i) => (
                <li key={`${item.group}-${item.symbol}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between gap-2 ${
                      i === highlight
                        ? "bg-violet-500/15 text-violet-900 dark:text-violet-100"
                        : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSuggestion(item);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                  >
                    <span className="font-mono font-medium">{item.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {item.label || item.group}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(rewriteNote || softWarn) && (
            <p className={`mt-1 text-[11px] ${softWarn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
              {softWarn || rewriteNote}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="px-2"
          disabled={!symbol.trim() || timeframes.length === 0}
          onClick={toggleFavorite}
          title={favorited ? "Remove favorite" : "Save favorite"}
        >
          <Star className={`h-4 w-4 ${favorited ? "fill-amber-400 text-amber-500" : "text-zinc-500"}`} />
        </Button>
        {activeFavorite && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="px-2"
            title="Rename favorite"
            onClick={() => renameFavorite(activeFavorite)}
          >
            <Pencil className="h-4 w-4 text-zinc-500" />
          </Button>
        )}
        <Button
          type="button"
          onClick={runNormalized}
          disabled={disabled || loading || timeframes.length === 0 || !symbol.trim()}
        >
          {loading ? "Running…" : runLabel}
        </Button>
        {onOpenOtherTool && otherToolLabel && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!symbol.trim() || timeframes.length === 0}
            onClick={() => {
              const next = commitSymbol(symbol);
              if (!next) return;
              writeNovaQSession(next, timeframes);
              onOpenOtherTool(next, timeframes);
            }}
          >
            {otherToolLabel}
          </Button>
        )}
      </div>
      {timeframes.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Select at least one timeframe.</p>
      )}
    </div>
  );
}

/** Call after a successful NovaQ / Fib analysis so recents + session stay in sync. */
export function notifyNovaQRunSuccess(tool: NovaQTool, symbol: string, timeframes: string[]): void {
  if (typeof window === "undefined") return;
  const sym = normalizeNovaQSymbol(symbol) || symbol.trim().toUpperCase();
  writeNovaQSession(sym, timeframes);
  pushNovaQRecent({ symbol: sym, timeframes, tool });
  window.dispatchEvent(new CustomEvent("nova-q-run-success"));
}
