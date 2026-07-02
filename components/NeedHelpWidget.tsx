"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Bot, User, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_SUPPORT_AGENT_NAME } from "@/lib/support-agent";
import { VIP_PLANS, CARD_PAYMENT_FEE_USD, getCardPriceForPlan } from "@/lib/subscription";

const WELCOME = "Hi, I'm Nja, your AI assistant for NovaStaris. I'm here to help anytime, anywhere.";
const ASK_START = "Ask me a question to get started.";
const NJA_INTRO =
  "Hello! I'm Nja, your AI assistant for NovaStaris—your advanced AI-powered platform for tracking and analyzing crypto tokens. I'm here to help you with questions about our products, VIP subscription, or technical support. What would you like to know?";
const NJA_ASK_NAME = "Thank you. May I have your name?";
const NJA_ASK_EMAIL = "Thanks! What's your email address?";
const NJA_ASK_ISSUE = "What do you need help with? Please describe your question or issue briefly.";
const NJA_AFTER_OPTION = "I'd be glad to help. To get you to the right place, may I have your name?";
const NJA_CHOICE_LIVE = "A live support agent is available. Would you like to chat with them now, or have us get back to you within 48 hours?";
const NJA_CHOICE_OFFLINE = "No live agent is available right now. I'll send your details to our team and we'll get back to you within 48 hours. Would you like me to do that?";
const NJA_PRODUCT_OVERVIEW =
  "NovaStaris is an AI-powered platform that helps you discover and evaluate new crypto tokens. Key features include: Surge (volume and momentum), NovaStaris AI Agent, Crypto Futures tools, and—on VIP—CT Scan, Profitable Traders Wallet Tracker, and Coach Calls + Telegram Signals (exclusive CA in-app and via Telegram). You can explore plans and pricing on our Subscribe page. Would you like details on subscriptions or something else?";

const NJA_OUT_OF_SCOPE_LIVE =
  "I'm not able to answer that—I'm set up to help with NovaStaris products, subscriptions, and support. A live support agent may be able to help with your question. Would you like me to connect you with them now?";
const NJA_OUT_OF_SCOPE_OFFLINE =
  "I'm not able to answer that—I'm set up to help with NovaStaris products, subscriptions, and support. If you'd like help from our team, I can create a support ticket with your details and we'll get back to you within 48 hours. Would you like me to do that?";

const VIP_PLANS_DISPLAY = VIP_PLANS.map((p) => ({
  label: `VIP ${p.label}`,
  price: `$${p.priceUsd} USDC / $${getCardPriceForPlan(p)} card`,
}));
const NJA_SUBSCRIPTION_INTRO = "NovaStaris offers a free tier and a VIP subscription.";
const NJA_SUBSCRIPTION_OUTRO = `VIP includes the full platform: Surge, Transactions, NovaStaris AI Agent, Crypto Futures, Wallet Tracker, Coach Calls, NovaForecast, Nova Forex Agent, and on-demand tools such as AI Trading Bot and Nova Polymarket. USDC (Solana) is list price; card checkouts include a $${CARD_PAYMENT_FEE_USD} card fee. To subscribe, use the Subscribe page in the app menu. Anything else I can help with?`;

const SUBSCRIPTION_KEYWORDS = [
  "subscription", "subscribe", "price", "pricing", "plan", "plans", "cost", "how much",
  "pro", "vip", "pay", "payment", "fee", "fees", "trial", "monthly", "yearly",
];
const GREETING_WORDS = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "hi there", "howdy", "greetings"];
const PRODUCT_KEYWORDS = ["product", "products", "what is novastaris", "what do you offer", "features", "platform", "tell me about"];
const SUPPORT_INTENT_KEYWORDS = [
  "help", "support", "issue", "problem", "bug", "error", "not working", "can't", "cannot", "assistance",
  "broken", "fix", "technical", "stuck", "trouble", "question about my", "need help",
];

function isSubscriptionQuestion(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some((k) => lower.includes(k));
}

function isGreeting(text: string): boolean {
  const lower = text.trim().toLowerCase().replace(/[^\w\s]/g, "");
  if (lower.length > 25) return false;
  return GREETING_WORDS.some((g) => lower === g || lower.startsWith(g + " ") || lower.endsWith(" " + g));
}

function isProductQuestion(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return PRODUCT_KEYWORDS.some((k) => lower.includes(k));
}

function isSupportIntent(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return SUPPORT_INTENT_KEYWORDS.some((k) => lower.includes(k));
}

function getSubscriptionReply(): string {
  const vipList = VIP_PLANS_DISPLAY.map((p) => `${p.label} — ${p.price}`).join("\n");
  return `${NJA_SUBSCRIPTION_INTRO}\n\nVIP:\n${vipList}\n\n${NJA_SUBSCRIPTION_OUTRO}`;
}

type Message = { id: string; role: string; content: string; agentDisplayName?: string | null; createdAt: string };

export default function NeedHelpWidget() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"nja" | "live" | "submitted">("nja");
  const [messages, setMessages] = useState<Message[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [supportNumber, setSupportNumber] = useState<string | null>(null);
  const [requestingLive, setRequestingLive] = useState(false);
  const [error, setError] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [view, setView] = useState<"welcome" | "subscription" | "chat">("welcome");
  const [showOutOfScopeChoice, setShowOutOfScopeChoice] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasStarted = view === "chat" && messages.length > 0;
  const showSubscriptionInfo = view === "subscription";
  const customerCount = messages.filter((m) => m.role === "customer").length;
  const step = !customerName ? "name" : !customerEmail ? "email" : customerCount <= 2 ? "issue" : "choice";
  const showChoice = step === "choice" && status === "nja";
  const showTransferOrTicketButtons = (showChoice || showOutOfScopeChoice) && status === "nja";
  const isSubmitted = status === "submitted";

  const ensureSession = async (): Promise<string> => {
    const res = await fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error ?? "Failed to load chat");
    const sid = data.sessionId;
    setSessionId(sid);
    setStatus(data.status ?? "nja");
    const msgs = data.messages ?? [];
    setMessages(msgs);
    if (msgs.length > 0) setView("chat");
    setCustomerName(data.customerName ?? "");
    setCustomerEmail(data.customerEmail ?? "");
    return sid;
  };

  const fetchMessages = (overrideSessionId?: string): Promise<void> => {
    const sid = overrideSessionId ?? sessionId;
    if (!sid) return Promise.resolve();
    return fetch(`/api/chat/messages?sessionId=${encodeURIComponent(sid)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMessages(d.messages ?? []);
      })
      .catch(() => {});
  };

  const presenceOpts = { cache: "no-store" as RequestCache };
  const fetchPresence = () => {
    fetch("/api/chat/presence", presenceOpts)
      .then((r) => r.json())
      .then((d) => setAgentOnline(!!d.online))
      .catch(() => setAgentOnline(false));
  };

  const checkPresenceNow = (): Promise<boolean> =>
    fetch("/api/chat/presence", presenceOpts)
      .then((r) => r.json())
      .then((d) => !!d.online)
      .catch(() => false);

  useEffect(() => {
    if (open && sessionId) fetchPresence();
  }, [open, sessionId]);

  // Re-check presence periodically so "live agent" appears when owner opens dashboard
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(fetchPresence, 15000);
    return () => clearInterval(interval);
  }, [open]);

  // When in live mode, poll for new messages (agent replies) so customer sees them
  useEffect(() => {
    if (!open || !sessionId || status !== "live") return;
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [open, sessionId, status]);

  // When we're at the choice step, re-check presence so we only show "Talk to live agent" when owner is really online
  useEffect(() => {
    if (!showChoice) return;
    checkPresenceNow().then(setAgentOnline);
  }, [showChoice]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startTechSupportFlow = async () => {
    setView("chat");
    setSending(true);
    setError("");
    try {
      const sid = await ensureSession();
      if (!sid) return;
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, role: "customer", content: "I need technical support" }),
      });
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, role: "nja", content: NJA_AFTER_OPTION }),
      });
      await fetchMessages(sid);
    } catch {
      setError("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const sendOptionOrMessage = async (text: string) => {
    setView("chat");
    setShowOutOfScopeChoice(false);
    setSending(true);
    setError("");
    try {
      let sid = sessionId;
      if (!sid) sid = await ensureSession();
      if (!sid) return;

      const trimmed = text.trim();
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, role: "customer", content: trimmed }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to send");
        return;
      }
      setMessages((prev) => [...prev, { id: `opt-${Date.now()}`, role: "customer", content: trimmed, createdAt: new Date().toISOString() }]);
      setInput("");
      let njaReply: string;
      if (isSubscriptionQuestion(trimmed)) {
        njaReply = getSubscriptionReply();
      } else if (isProductQuestion(trimmed)) {
        njaReply = NJA_PRODUCT_OVERVIEW;
      } else if (isGreeting(trimmed)) {
        njaReply = NJA_INTRO;
      } else if (isSupportIntent(trimmed)) {
        njaReply = NJA_AFTER_OPTION;
      } else {
        const onlineNow = await checkPresenceNow();
        setAgentOnline(onlineNow);
        njaReply = onlineNow ? NJA_OUT_OF_SCOPE_LIVE : NJA_OUT_OF_SCOPE_OFFLINE;
        setShowOutOfScopeChoice(true);
      }
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, role: "nja", content: njaReply }),
      });
      await fetchMessages(sid);
    } catch {
      setError("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (text: string, name?: string, email?: string) => {
    if (!sessionId || !text.trim()) return;
    setShowOutOfScopeChoice(false);
    setSending(true);
    setError("");
    const trimmed = text.trim();
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          role: "customer",
          content: trimmed,
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
      setMessages((prev) => [...prev, { id: `opt-${Date.now()}`, role: "customer", content: trimmed, createdAt: new Date().toISOString() }]);

      if (status === "live") {
        await fetchMessages();
        return;
      }

      if (isSubscriptionQuestion(trimmed)) {
        await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, role: "nja", content: getSubscriptionReply() }),
        });
        await fetchMessages();
        return;
      }
      if (isProductQuestion(trimmed)) {
        await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, role: "nja", content: NJA_PRODUCT_OVERVIEW }),
        });
        await fetchMessages();
        return;
      }

      if (step === "name") setCustomerName(trimmed);
      if (step === "email") setCustomerEmail(trimmed);

      const nextStep = step === "name" ? "email" : step === "email" ? "issue" : "choice";
      const isChoice = nextStep === "choice";
      const onlineNow = isChoice ? await checkPresenceNow() : agentOnline;
      if (isChoice) setAgentOnline(onlineNow);
      const nextNja = nextStep === "email" ? NJA_ASK_EMAIL : nextStep === "issue" ? NJA_ASK_ISSUE : onlineNow ? NJA_CHOICE_LIVE : NJA_CHOICE_OFFLINE;
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "nja", content: nextNja }),
      });
      await fetchMessages();
    } catch {
      setError("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleRequestLive = async (preferSubmitOnly: boolean) => {
    if (!sessionId) return;
    setShowOutOfScopeChoice(false);
    setRequestingLive(true);
    setError("");
    try {
      // If user asked for live agent, re-check presence so we don't say "transferring" when agent just signed out
      let preferSubmit = preferSubmitOnly;
      if (!preferSubmitOnly) {
        const presenceRes = await fetch("/api/chat/presence", { cache: "no-store" }).catch(() => null);
        const presenceData = presenceRes?.ok ? await presenceRes.json() : null;
        if (!presenceData?.online) preferSubmit = true; // agent offline → create ticket and show offline message
      }
      const res = await fetch("/api/chat/request-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, customerName: customerName || undefined, customerEmail: customerEmail || undefined, preferSubmit }),
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

  const handleClose = () => {
    setConfirmClose(true);
  };

  const handleConfirmEndSession = () => {
    setConfirmClose(false);
    setOpen(false);
    setMinimized(false);
  };

  return (
    <>
      {/* Floating button - bottom right (hidden when panel is open) */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-3 py-2.5 sm:px-4 sm:py-3 text-white shadow-lg hover:from-cyan-600 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 min-h-[44px] sm:min-h-0"
          aria-label="Need help?"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">Need help?</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed left-3 right-3 sm:left-auto sm:right-6 z-50 flex flex-col rounded-t-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl ${
            minimized ? "bottom-4 sm:bottom-6 h-14 w-[calc(100vw-2rem)] max-w-80 sm:max-w-none" : "bottom-20 sm:bottom-24 h-[min(28rem,80vh)] w-[calc(100vw-1.5rem)] max-w-[22rem] sm:w-[24rem] sm:max-w-none"
          }`}
        >
          {/* Header - Nja */}
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                <Bot className="h-5 w-5" />
              </div>
              <span className="font-semibold">Nja</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMinimized(!minimized)} className="rounded p-1.5 hover:bg-white/20" aria-label={minimized ? "Expand" : "Minimize"}>
                <ChevronDown className={`h-5 w-5 ${minimized ? "rotate-180" : ""}`} />
              </button>
              <button type="button" onClick={handleClose} className="rounded p-1.5 hover:bg-white/20" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50 dark:bg-zinc-950">
                {showSubscriptionInfo ? (
                  <>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{WELCOME}</p>
                    <div className="rounded-2xl bg-violet-100 dark:bg-violet-900/40 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100">
                      <p className="font-medium mb-2">{NJA_SUBSCRIPTION_INTRO}</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs">
                        {VIP_PLANS_DISPLAY.map((p) => (
                          <li key={p.label}>{p.label} — {p.price}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{NJA_SUBSCRIPTION_OUTRO}</p>
                    </div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ASK_START}</p>
                    <div className="flex flex-col gap-2 pt-2">
                      <Button type="button" variant="outline" size="sm" className="justify-start text-left" onClick={() => setView("subscription")} disabled={sending}>
                        Subscription
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="justify-start text-left" onClick={() => startTechSupportFlow()} disabled={sending}>
                        Get technical support
                      </Button>
                    </div>
                  </>
                ) : !hasStarted ? (
                  <>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{WELCOME}</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ASK_START}</p>
                    <div className="flex flex-col gap-2 pt-2">
                      <Button type="button" variant="outline" size="sm" className="justify-start text-left" onClick={() => setView("subscription")} disabled={sending}>
                        Subscription
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="justify-start text-left" onClick={() => startTechSupportFlow()} disabled={sending}>
                        Get technical support
                      </Button>
                    </div>
                  </>
                ) : isSubmitted && supportNumber ? (
                  <div className="text-sm">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Your request has been sent.</p>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">Reference: <strong className="font-mono">{supportNumber}</strong></p>
                    <p className="mt-2 text-zinc-500 dark:text-zinc-500">We&apos;ll get back to you within 48 hours.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div key={m.id} className={`flex gap-2 ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                        {m.role !== "customer" && (
                          <div className="h-7 w-7 shrink-0 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                            <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            m.role === "customer" ? "bg-cyan-500 text-white" : m.role === "agent" ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" : "bg-violet-100 dark:bg-violet-900/40 text-zinc-900 dark:text-zinc-100"
                          }`}
                        >
                          {m.role === "agent" && (
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
                              {m.agentDisplayName ?? DEFAULT_SUPPORT_AGENT_NAME}
                            </span>
                          )}
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        </div>
                        {m.role === "customer" && (
                          <div className="h-7 w-7 shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                          </div>
                        )}
                      </div>
                    ))}
                    {showTransferOrTicketButtons && (
                      <div className="flex flex-wrap gap-2">
                        {agentOnline && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleRequestLive(false)} disabled={requestingLive}>
                            {showOutOfScopeChoice ? "Connect to live agent" : "Talk to live agent"}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleRequestLive(true)} disabled={requestingLive}>
                          {showOutOfScopeChoice ? "Create support ticket" : "Get back to me in 48 hours"}
                        </Button>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {hasStarted && !isSubmitted && (
                <form
                  className="flex gap-2 border-t border-zinc-200 dark:border-zinc-700 p-3 bg-white dark:bg-zinc-900 rounded-b-2xl"
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
                    placeholder={step === "name" ? "Your name" : step === "email" ? "Your email" : "Type your message..."}
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={sending}
                  />
                  <Button type="submit" size="icon" disabled={sending || !input.trim()} className="shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}

              {!hasStarted && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 p-3 bg-white dark:bg-zinc-900 rounded-b-2xl">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      disabled={sending}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && input.trim()) {
                          e.preventDefault();
                          sendOptionOrMessage(input.trim());
                        }
                      }}
                    />
                    <Button type="button" size="icon" onClick={() => input.trim() && sendOptionOrMessage(input.trim())} disabled={sending || !input.trim()} className="shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {error && <p className="px-3 pb-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
            </>
          )}
        </div>
      )}

      {/* End Chat confirmation */}
      {confirmClose && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setConfirmClose(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">End chat?</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Are you sure you want to close your conversation?</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmClose(false)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={handleConfirmEndSession}>
                End session
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
