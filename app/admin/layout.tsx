import type { ReactNode } from "react";

/**
 * Admin is all client-heavy dashboards. Forcing dynamic rendering ensures Vercel
 * emits server routes/lambdas for each segment (avoids "Unable to find lambda for route").
 */
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
