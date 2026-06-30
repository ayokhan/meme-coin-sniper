import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export const metadata = {
  title: "Payment Terms and Conditions — NovaStaris",
  description: "Payment terms for NovaStaris subscriptions. No refund after 24 hours of use.",
};

export default function PaymentTermsPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-cyan-500" />
          NovaStaris
        </Link>
        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>Payment Terms and Conditions</CardTitle>
            <p className="text-sm text-muted-foreground">Applicable to all subscription payments (card and USDC).</p>
          </CardHeader>
          <CardContent className="prose prose-zinc dark:prose-invert max-w-none text-sm space-y-4">
            <p>
              By completing a subscription payment to NovaStaris, you agree to the following payment terms.
            </p>
            <p>
              <strong>No refund after 24 hours of use.</strong> Once you have used the service for more than 24 hours after your subscription is activated, you are not entitled to a refund. Refund requests made within the first 24 hours of use may be considered at our discretion and are not guaranteed.
            </p>
            <p>
              <strong>Subscription period.</strong> Your access is valid for the period corresponding to the plan you purchased (e.g. 1 month, 6 months, 12 months). Access continues until the end of that period; we do not prorate refunds for early cancellation.
            </p>
            <p>
              <strong>Payment methods.</strong> We accept credit/debit card (via Stripe) and USDC on Solana. USDC payments are charged at the listed subscription price. Card payments include an additional $8 card payment fee per checkout, except the VIP 1-day trial ($20 on card or USDC). You are responsible for providing accurate payment details and for any fees charged by your bank or wallet.
            </p>
            <p>
              <strong>Current list prices (USDC).</strong> Pro: $70/month, $350/6 months, $700/12 months. VIP: $20/1-day trial, $150/month, $750/6 months, $1,500/12 months. Card checkout adds $8 to these amounts except the VIP 1-day trial.
            </p>
            <p>
              By clicking &quot;I agree to the Payment Terms and Conditions&quot; and completing payment, you confirm that you have read and accept these terms.
            </p>
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/subscribe" className="underline hover:no-underline">Back to Subscribe</Link>
          {" · "}
          <Link href="/" className="underline hover:no-underline">Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
