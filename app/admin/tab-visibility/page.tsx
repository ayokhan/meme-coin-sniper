"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { TAB_SHORT_LABELS } from "@/lib/dashboard-tabs";
import {
  DEFAULT_TAB_OWNER_ONLY,
  OWNER_ONLY_MANAGED_TABS,
  type OwnerOnlyManagedTab,
  type TabOwnerOnlyAdmin,
} from "@/lib/tab-owner-only";

const EXTRA_LABELS: Partial<Record<OwnerOnlyManagedTab, string>> = {
  "nova-job-agent": "Jobs Agent",
};

function tabLabel(id: OwnerOnlyManagedTab): string {
  return EXTRA_LABELS[id] ?? TAB_SHORT_LABELS[id as keyof typeof TAB_SHORT_LABELS] ?? id;
}

export default function AdminTabVisibilityPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_TAB_OWNER_ONLY.ownerOnlyTabs));
  const [meta, setMeta] = useState<{ usesDefault: boolean; updatedAt: string | null }>({
    usesDefault: true,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tab-owner-only", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      const cfg = data.config as TabOwnerOnlyAdmin;
      setSelected(new Set(cfg.ownerOnlyTabs));
      setMeta({ usesDefault: !!cfg.usesDefault, updatedAt: cfg.updatedAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async (opts?: { reset?: boolean }) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = opts?.reset
        ? { resetToDefault: true }
        : { ownerOnlyTabs: Array.from(selected) };
      const res = await fetch("/api/admin/tab-owner-only", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      const cfg = data.config as TabOwnerOnlyAdmin;
      setSelected(new Set(cfg.ownerOnlyTabs));
      setMeta({ usesDefault: !!cfg.usesDefault, updatedAt: cfg.updatedAt });
      setNotice(opts?.reset ? "Reset to defaults (Online Boss owner-only)." : "Saved.");
      setTimeout(() => setNotice(""), 3500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to manage tab visibility."}
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

  return (
    <div className="max-w-3xl space-y-6">
      <AdminPageHeader
        title="Tab visibility"
        description="Mark any dashboard tab as Owner only — everyone else will not see it. Master On/Off still lives under Feature flags (page_tab_*)."
      />

      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Owner-only tabs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Checked = visible only to you (owner). Unchecked = normal audience rules (VIP / free / feature flags).
            Default keeps Online Boss (chris-clayton) owner-only.
          </p>
          <p className="text-xs text-muted-foreground">
            {meta.usesDefault ? "Using defaults (not customized)." : "Custom list saved."}
            {meta.updatedAt ? ` Updated ${new Date(meta.updatedAt).toLocaleString()}.` : ""}
          </p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {OWNER_ONLY_MANAGED_TABS.map((id) => (
                <label
                  key={id}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selected.has(id)}
                    onChange={() => toggle(id)}
                  />
                  <span className="font-medium">{tabLabel(id)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{id}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" disabled={saving || loading} onClick={() => save()}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || loading}
              onClick={() => {
                if (confirm("Reset to defaults (Online Boss owner-only only)?")) void save({ reset: true });
              }}
            >
              Reset to defaults
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/feature-flags">Feature flags (On/Off)</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
