import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { formatPromoDrawDate, getPromoBannerForPublic } from "@/lib/promo-banner";

export const dynamic = "force-dynamic";

export default async function PromoTermsPage() {
  const promo = await getPromoBannerForPublic();
  const drawLabel = formatPromoDrawDate(promo.drawAt);
  const prize = promo.prizeLabel || "1 SOL";

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Promo terms — {prize} giveaway</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last updated from live admin settings. Draw date: <strong>{drawLabel}</strong>.
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 space-y-4">
            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Promotion</h2>
              <p>
                NovaStaris may run periodic giveaways for registered members. The current promotion offers one (
                1) winner a prize of <strong>{prize}</strong> on the Solana network, subject to these terms.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Eligibility</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Open to individuals with a free NovaStaris account and a verified email address.</li>
                <li>One entry per person. Duplicate, fraudulent, or automated accounts may be disqualified.</li>
                <li>No purchase or paid subscription is required to enter.</li>
                <li>Account must be created before the draw cutoff ({drawLabel}).</li>
                <li>Void where prohibited by law. You must be at least 18 years old (or the age of majority in your jurisdiction).</li>
              </ul>
            </section>
            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Draw &amp; winner</h2>
              <p className="text-sm">
                After {drawLabel}, NovaStaris will select one (1) eligible entrant at random from qualifying free
                accounts. The winner will be contacted by email and must provide a valid Solana wallet address
                within fourteen (14) days to receive {prize}. If the winner does not respond, NovaStaris may select
                an alternate winner.
              </p>
            </section>
            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">General</h2>
              <p className="text-sm">
                NovaStaris may modify, suspend, or end this promotion at any time. This giveaway is not sponsored
                by Solana Foundation or any exchange. Cryptocurrency prizes may fluctuate in value. By creating a
                free account during the promo period you agree to these terms and our{" "}
                <Link href="/terms" className="text-cyan-600 dark:text-cyan-400 underline">
                  Terms of Service
                </Link>
                .
              </p>
            </section>
            {!promo.active && (
              <p className="text-sm text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/40 rounded-md px-3 py-2">
                This promotion is not currently active on the site. Terms remain for reference.
              </p>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/register" className="underline">
            Sign up free
          </Link>
          {" · "}
          <Link href="/" className="underline">
            Back to app
          </Link>
        </p>
      </div>
    </div>
  );
}
