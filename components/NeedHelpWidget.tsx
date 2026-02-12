"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, Bot, User, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const WELCOME = "Hi, I'm Nja, your AI assistant for NovaStaris. I'm here to help anytime, anywhere.";
const ASK_START = "Ask me a question to get started.";
const NJA_ASK_NAME = "May I have your name?";
const NJA_ASK_EMAIL = "Thanks! What's your email address?";
const NJA_ASK_ISSUE = "What do you need help with? Please describe your question or issue.";
const NJA_AFTER_OPTION = "Thanks, I'd be happy to help with that. May I have your name?";
const NJA_CHOICE_LIVE = "A live support agent is available. Would you like to chat with them now, or have us get back to you within 48 hours?";
const NJA_CHOICE_OFFLINE = "No live agent is available right now. I'll send your details to our team and we'll get back to you within 48 hours. Would you like me to do that?";

type Message = { id: string; role: string; content: string; createdAt: string };

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
  const bottomRef = useRef<HTMLDivElement>(null);

  const hasStarted = messages.length > 0;
  const customerCount = messages.filter((m) => m.role === "customer").length;
  const step = customerCount === 0 ? "name" : customerCount === 1 ? "email" : customerCount === 2 ? "issue" : "choice";
  const showChoice = step === "choice" && status === "nja";
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
    setMessages(data.messages ?? []);
    setCustomerName(data.customerName ?? "");
    setCustomerEmail(data.customerEmail ?? "");
    return sid;
  };

  const fetchMessages = () => {
    if (!sessionId) return;
    fetch(`/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMessages(d.messages ?? []);
      })
      .catch(() => {});
  };

  const fetchPresence = () => {
    fetch("/api/chat/presence")
      .then((r) => r.json())
      .then((d) => setAgentOnline(!!d.online))
      .catch(() => setAgentOnline(false));
  };

  useEffect(() => {
    if (open && sessionId) fetchPresence();
  }, [open, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendOptionOrMessage = async (text: string, isOption = false) => {
    setSending(true);
    setError("");
    try {
      let sid = sessionId;
      if (!sid) sid = await ensureSession();
      if (!sid) return;

      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, role: "customer", content: text.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to send");
        return;
      }

      const replyContent = isOption || !hasStarted ? NJA_AFTER_OPTION : step === "name" ? NJA_ASK_EMAIL : step === "email" ? NJA_ASK_ISSUE : agentOnline ? NJA_CHOICE_LIVE : NJA_CHOICE_OFFLINE;
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, role: "nja", content: replyContent }),
      });
      setInput("");
      fetchMessages();
    } catch {
      setError("Failed to send");
    } finally {
      setSending(false);
    }
  };

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
      if (step === "name") setCustomerName(text.trim());
      if (step === "email") setCustomerEmail(text.trim());

      const nextStep = step === "name" ? "email" : step === "email" ? "issue" : "choice";
      const nextNja = nextStep === "email" ? NJA_ASK_EMAIL : nextStep === "issue" ? NJA_ASK_ISSUE : agentOnline ? NJA_CHOICE_LIVE : NJA_CHOICE_OFFLINE;
      await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, role: "nja", content: nextNja }),
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
        body: JSON.stringify({ sessionId, customerName: customerName || undefined, customerEmail: customerEmail || undefined, preferSubmit: preferSubmitOnly }),
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
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-white shadow-lg hover:from-cyan-600 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          aria-label="Need help?"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="font-medium">Need help?</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed right-6 z-50 flex flex-col rounded-t-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl ${
            minimized ? "bottom-6 h-14 w-80" : "bottom-24 h-[28rem] w-[22rem] sm:w-[24rem]"
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
                {!hasStarted ? (
                  <>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{WELCOME}</p>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ASK_START}</p>
                    <div className="flex flex-col gap-2 pt-2">
                      <Button type="button" variant="outline" size="sm" className="justify-start text-left" onClick={() => sendOptionOrMessage("I need help with payments", true)} disabled={sending}>
                        Explore payment options
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="justify-start text-left" onClick={() => sendOptionOrMessage("I need technical support", true)} disabled={sending}>
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
                          {m.role === "agent" && <span className="block text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Support Agent</span>}
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        </div>
                        {m.role === "customer" && (
                          <div className="h-7 w-7 shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                          </div>
                        )}
                      </div>
                    ))}
                    {showChoice && (
                      <div className="flex flex-wrap gap-2">
                        {agentOnline && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleRequestLive(false)} disabled={requestingLive}>
                            Talk to live agent
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleRequestLive(true)} disabled={requestingLive}>
                          Get back to me in 48 hours
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
                          sendOptionOrMessage(input.trim(), false);
                        }
                      }}
                    />
                    <Button type="button" size="icon" onClick={() => input.trim() && sendOptionOrMessage(input.trim(), false)} disabled={sending || !input.trim()} className="shrink-0">
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
