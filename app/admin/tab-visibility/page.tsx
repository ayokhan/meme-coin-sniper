"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { TAB_SHORT_LABELS } from "@/lib/dashboard-tabs";
import {
  DEFAULT_TAB_OWNER_ONLY,
  OWNER_ONLY_MANAGED_TABS,
  type TabOwnerOnlyAdmin,
} from "@/lib/tab-owner-only";
import { TAB_NEW_BADGE_OPTIONS, type TabNewBadgeAdminRow } from "@/lib/tab-new-badges";
import {
  PRODUCT_VISIBILITY_FLAG_ROWS,
  PRODUCT_VISIBILITY_SUBTAB_FLAGS,
} from "@/lib/product-visibility";

const EXTRA_LABELS: Partial<Record<string, string>> = {
  "nova-job-agent": "Jobs Agent",
  "demo-sessions": "Demo sessions",
  wins: "Wins",
};

function tabLabel(id: string): string {
  return (
    EXTRA_LABELS[id] ??
    TAB_SHORT_LABELS[id as keyof typeof TAB_SHORT_LABELS] ??
    PRODUCT_VISIBILITY_FLAG_ROWS.find((r) => r.tabId === id)?.label ??
    id
  );
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export default function AdminProductVisibilityPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;

  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [ownerOnly, setOwnerOnly] = useState<Set<string>>(new Set(DEFAULT_TAB_OWNER_ONLY.ownerOnlyTabs));
  const [ownerMeta, setOwnerMeta] = useState<{ usesDefault: boolean; updatedAt: string | null }>({
    usesDefault: true,
    updatedAt: null,
  });
  const [tabNewRows, setTabNewRows] = useState<TabNewBadgeAdminRow[]>([]);
  const [tabNewDraftDates, setTabNewDraftDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [savingOwner, setSavingOwner] = useState(false);
  const [tabNewSaving, setTabNewSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const newByTab = useMemo(() => {
    const m = new Map<string, TabNewBadgeAdminRow>();
    for (const row of tabNewRows) m.set(row.tabId, row);
    return m;
  }, [tabNewRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [flagsRes, ownerRes, badgesRes] = await Promise.all([
        fetch("/api/admin/feature-flags", { cache: "no-store" }),
        fetch("/api/admin/tab-owner-only", { cache: "no-store" }),
        fetch("/api/admin/tab-new-badges", { cache: "no-store" }),
      ]);
      const flagsData = await flagsRes.json();
      const ownerData = await ownerRes.json();
      const badgesData = await badgesRes.json();
      if (!flagsData.success) throw new Error(flagsData.error ?? "Failed to load flags");
      if (!ownerData.success) throw new Error(ownerData.error ?? "Failed to load owner-only");
      if (!badgesData.success) throw new Error(badgesData.error ?? "Failed to load NEW badges");
      setFlags(flagsData.flags ?? {});
      const cfg = ownerData.config as TabOwnerOnlyAdmin;
      setOwnerOnly(new Set(cfg.ownerOnlyTabs));
      setOwnerMeta({ usesDefault: !!cfg.usesDefault, updatedAt: cfg.updatedAt });
      const rows = (badgesData.rows ?? []) as TabNewBadgeAdminRow[];
      setTabNewRows(rows);
      const drafts: Record<string, string> = {};
      for (const row of rows) drafts[row.tabId] = toDatetimeLocalValue(row.expiresAt);
      setTabNewDraftDates(drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner, load]);

  useEffect(() => {
    if (loading) return;
    const hash = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (!hash) return;
    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [loading]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const toggleFlag = async (key: string) => {
    const next = !(flags[key] ?? true);
    setTogglingFlag(key);
    setError("");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: next }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Update failed");
      setFlags(data.flags ?? {});
      flash(next ? `${key} ON` : `${key} OFF`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setTogglingFlag(null);
    }
  };

  const toggleOwnerOnly = (id: string) => {
    setOwnerOnly((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveOwnerOnly = async (opts?: { reset?: boolean }) => {
    setSavingOwner(true);
    setError("");
    try {
      const body = opts?.reset
        ? { resetToDefault: true }
        : { ownerOnlyTabs: Array.from(ownerOnly) };
      const res = await fetch("/api/admin/tab-owner-only", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      const cfg = data.config as TabOwnerOnlyAdmin;
      setOwnerOnly(new Set(cfg.ownerOnlyTabs));
      setOwnerMeta({ usesDefault: !!cfg.usesDefault, updatedAt: cfg.updatedAt });
      flash(opts?.reset ? "Owner-only reset to defaults." : "Owner-only list saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingOwner(false);
    }
  };

  const patchTabNew = async (tabId: string, expiresAt: string | null) => {
    setTabNewSaving(tabId);
    setError("");
    try {
      const res = await fetch("/api/admin/tab-new-badges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId, expiresAt }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Badge update failed");
      const rows = (data.rows ?? []) as TabNewBadgeAdminRow[];
      setTabNewRows(rows);
      const drafts: Record<string, string> = {};
      for (const row of rows) drafts[row.tabId] = toDatetimeLocalValue(row.expiresAt);
      setTabNewDraftDates(drafts);
      flash(expiresAt ? "NEW badge saved." : "NEW badge turned off.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Badge update failed");
    } finally {
      setTabNewSaving(null);
    }
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to manage product visibility."}
          {!session && (
            <p className="mt-2">
              <Link href="/signin" className="underline text-cyan-600">
                Sign in
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">Owner access only.</CardContent>
      </Card>
    );
  }

  const renderFlagToggle = (flagKey: string) => {
    const enabled = flags[flagKey] ?? true;
    const busy = togglingFlag === flagKey;
    return (
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            enabled
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
          }`}
        >
          {enabled ? "ON" : "OFF"}
        </span>
        <Button size="sm" variant={enabled ? "outline" : "default"} disabled={busy || loading} onClick={() => void toggleFlag(flagKey)}>
          {busy ? "…" : enabled ? "Hide" : "Show"}
        </Button>
      </div>
    );
  };

  const renderNewBadge = (tabId: string) => {
    const row = newByTab.get(tabId);
    if (!row) {
      return <span className="text-[11px] text-muted-foreground">—</span>;
    }
    const busy = tabNewSaving === tabId;
    const draft = tabNewDraftDates[tabId] ?? "";
    return (
      <div className="flex flex-wrap items-end gap-1.5">
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
            row.active
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
              : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
          }`}
        >
          {row.active ? "NEW on" : "NEW off"}
        </span>
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setTabNewDraftDates((prev) => ({ ...prev, [tabId]: e.target.value }))}
          className="text-[11px] border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1 bg-white dark:bg-zinc-800 max-w-[11rem]"
        />
        <Button
          size="sm"
          className="h-7 text-[11px]"
          disabled={busy}
          onClick={() => {
            const iso = fromDatetimeLocalValue(draft);
            if (!iso) {
              setError("Pick a valid NEW expiry, or Turn off.");
              return;
            }
            void patchTabNew(tabId, iso);
          }}
        >
          {busy ? "…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={busy} onClick={() => void patchTabNew(tabId, null)}>
          Off
        </Button>
      </div>
    );
  };

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="Product visibility"
        description="One place for tab On/Off, owner-only locks, and NEW badges. Other kill-switches stay under Feature flags."
      />

      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-white dark:bg-zinc-900/40">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">Show / Hide</p>
          <p className="mt-1 text-muted-foreground">Master <span className="font-mono">page_tab_*</span> switch. Off = gone for everyone.</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-white dark:bg-zinc-900/40">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">Owner only</p>
          <p className="mt-1 text-muted-foreground">Checked = only you see it (VIP/free still need Show ON).</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 bg-white dark:bg-zinc-900/40">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">NEW badge</p>
          <p className="mt-1 text-muted-foreground">Green pill until the expiry you set (local time).</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dashboard tabs</CardTitle>
          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading…"
              : ownerMeta.usesDefault
                ? "Owner-only using defaults (Online Boss)."
                : `Owner-only customized${ownerMeta.updatedAt ? ` · ${new Date(ownerMeta.updatedAt).toLocaleString()}` : ""}.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden sm:grid grid-cols-[minmax(0,1.2fr)_auto_auto_minmax(0,1.4fr)] gap-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span>Tab</span>
            <span>Show</span>
            <span>Owner only</span>
            <span>NEW badge</span>
          </div>
          {PRODUCT_VISIBILITY_FLAG_ROWS.map((row) => {
            const canOwnerOnly = (OWNER_ONLY_MANAGED_TABS as readonly string[]).includes(row.tabId);
            return (
              <div
                key={row.flagKey}
                id={`vis-${row.tabId}`}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 p-3 grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_auto_auto_minmax(0,1.4fr)] sm:items-center"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.label}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{row.flagKey}</p>
                </div>
                {renderFlagToggle(row.flagKey)}
                <div>
                  {canOwnerOnly ? (
                    <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={ownerOnly.has(row.tabId)}
                        onChange={() => toggleOwnerOnly(row.tabId)}
                      />
                      Owner
                    </label>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </div>
                {renderNewBadge(row.tabId)}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2 pt-3">
            <Button size="sm" disabled={savingOwner || loading} onClick={() => void saveOwnerOnly()}>
              {savingOwner ? "Saving…" : "Save owner-only list"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={savingOwner || loading}
              onClick={() => {
                if (confirm("Reset owner-only to defaults (Online Boss only)?")) void saveOwnerOnly({ reset: true });
              }}
            >
              Reset owner-only
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/feature-flags">Other feature flags</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Wallet subtabs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRODUCT_VISIBILITY_SUBTAB_FLAGS.map((row) => (
            <div
              key={row.flagKey}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{row.flagKey}</p>
              </div>
              {renderFlagToggle(row.flagKey)}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Other tabs (no page_tab flag)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Master switch lives under Feature flags (e.g. Nova Eagle). Owner-only and NEW badge still controlled here.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {(() => {
            const covered = new Set(PRODUCT_VISIBILITY_FLAG_ROWS.map((r) => r.tabId));
            const ids = new Set<string>([
              ...OWNER_ONLY_MANAGED_TABS.filter((id) => !covered.has(id)),
              ...TAB_NEW_BADGE_OPTIONS.filter((o) => !covered.has(o.id)).map((o) => o.id),
            ]);
            return Array.from(ids).map((id) => {
              const canOwnerOnly = (OWNER_ONLY_MANAGED_TABS as readonly string[]).includes(id);
              const badgeLabel = TAB_NEW_BADGE_OPTIONS.find((o) => o.id === id)?.label;
              return (
                <div
                  key={id}
                  id={`vis-${id}`}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 p-3 grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.4fr)] sm:items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {badgeLabel ?? tabLabel(id)}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">{id}</p>
                  </div>
                  <div>
                    {canOwnerOnly ? (
                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={ownerOnly.has(id)}
                          onChange={() => toggleOwnerOnly(id)}
                        />
                        Owner only
                      </label>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </div>
                  {renderNewBadge(id)}
                </div>
              );
            });
          })()}
          <div className="pt-3">
            <Button size="sm" disabled={savingOwner || loading} onClick={() => void saveOwnerOnly()}>
              {savingOwner ? "Saving…" : "Save owner-only list"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
