"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccessLiveChatAgentSession } from "@/lib/admin-access";
import { resolveSupportStaffDisplayName } from "@/lib/support-agent";
import DelegatedAdminQuickNav from "@/components/admin/DelegatedAdminQuickNav";
import { Zap, Send, User, Bot, Headphones, Trash2, MessageSquarePlus, X } from "lucide-react";

type Message = { id: string; role: string; content: string; agentDisplayName?: string | null; createdAt: string };
type Session = {
  id: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

export default function AdminChatPage() {
  const { data: session, status: authStatus } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sendingBySession, setSendingBySession] = useState<Record<string, boolean>>({});
  const [windowReplyBySession, setWindowReplyBySession] = useState<Record<string, string>>({});
  const [openWindowIds, setOpenWindowIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selected = sessions.find((s) => s.id === selectedId);
  const openWindows = useMemo(
    () => openWindowIds.map((id) => sessions.find((s) => s.id === id)).filter((s): s is Session => !!s),
    [openWindowIds, sessions]
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const canUseLiveChat = canAccessLiveChatAgentSession(session);
  const agentDisplayName = resolveSupportStaffDisplayName(
    (session?.user as { supportStaffName?: string | null } | undefined)?.supportStaffName
  );

  const loadSessions = () => {
    fetch("/api/admin/chat/sessions")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setSessions(data.sessions ?? []);
          setCanDelete(!!data.canDelete);
        } else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"));
  };

  useEffect(() => {
    if (authStatus !== "authenticated" || !canUseLiveChat) return;
    setLoading(true);
    loadSessions();
    setLoading(false);
  }, [authStatus, canUseLiveChat]);

  useEffect(() => {
    if (!canUseLiveChat) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    fetch("/api/feature-flags-public")
      .then((r) => r.json())
      .then((d: { liveSupportChatEnabled?: boolean }) => {
        if (cancelled || !d.liveSupportChatEnabled) return;
        const ping = () => {
          if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
          fetch("/api/chat/presence", { method: "POST" }).catch(() => {});
        };
        ping();
        interval = setInterval(ping, 60_000);
        presenceIntervalRef.current = interval;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    };
  }, [canUseLiveChat]);

  useEffect(() => {
    if (!selectedId && openWindowIds.length === 0) return;
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, [selectedId, openWindowIds]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages]);

  useEffect(() => {
    setOpenWindowIds((prev) => prev.filter((id) => sessions.some((s) => s.id === id)));
  }, [sessions]);

  useEffect(() => {
    if (openWindows.length === 0) return;
    const timer = setTimeout(() => {
      for (const w of openWindows) {
        const el = document.getElementById(`chat-window-scroll-${w.id}`);
        if (el) el.scrollTop = el.scrollHeight;
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [openWindows]);

  const sendReplyToSession = async (targetSessionId: string, text: string): Promise<boolean> => {
    if (!targetSessionId || !text.trim()) return false;
    setSendingBySession((prev) => ({ ...prev, [targetSessionId]: true }));
    setError("");
    try {
      const res = await fetch("/api/admin/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: targetSessionId, content: text.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Failed to send");
        return false;
      }
      loadSessions();
      setSuccessMessage("Message sent.");
      setTimeout(() => setSuccessMessage(""), 4000);
      return true;
    } catch {
      setError("Failed to send");
      return false;
    } finally {
      setSendingBySession((prev) => ({ ...prev, [targetSessionId]: false }));
    }
  };

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    const ok = await sendReplyToSession(selectedId, reply);
    if (ok) setReply("");
  };

  const sendWindowReply = async (sid: string) => {
    const text = (windowReplyBySession[sid] ?? "").trim();
    if (!text) return;
    const ok = await sendReplyToSession(sid, text);
    if (ok) setWindowReplyBySession((prev) => ({ ...prev, [sid]: "" }));
  };

  const openWindow = (sid: string) => {
    setOpenWindowIds((prev) => (prev.includes(sid) ? prev : [...prev, sid]));
  };

  const closeWindow = (sid: string) => {
    setOpenWindowIds((prev) => prev.filter((id) => id !== sid));
    setWindowReplyBySession((prev) => {
      const next = { ...prev };
      delete next[sid];
      return next;
    });
  };

  const deleteChat = async (sid: string) => {
    setDeletingId(sid);
    setError("");
    try {
      const res = await fetch("/api/admin/chat/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sid));
        if (selectedId === sid) setSelectedId(null);
        setConfirmDeleteId(null);
      } else {
        setError(data.error ?? "Failed to delete");
      }
    } catch {
      setError("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (authStatus === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {authStatus === "loading" ? "Loading…" : "Sign in to view live chat."}
            {!session && (
              <p className="mt-2">
                <Link href="/signin" className="underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canUseLiveChat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center text-muted-foreground">
            Not authorized to access live chat.
            <p className="mt-2">
              <Link href="/" className="underline">Back to app</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <DelegatedAdminQuickNav />

        <Card className="border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-emerald-500" />
              Live chat
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              You appear as a support agent to customers. This page pings presence every 20s so customers see you as online when you’re here.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {successMessage && (
              <div className="mx-4 mt-2 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="mx-4 mt-2 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                {error}
              </div>
            )}
            {loading ? (
              <p className="p-6 text-muted-foreground">Loading…</p>
            ) : (
              <div className="flex flex-col sm:flex-row min-h-[400px]">
                <div className="w-full sm:w-72 border-b sm:border-b-0 sm:border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto">
                  {sessions.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No active chats.</p>
                  ) : (
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {sessions.map((s) => (
                        <li key={s.id} className={`${selectedId === s.id ? "bg-cyan-50 dark:bg-cyan-950/30 border-l-2 border-cyan-500" : ""}`}>
                          <div className="flex items-start gap-2 px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setSelectedId(s.id)}
                              className="flex-1 text-left px-2 py-1 text-sm rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            >
                              <span className="font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                                {s.customerName || s.customerEmail || "Guest"}
                              </span>
                              <span className="text-xs text-zinc-500">
                                {s.status === "live" ? "Live" : "Nja"} · {new Date(s.updatedAt).toLocaleString()}
                              </span>
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => openWindow(s.id)}
                              title="Open chat window"
                              className="shrink-0 text-cyan-600 dark:text-cyan-400"
                            >
                              <MessageSquarePlus className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex-1 flex flex-col min-h-[320px]">
                  {!selected ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-6">
                      Select a chat
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50">
                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {selected.customerName || selected.customerEmail || "Guest"}
                        </span>
                        {canDelete && (
                          confirmDeleteId === selected.id ? (
                            <span className="flex items-center gap-2 text-xs">
                              <span className="text-zinc-500">Delete this chat?</span>
                              <Button size="sm" variant="destructive" onClick={() => deleteChat(selected.id)} disabled={!!deletingId}>
                                {deletingId === selected.id ? "Deleting…" : "Yes, delete"}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)} disabled={!!deletingId}>
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              onClick={() => setConfirmDeleteId(selected.id)}
                              title="Delete this chat and all messages"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30">
                        {selected.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`flex gap-2 ${m.role === "agent" ? "justify-end" : "justify-start"}`}
                          >
                            {m.role !== "agent" && (
                              <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0">
                                {m.role === "customer" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-violet-500" />}
                              </div>
                            )}
                            <div
                              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                                m.role === "agent"
                                  ? "bg-cyan-500 text-white"
                                  : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                              }`}
                            >
                              {m.role === "agent" && (
                                <span className="block text-xs opacity-90 mb-0.5">
                                  You ({m.agentDisplayName ?? agentDisplayName})
                                </span>
                              )}
                              <span className="whitespace-pre-wrap">{m.content}</span>
                            </div>
                          </div>
                        ))}
                        <div ref={bottomRef} />
                      </div>
                      {(selected.status === "live" || selected.status === "nja") && (
                        <form
                          className="flex gap-2 p-4 border-t border-zinc-200 dark:border-zinc-700"
                          onSubmit={(e) => {
                            e.preventDefault();
                            sendReply();
                          }}
                        >
                          <input
                            type="text"
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder={selected.status === "live" ? "Reply as support agent…" : "Take over (reply to start live chat)…"}
                            className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            disabled={!!sendingBySession[selected.id]}
                          />
                          <Button type="submit" disabled={!!sendingBySession[selected.id] || !reply.trim()}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline">Back to app</Link>
        </p>
      </div>
      {openWindows.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[240] flex max-w-[calc(100vw-1rem)] gap-3 overflow-x-auto pb-1">
          {openWindows.map((w) => (
            <div
              key={w.id}
              className="w-[330px] shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-200 dark:border-zinc-700">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {w.customerName || w.customerEmail || "Guest"}
                  </p>
                  <p className="text-[11px] text-zinc-500">{w.status === "live" ? "Live" : "Nja"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => closeWindow(w.id)}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Close chat window"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div id={`chat-window-scroll-${w.id}`} className="h-60 overflow-y-auto p-3 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/40">
                {w.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "agent" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs ${
                        m.role === "agent"
                          ? "bg-cyan-500 text-white"
                          : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {m.role === "agent" && <span className="block text-[10px] opacity-90 mb-0.5">You</span>}
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </div>
                  </div>
                ))}
              </div>
              {(w.status === "live" || w.status === "nja") && (
                <form
                  className="flex gap-2 p-3 border-t border-zinc-200 dark:border-zinc-700"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendWindowReply(w.id);
                  }}
                >
                  <input
                    type="text"
                    value={windowReplyBySession[w.id] ?? ""}
                    onChange={(e) => setWindowReplyBySession((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    placeholder="Reply..."
                    className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    disabled={!!sendingBySession[w.id]}
                  />
                  <Button type="submit" size="sm" disabled={!!sendingBySession[w.id] || !(windowReplyBySession[w.id] ?? "").trim()}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
