"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Zap, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, adminNavByGroup } from "@/lib/admin-nav-config";
import { canAccessDelegatedAdminPath, getDelegatedAdminNavHrefs } from "@/lib/admin-access";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const delegatedHrefs = getDelegatedAdminNavHrefs(session);
  const delegatedOnly = Array.isArray(delegatedHrefs) && delegatedHrefs.length > 0;

  useEffect(() => {
    if (!session || !delegatedOnly || !delegatedHrefs) return;
    if (pathname.startsWith("/admin") && !canAccessDelegatedAdminPath(session, pathname)) {
      router.replace(delegatedHrefs[0]);
    }
  }, [session, delegatedOnly, delegatedHrefs, pathname, router]);

  const grouped = adminNavByGroup();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const visibleItems = delegatedOnly
    ? ADMIN_NAV_ITEMS.filter((item) => delegatedHrefs!.includes(item.href))
    : ADMIN_NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);
  const visibleGroups = delegatedOnly
    ? ADMIN_NAV_GROUPS.filter((g) => visibleItems.some((item) => item.group === g.id))
    : ADMIN_NAV_GROUPS;

  const headerLabel = useMemo(() => {
    if (!delegatedOnly) return "Admin";
    if (visibleItems.length === 1) return visibleItems[0].label;
    return "Admin";
  }, [delegatedOnly, visibleItems]);

  const nav = (
    <nav className="flex flex-col gap-5 py-4">
      {visibleGroups.map((g) => {
        const items = delegatedOnly ? visibleItems.filter((item) => item.group === g.id) : grouped[g.id];
        if (items.length === 0) return null;
        return (
          <div key={g.id}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {g.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 font-medium border border-cyan-500/30"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-cyan-600 dark:text-cyan-400" : "text-zinc-500"}`} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-md border border-zinc-200 dark:border-zinc-700"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-zinc-900 dark:text-zinc-100">
              <Zap className="h-5 w-5 text-amber-500" />
              NovaStaris
            </Link>
            <span className="hidden sm:inline text-zinc-400">/</span>
            <span className="hidden sm:inline text-sm font-semibold text-cyan-700 dark:text-cyan-300">
              {headerLabel}
            </span>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex">
        <aside
          className={`${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:sticky top-[57px] left-0 z-30 h-[calc(100vh-57px)] w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto transition-transform lg:block`}
        >
          {nav}
        </aside>
        {mobileOpen && (
          <button
            type="button"
            className="lg:hidden fixed inset-0 top-[57px] z-20 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <main className="flex-1 min-w-0 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
