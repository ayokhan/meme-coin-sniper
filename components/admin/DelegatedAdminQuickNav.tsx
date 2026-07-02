"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ADMIN_NAV_ITEMS } from "@/lib/admin-nav-config";

/** Owner-only horizontal shortcuts. Delegated staff use the sidebar (assigned pages only). */
export default function DelegatedAdminQuickNav() {
  const { data: session } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  if (!isOwner) return null;

  return (
    <div className="flex gap-4 mb-4 flex-wrap">
      <Link href="/admin" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
        Nova Admin hub
      </Link>
      {ADMIN_NAV_ITEMS.filter((item) => item.href !== "/admin").map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
        >
          {item.href === "/admin/support" ? "Support tickets" : item.label}
        </Link>
      ))}
    </div>
  );
}
