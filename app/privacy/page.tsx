import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import SiteInstagramFooter from "@/components/SiteInstagramFooter";

export const metadata = {
  title: "Privacy Policy — NovaStaris",
  description:
    "How NovaStaris collects, uses, stores, and protects personal data for the web app and Android app.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-cyan-500" />
          NovaStaris
        </Link>
        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Last updated: September 21, 2026 · Applies to novastaris.ai and the NovaStaris Android app
              (ai.novastaris.app).
            </p>
          </CardHeader>
          <CardContent className="prose prose-zinc dark:prose-invert max-w-none text-sm space-y-4">
            <p>
              This Privacy Policy explains what personal data NovaStaris (“we”, “us”) collects, why we collect
              it, how we handle it securely, who we share it with, how long we keep it, and what choices you
              have. By creating an account or using NovaStaris, you agree to this policy.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">1. Who we are</h2>
            <p>
              NovaStaris is an AI trading intelligence / research workspace. We provide software tools and
              information. We are not a broker, exchange, bank, or investment adviser, and we do not execute
              trades on your behalf.
            </p>
            <p>
              Contact for privacy requests:{" "}
              <a href="mailto:novastaris.ai@gmail.com" className="underline">
                novastaris.ai@gmail.com
              </a>
              .
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              2. Personal data we collect
            </h2>
            <p>Depending on how you use NovaStaris, we may collect:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>
                <strong>Account data:</strong> email address, name (if provided), password (stored hashed),
                profile details you choose to add.
              </li>
              <li>
                <strong>Authentication data:</strong> sign-in method (e.g. email/password or Google), session
                tokens/cookies, optional two-factor authentication settings.
              </li>
              <li>
                <strong>Billing &amp; subscription data:</strong> plan type, subscription status, payment
                timestamps, invoice/receipt references. Card payments are processed by Stripe; we do not store
                full card numbers on our servers. USDC payments may include a public blockchain transaction
                signature you submit for verification.
              </li>
              <li>
                <strong>Product usage data:</strong> features you open, in-app actions needed to operate the
                service, approximate device/browser type, and diagnostics such as crash or error logs.
              </li>
              <li>
                <strong>Communications:</strong> support messages, emails you send us, and newsletter/digest
                preferences if you opt in.
              </li>
              <li>
                <strong>Optional trading-related inputs you provide:</strong> e.g. wallet addresses you choose
                to track, exchange/broker connection settings you configure, phone number if you book a
                Discovery or Strategy call.
              </li>
              <li>
                <strong>Community (NovaConnect):</strong> display name and content you post if you join
                community features, subject to community rules.
              </li>
            </ul>
            <p>
              We do not require access to your device contacts, microphone, or camera for core product use.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              3. How we use personal data
            </h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>Create and secure your account, authenticate you, and prevent abuse</li>
              <li>Provide the NovaStaris product (web and Android)</li>
              <li>Process subscriptions, payments, refunds, and related receipts</li>
              <li>Send transactional emails (welcome, billing, security, support)</li>
              <li>Send marketing/newsletter emails only if you opt in (you can unsubscribe anytime)</li>
              <li>Improve reliability, fix bugs, and understand feature usage</li>
              <li>Comply with law and enforce our Terms</li>
            </ul>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              4. Secure data handling procedures
            </h2>
            <p>We use industry-standard practices to protect personal and sensitive user data, including:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>
                <strong>Encryption in transit:</strong> HTTPS/TLS for the website and Android app connection
                to our servers.
              </li>
              <li>
                <strong>Access controls:</strong> account authentication; administrative access limited to
                authorized operators.
              </li>
              <li>
                <strong>Password security:</strong> passwords are stored using modern hashing (not plain text).
              </li>
              <li>
                <strong>Payment security:</strong> card data is handled by Stripe; we avoid storing full
                payment card PANs.
              </li>
              <li>
                <strong>Least-privilege sharing:</strong> service providers receive only what is needed to
                operate NovaStaris.
              </li>
              <li>
                <strong>Monitoring:</strong> we review security-relevant errors and may revoke sessions or
                disable accounts when abuse or compromise is suspected.
              </li>
            </ul>
            <p>
              No method of transmission or storage is 100% secure. If we become aware of a breach affecting
              your personal data, we will take reasonable steps to notify you and/or regulators where required
              by law.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              5. Sharing and third-party processors
            </h2>
            <p>
              We do <strong>not sell</strong> your personal information. We may share data with processors
              that help us run the service, for example:
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>Hosting / infrastructure (e.g. Vercel and database providers)</li>
              <li>Email delivery (e.g. Resend or similar)</li>
              <li>Payments (Stripe for cards)</li>
              <li>Authentication providers (e.g. Google sign-in if you choose it)</li>
              <li>Analytics or crash reporting tools if enabled</li>
            </ul>
            <p>
              These providers process data under their own terms/privacy policies and our operational
              instructions. Public blockchain transactions you initiate are inherently public.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">6. Retention</h2>
            <p>
              We keep account and billing records for as long as your account is active and as needed for
              legal, tax, fraud-prevention, and dispute-resolution purposes. You may request deletion of
              account data (see below); some records may be retained where law requires.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              7. Your choices and rights
            </h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
              <li>Update profile information in Account settings where available</li>
              <li>Opt out of marketing emails via unsubscribe links or Account preferences</li>
              <li>
                Request access, correction, or deletion of personal data by emailing{" "}
                <a href="mailto:novastaris.ai@gmail.com" className="underline">
                  novastaris.ai@gmail.com
                </a>
              </li>
              <li>Delete your account using in-app Account controls when that feature is enabled</li>
            </ul>
            <p>
              Depending on where you live (e.g. EEA/UK GDPR, California CCPA/CPRA), you may have additional
              rights. Contact us to exercise them. We will not discriminate against you for making a valid
              privacy request.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              8. Children
            </h2>
            <p>
              NovaStaris is intended for adults (18+). We do not knowingly collect personal data from children
              under 13 (or under 16 where stricter rules apply). If you believe a child provided data, contact
              us and we will delete it.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              9. International transfers
            </h2>
            <p>
              We may process data in the United States and other countries where our providers operate. Those
              countries may have different data-protection laws than your home country.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              10. Android app specifics
            </h2>
            <p>
              The NovaStaris Android app loads the NovaStaris service over a secure connection to
              novastaris.ai. The same account, privacy practices, and data categories apply. App store
              billing rules may apply separately if you purchase through Google Play; web subscriptions are
              managed on novastaris.ai.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">
              11. Changes to this policy
            </h2>
            <p>
              We may update this Privacy Policy. We will post the updated version on this page with a new
              “Last updated” date. Continued use after changes means you accept the updated policy.
            </p>

            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 pt-2">12. Contact</h2>
            <p>
              Privacy questions or requests:{" "}
              <a href="mailto:novastaris.ai@gmail.com" className="underline">
                novastaris.ai@gmail.com
              </a>
              .
            </p>
            <p>
              Related pages:{" "}
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>
              {" · "}
              <Link href="/payment-terms" className="underline">
                Payment Terms
              </Link>
              .
            </p>
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">
            Back to app
          </Link>
        </p>
        <SiteInstagramFooter className="border-0 pt-4 pb-0" />
      </div>
    </div>
  );
}
