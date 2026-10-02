import Link from "next/link";
import { verifyUnsubscribeToken } from "@/lib/email-links";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe · NovaStaris", robots: { index: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const email = first(sp.e);
  const token = first(sp.t);
  const done = first(sp.done) === "1";
  const failed = first(sp.error) === "1";
  const valid = !done && !failed && (await verifyUnsubscribeToken(email, token));

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {done ? "You're unsubscribed" : failed ? "Something went wrong" : "Unsubscribe from NovaStaris emails"}
        </h1>
        {done && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {email ? <strong>{email}</strong> : "This address"} won&apos;t get marketing emails from us anymore. You&apos;ll still
            get account emails such as password resets and payment receipts.
          </p>
        )}
        {failed && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            This link is invalid or expired. Turn off the newsletter in your account settings, or reply to any of our emails and
            we&apos;ll remove you.
          </p>
        )}
        {!done && !failed && valid && (
          <>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Stop marketing emails to <strong>{email}</strong>? Account emails (password resets, receipts) will still arrive.
            </p>
            <form
              method="post"
              action={`/api/email/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}&form=1`}
              className="mt-6"
            >
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium hover:opacity-90"
              >
                Unsubscribe
              </button>
            </form>
          </>
        )}
        {!done && !failed && !valid && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            This unsubscribe link is invalid. Turn off the newsletter in your account settings, or reply to any of our emails and
            we&apos;ll remove you.
          </p>
        )}
        <p className="mt-8 text-xs text-zinc-500">
          <Link href="/" className="underline">
            Back to NovaStaris
          </Link>
        </p>
      </div>
    </main>
  );
}
