import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export const metadata = {
  title: "Payment Terms and Conditions — NovaStaris",
  description: "Payment terms for NovaStaris VIP and Nova Pro subscriptions. No refund after 24 hours of use.",
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
              <strong>Nova Pro refunds.</strong> Nova Pro purchases are refundable only if you request a refund
              within 24 hours of activation <strong>and</strong> have used no more than 2 AI / Nova Pulse runs in
              that time (the exact run threshold is shown at checkout and on Subscribe). The $8 card processing fee
              is not refundable. After 24 hours, or once the run threshold is exceeded, Nova Pro is non-refundable.
              Complimentary (admin-granted) Nova Pro is not eligible for refunds.
            </p>
            <p>
              <strong>Nova Pro usage limits.</strong> Nova Pro includes the VIP AI desks with a shared daily limit
              (default 7 AI runs per day across all desks) and a separate Nova Pulse limit (default 5 runs per
              day). Limits reset at 00:00 UTC and may be adjusted; the current limits are shown on Subscribe. Nova
              Pro does not include Coach Calls or any bots (NovaScalper, Forex Bots, GMGN VIP Bot, Prop Firm,
              Nova Ultimate, Polymarket). If you upgrade from Nova Pro to VIP, the unused value of your paid Nova
              Pro period is credited toward VIP (as extra VIP days for one-time payments, or as a credit on your
              next auto-renew invoice).
            </p>
            <p>
              <strong>Founding Nova Pro (limited edition).</strong> A limited number of early Nova Pro
              subscribers receive Founding member status. Founding members keep the price they first paid for as
              long as they keep renewing without a gap of more than 7 days. Founding status is not transferable.
            </p>
            <p>
              <strong>VIP Strategy Session promo.</strong> While this promotional offer is active (end date
              shown on Subscribe and in the in-app announcement), a new paid VIP subscription may include one
              complimentary 30-minute strategy session with a NovaStaris coach (list value shown in the offer —
              currently aligned with the paid Strategy call price). You should book and complete the
              session within 7 days of your VIP activation. After you complete that session, if you are not
              satisfied you may cancel VIP within 3 days of the session and request a 100% refund of the
              subscription fee paid for that qualifying purchase. This is a satisfaction guarantee tied to the
              coaching session — <strong>not</strong> a guarantee of trading profits or that you will
              &quot;make your fee back&quot; in the markets. Complimentary admin grants, unpaid trials that never
              convert to a paid charge, and renewals outside the promo window are not eligible unless we expressly
              say otherwise in writing. Refunds are processed by support after verification.{" "}
              <strong>Educational only — not financial advice.</strong> NovaStaris and its coaches do not provide
              personalized investment advice; you remain solely responsible for your trading decisions.
            </p>
            <p>
              <strong>Subscription period.</strong> Your access is valid for the period corresponding to the plan you purchased (e.g. 1 month, 6 months, 12 months). Access continues until the end of that period; we do not prorate refunds for early cancellation.
            </p>
            <p>
              <strong>VIP free trial (card).</strong> When you start a VIP trial, you must add a valid payment
              card. The trial lasts for the free period shown at checkout (for example 2 or 3 days). Before the
              trial ends we send a reminder email so you can cancel.{" "}
              <strong>
                If you do not cancel before the trial ends, your card is charged automatically for the VIP plan
                you selected (list price + $8 card fee), and VIP then renews automatically until you cancel.
              </strong>{" "}
              For example, the default 1-month VIP plan after trial is $150 + $8 card fee ($158 total). Other
              plan lengths use their listed USDC price plus the $8 card fee. Cancelling stops future charges; it
              does not refund time already used. Complimentary admin grants (including Limited VIP) are not card
              trials and are not billed unless you later subscribe.
            </p>
            <p>
              <strong>Payment methods.</strong> We accept credit/debit card (via Stripe) and USDC on Solana. USDC payments are charged at the listed subscription price. Card payments include an additional $8 card payment fee per checkout. You are responsible for providing accurate payment details and for any fees charged by your bank or wallet.
            </p>
            <p>
              <strong>Current list prices (USDC).</strong> VIP: $150/month, $750/6 months, $1,500/12 months. Nova
              Pro (when available): $50/month, $250/6 months, $500/12 months. Card checkout adds $8 to these amounts
              (for example Nova Pro monthly is $58 by card or $50 with USDC).
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
