"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, CheckCircle } from "lucide-react";

function SupportForm() {
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [supportNumber, setSupportNumber] = useState<string | null>(null);

  useEffect(() => {
    const subject = searchParams.get("subject");
    if (subject) setTitle(decodeURIComponent(subject));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSupportNumber(data.supportNumber);
      setTitle("");
      setMessage("");
      setName("");
      setEmail("");
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <div className="flex gap-4">
            <Link href="/chat" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              Chat
            </Link>
            <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Support
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          Send us your question or issue and we’ll get back to you as soon as we can.
        </p>

        {supportNumber ? (
          <Card className="rounded-2xl border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300 mb-4">
                <CheckCircle className="h-8 w-8 shrink-0" />
                <span className="font-semibold text-lg">Request received</span>
              </div>
              <p className="text-zinc-700 dark:text-zinc-300 mb-2">
                Your support reference number is: <strong className="font-mono text-zinc-900 dark:text-zinc-100">{supportNumber}</strong>
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                A member of our support team will review your message and respond within 48 hours. Please keep this reference number for your records.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => setSupportNumber(null)}
              >
                Submit another request
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-zinc-200/90 dark:border-zinc-800/90 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm shadow-lg overflow-hidden">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                    {error}
                  </div>
                )}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Subject
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Brief summary of your question or issue"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y"
                    placeholder="Describe your question or issue in detail..."
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? "Sending…" : "Send message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center">
          <Link href="/chat" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            Prefer to chat? Talk to Nja, our AI assistant →
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center"><p className="text-zinc-500">Loading…</p></div>}>
      <SupportForm />
    </Suspense>
  );
}
