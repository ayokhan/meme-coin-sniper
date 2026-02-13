"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, MessageSquare, Shield } from "lucide-react";

type CoachCallItem = { id: string; title: string | null; content: string; createdAt: string };
type TelegramRow = { userId: string; telegramId: string; email: string | null; name: string | null; createdAt: string };

type CoachSubTab = "calls" | "admin";

export default function CoachCallsPanel({
  isOwner,
  isVip,
}: {
  isOwner: boolean;
  isVip: boolean;
}) {
  const [calls, setCalls] = useState<CoachCallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [telegramSaved, setTelegramSaved] = useState<string | null>(null);
  const [telegramList, setTelegramList] = useState<TelegramRow[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [ownerSubTab, setOwnerSubTab] = useState<CoachSubTab>("calls");

  const loadCalls = () => {
    fetch("/api/coach-calls")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCalls(d.calls ?? []);
      })
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCalls();
  }, []);

  useEffect(() => {
    if (!isVip && !isOwner) return;
    fetch("/api/telegram-id")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.telegramId) setTelegramSaved(d.telegramId);
      })
      .catch(() => {});
  }, [isVip, isOwner]);

  const loadTelegramList = () => {
    fetch("/api/telegram-id?list=true")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.list) setTelegramList(d.list);
      })
      .catch(() => {});
  };

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/coach-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined, content: content.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setContent("");
        loadCalls();
      } else {
        alert(data.error ?? "Failed to post");
      }
    } catch {
      alert("Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/coach-calls", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setConfirmDeleteId(null);
        loadCalls();
      } else {
        alert(data.error ?? "Failed to delete");
      }
    } catch {
      alert("Failed to delete");
    }
  };

  const handleSaveTelegram = async () => {
    const val = telegramId.trim();
    if (!val) return;
    try {
      const res = await fetch("/api/telegram-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId: val }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramSaved(val);
        setTelegramId("");
      } else {
        alert(data.error ?? "Failed to save");
      }
    } catch {
      alert("Failed to save");
    }
  };

  if (loading) {
    return (
      <div className="mx-6 py-8 text-center text-muted-foreground">
        Loading Coach Calls…
      </div>
    );
  }

  const callsList = (
    <div>
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Coach Calls</h3>
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No coach calls yet.</p>
      ) : (
        <ul className="space-y-4">
          {calls.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-zinc-200/90 dark:border-zinc-700/90 bg-white dark:bg-zinc-900/80 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                  {c.title && (
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-1">{c.title}</p>
                  )}
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2 whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
                {isOwner && (
                  <div className="shrink-0 flex items-center gap-1">
                    {confirmDeleteId === c.id ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-600 border-rose-300 dark:border-rose-700"
                          onClick={() => handleDelete(c.id)}
                        >
                          Yes, delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-500 hover:text-rose-600"
                        onClick={() => setConfirmDeleteId(c.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const telegramIdForm = (
    <Card className="border-cyan-200/80 dark:border-cyan-800/80 bg-cyan-50/30 dark:bg-cyan-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Add your Telegram ID</CardTitle>
        <p className="text-xs text-muted-foreground">
          Add your Telegram username or numeric ID so we can add you to the Coach Calls Telegram group and you’ll get new calls there too.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="e.g. @username or 123456789"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
          />
          <Button onClick={handleSaveTelegram} disabled={!telegramId.trim()} className="bg-cyan-500 hover:bg-cyan-600 text-white">
            Save
          </Button>
        </div>
        {telegramSaved && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Saved: <span className="font-medium">{telegramSaved}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );

  const adminTabContent = (
    <div className="space-y-6">
      <Card className="border-amber-200/80 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Post a Coach Call (CA)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            New posts are also sent to your configured Telegram channel.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
          />
          <textarea
            placeholder="CA details, contract address, notes…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 resize-y"
          />
          <Button
            onClick={handlePost}
            disabled={posting || !content.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700"
          >
            {posting ? "Posting…" : "Post"}
          </Button>
        </CardContent>
      </Card>
      <Card className="border-zinc-200 dark:border-zinc-700">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Member Telegram IDs</CardTitle>
          <Button variant="outline" size="sm" onClick={loadTelegramList}>
            Refresh list
          </Button>
        </CardHeader>
        <CardContent>
          {telegramList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Telegram IDs submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left py-2 font-medium">Telegram ID</th>
                    <th className="text-left py-2 font-medium">Email</th>
                    <th className="text-left py-2 font-medium">Name</th>
                  </tr>
                </thead>
                <tbody>
                  {telegramList.map((r) => (
                    <tr key={r.userId} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 font-mono">{r.telegramId}</td>
                      <td className="py-2 text-muted-foreground">{r.email ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{r.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (isOwner) {
    return (
      <div className="mx-6 py-4">
        <Tabs value={ownerSubTab} onValueChange={(v) => setOwnerSubTab(v as CoachSubTab)} className="space-y-4">
          <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80">
            <TabsTrigger value="calls" className="rounded-md data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600">
              Coach Calls
            </TabsTrigger>
            <TabsTrigger value="admin" className="rounded-md data-[state=active]:bg-amber-500 data-[state=active]:text-white dark:data-[state=active]:bg-amber-600 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Admin
            </TabsTrigger>
          </TabsList>
          <TabsContent value="calls" className="mt-4">
            {callsList}
          </TabsContent>
          <TabsContent value="admin" className="mt-4">
            {adminTabContent}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="mx-6 py-4 space-y-6">
      {telegramIdForm}
      {callsList}
    </div>
  );
}
