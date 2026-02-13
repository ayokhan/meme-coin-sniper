"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Send, Bot, User, Headphones } from "lucide-react";

const NJA_INTRO =
  "Hi! I'm Nja, your AI assistant for NovaStaris. I'm here to help with any questions or issues. How can I assist you today?";

const NJA_ASK_NAME = "May I have your name?";
const NJA_ASK_EMAIL = "Thanks! What's your email address?";
const NJA_ASK_ISSUE = "What do you need help with? Please describe your question or issue in a few words.";
const NJA_CHOICE_LIVE = "A live support agent is available. Would you like to chat with them now, or have us get back to you within 48 hours?";
const NJA_CHOICE_OFFLINE = "No live agent is available right now. I'll send your details to our team and we'll get back to you within 48 hours. Would you like me to do that?";

type Message = { id: string; role: string; content: string; createdAt: string };

export default function ChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"nja" | "live" | "submitted">("nja");
  const [messages, setMessages] = useState<Message[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [supportNumber, setSupportNumber] = useState<string | null>(null);
  const [requestingLive, setRequestingLive] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const customerCount = messages.filter((m) => m.role === "customer").length;
  const step = customerCount === 0 ? "name" : customerCount === 1 ? "email" : customerCount === 2 ? "issue" : "choice";
  const showChoice = step === "choice" && status === "nja";
  const isLive = status === "live";
  const isSubmitted = status === "submitted";

  const ensureSession = async () => {
    const res = await fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? "Failed to load chat");
    const sid = data.sessionId;
    setSessionId(sid);
    setStatus(data.status);
    setMessages(data.messages ?? []);
    setCustomerName(data.customerName ?? "");
    setCustomerEmail(data.customerEmail ?? "");
    if ((data.messages ?? []).length === 0 && data.status === "nja") {
      await fetch("/api/chat/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sid, role: "nja", content: NJA_INTRO }) });
      await fetch("/api/chat/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sid, role: "nja", content: NJA_ASK_NAME }) });
      const msgRes = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(sid)}`);
      const msgData = await msgRes.json();
      if (msgData.success && msgData.messages?.length) setMessages(msgData.messages);
    }
  };

  const fetchPresence = () => {
    fetch("/api/chat/presence")
      .then((r) => r.json())
      .then((d) => setAgentOnline(!!d.online))
      .catch(() => setAgentOnline(false));
  };

  const checkPresenceNow = (): Promise<boolean> =>
    fetch("/api/chat/presence")
      .then((r) => r.json())
      .then((d) => !!d.online)
      .catch(() => false);

  const fetchMessages = () => {
    if (!sessionId) return;
    fetch(`/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.messages?.length) setMessages(d.messages);
      })
      .catch(() => {});
  };

  useEffect(() => {
    ensureSession()
      .then(() => fetchPresence())
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);


  useEffect(() => {
    if (!isLive || !sessionId) return;
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isLive, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, name?: string, email?: string) => {
    if (!sessionId || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          role: "customer",
          content: text.trim(),
          ...(name !== undefined && { customerName: name }),
          ...(email !== undefined && { customerEmail: email }),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to send");
        return;
      }
      setInput("");
      if (isLive) {
        fetchMessages();
        return;
      }
      if (step === "name") setCustomerName(text.trim());
      if (step === "email") setCustomerEmail(text.trim());

      const nextStep = step === "name" ? "email" : step === "email" ? "issue" : "choice";
      const onlineNow = nextStep === "choice" ? await checkPresenceNow() : agentOnline;
      if (nextStep === "choice") setAgentOnline(onlineNow);
      const nextNjaContent =
        nextStep === "email"
          ? NJA_ASK_EMAIL
          : nextStep === "issue"
            ? NJA_ASK_ISSUE
            : onlineNow
              ? NJA_CHOICE_LIVE
              : NJA_CHOICE_OFFLINE;
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "nja", content: nextNjaContent }),
      });
      fetchMessages();
    } catch {
      setError("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleRequestLive = async (preferSubmitOnly: boolean) => {
    if (!sessionId) return;
    setRequestingLive(true);
    setError("");
    try {
      const res = await fetch("/api/chat/request-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customerName: customerName || undefined,
          customerEmail: customerEmail || undefined,
          preferSubmit: preferSubmitOnly,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed");
        return;
      }
      if (data.transferred) {
        setStatus("live");
        fetchMessages();
      } else {
        setStatus("submitted");
        setSupportNumber(data.supportNumber ?? null);
        fetchMessages(); // show Nja "live agent offline" message
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setRequestingLive(false);
    }
  };

  const displayMessages = (): Message[] => messages;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Loading chat…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <div className="flex gap-4">
            <Link href="/support" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              Support form
            </Link>
            <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-violet-500" />
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Chat with Nja</h1>
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Headphones className="h-3.5 w-3.5" /> Live support
            </span>
          )}
        </div>

        {isSubmitted && supportNumber ? (
          <Card className="rounded-2xl border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 overflow-hidden flex-1">
            <CardContent className="p-6">
              <p className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                Your request has been sent.
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-2">
                Reference number: <strong className="font-mono">{supportNumber}</strong>
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                A member of our support team will review your message and respond within 48 hours. Thank you for reaching out.
              </p>
              <Link href="/">
                <Button variant="outline" className="mt-4">Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 min-h-[200px] mb-4">
              {displayMessages().map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2 ${m.role === "customer" ? "justify-end" : "justify-start"}`}
                >
                  {m.role !== "customer" && (
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                      m.role === "customer"
                        ? "bg-cyan-500 text-white"
                        : m.role === "agent"
                          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                          : "bg-violet-100 dark:bg-violet-900/40 text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    {m.role === "agent" && (
                      <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Support Agent</span>
                    )}
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  </div>
                  {m.role === "customer" && (
                    <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {showChoice && (
              <div className="flex flex-wrap gap-2 mb-4">
                {agentOnline && (
                  <Button
                    onClick={() => handleRequestLive(false)}
                    disabled={requestingLive}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {requestingLive ? "Connecting…" : "Talk to live agent"}
                  </Button>
                )}
                <Button
                  variant={agentOnline ? "outline" : "default"}
                  onClick={() => handleRequestLive(true)}
                  disabled={requestingLive}
                  title="We'll create a ticket and get back to you within 48 hours"
                >
                  {requestingLive ? "Sending…" : "Get back to me in 48 hours"}
                </Button>
              </div>
            )}

            {!showChoice && !isSubmitted && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const t = input.trim();
                  if (!t || sending) return;
                  if (step === "name") sendMessage(t, t, undefined);
                  else if (step === "email") sendMessage(t, undefined, t);
                  else sendMessage(t);
                }}
              >
                <input
                  type={step === "email" ? "email" : "text"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    step === "name"
                      ? "Your name"
                      : step === "email"
                        ? "Your email"
                        : isLive
                          ? "Type your message…"
                          : "Describe your question or issue…"
                  }
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}

            {error && (
              <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
