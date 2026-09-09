import type { Metadata } from "next";
import { Suspense } from "react";
import StrategyCallClient, { StrategyCallPageShell } from "@/components/StrategyCallClient";

export const metadata: Metadata = {
  title: "Strategy call | NovaStaris",
  description:
    "Book a 30-minute paid Strategy call with a NovaStaris coach — $150 USD. Pay securely, then we contact you within 24 hours to schedule.",
};

export default function StrategyCallPage() {
  return (
    <StrategyCallPageShell>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <StrategyCallClient />
      </Suspense>
    </StrategyCallPageShell>
  );
}
