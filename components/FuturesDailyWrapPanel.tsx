"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FuturesDailyWrapPayload, FuturesWrapItem } from "@/lib/futures-daily-wrap";

type ArchiveItem = { dateKey: string; title: string; publishedAt: string };

function HighlightText({ text, highlights }: { text: string; highlights: string[] }) {
  if (!highlights.length) return <>{text}</>;
  const sorted = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  const escaped = sorted.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return <>{text}</>;
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  return (
    <>
      {parts.map((part, i) =>
        sorted.some((h) => h === part) ? (
          <span key={i} className="font-semibold text-orange-400">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function Section({
  title,
  items,
  onOpenHref,
}: {
  title: string;
  items: FuturesWrapItem[];
  onOpenHref?: (href: string) => void;
}) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-orange-400">{title}</h3>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.id} className="text-[15px] leading-relaxed text-zinc-200">
            <HighlightText text={item.text} highlights={item.highlights} />
            {item.href && onOpenHref ? (
              <button
                type="button"
                onClick={() => onOpenHref(item.href!)}
                className="ml-2 text-xs text-orange-400/80 underline-offset-2 hover:underline"
              >
                Open
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function FuturesDailyWrapPanel({
  onNavigateHref,
}: {
  /** Optional: parent handles in-app navigation for wrap deep links */
  onNavigateHref?: (href: string) => void;
}) {
  const [wrap, setWrap] = useState<FuturesDailyWrapPayload | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async (dateKey?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const q = dateKey ? `?date=${encodeURIComponent(dateKey)}` : "";
      const res = await fetch(`/api/futures/daily-wrap${q}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setError(data.error ?? `Error ${res.status}`);
        setWrap(null);
        return;
      }
      setWrap(data.wrap ?? null);
      setArchive(Array.isArray(data.archive) ? data.archive : []);
      if (data.wrap?.dateKey) setSelectedDate(data.wrap.dateKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setWrap(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const publishedLabel = wrap
    ? new Date(wrap.publishedAt).toLocaleString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }) + " UTC"
    : null;

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-6 sm:px-8 sm:py-8">
      <p className="mb-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        NovaStaris
      </p>
      {loading && !wrap ? (
        <p className="py-12 text-center text-sm text-zinc-500">Loading Daily Wrap…</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-400">{error}</p>
      ) : !wrap ? (
        <div className="py-10 text-center">
          <h2 className="mb-2 text-xl font-semibold text-zinc-100">Daily Market Wrap</h2>
          <p className="text-sm text-zinc-500">
            No wrap yet. It publishes automatically with the daily cron (00:00 UTC).
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void load(null)}>
            Refresh
          </Button>
        </div>
      ) : (
        <>
          <h2 className="mb-1 text-center text-2xl font-semibold tracking-tight text-zinc-50">
            {wrap.title}
          </h2>
          {publishedLabel ? (
            <p className="mb-8 text-center text-xs text-zinc-500">{publishedLabel}</p>
          ) : null}

          <Section title="Hot Topics" items={wrap.hotTopics} onOpenHref={onNavigateHref} />
          <Section title="Market Updates" items={wrap.marketUpdates} onOpenHref={onNavigateHref} />

          <p className="mt-2 text-center text-[11px] text-zinc-600">
            Auto-generated from live Hyperliquid perp data · Not financial advice
          </p>
        </>
      )}

      {archive.length > 0 ? (
        <div className="mt-10 border-t border-zinc-800 pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-400">Latest</h3>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void load(null)}>
              Today
            </Button>
          </div>
          <ul className="divide-y divide-zinc-800/80">
            {archive.map((a) => {
              const active = a.dateKey === selectedDate;
              const time = new Date(a.publishedAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: "UTC",
              });
              return (
                <li key={a.dateKey}>
                  <button
                    type="button"
                    onClick={() => void load(a.dateKey)}
                    className={`flex w-full items-center justify-between gap-3 py-3 text-left text-sm transition-colors ${
                      active ? "text-orange-400" : "text-zinc-300 hover:text-zinc-100"
                    }`}
                  >
                    <span className="truncate font-medium">{a.title}</span>
                    <span className="shrink-0 text-xs text-zinc-600">{time}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
