"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { formatDate } from "@/lib/formatDate";

const REACTIONS = ["👍", "👎", "🔥", "❤️", "😂", "🤡", "💩", "🫪"];

type ReactionCount = { reaction: string; count: number; user_reacted: boolean };

type ChatMessage = {
  id: number;
  username: string;
  message: string;
  created_at: string;
  reactions: ReactionCount[];
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(() => {
      if (!document.hidden) loadMessages();
    }, 8000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadMessages() {
    const response = await fetch("/api/chat");
    const payload = await response.json();
    setMessages(sortNewestFirst(payload.messages ?? []));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message })
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send message.");
      return;
    }
    setMessage("");
    setMessages(sortNewestFirst(payload.messages ?? []));
  }

  async function react(messageId: number, reaction: string) {
    const response = await fetch("/api/chat/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messageId, reaction })
    });
    if (response.ok) {
      // Optimistic: reload messages
      loadMessages();
    }
  }

  return (
    <div>
      <PageTitle title="Chat" subtitle="Pulls, squads, activity logs, and World Cup chaos in one place." />

      <section className="space-y-4">
        <div className="sticky top-[4.25rem] z-30 rounded-lg border border-green-900/10 bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Send Message</p>
            <p className="text-xs font-bold text-green-900/45">Newest messages first</p>
          </div>
          <form onSubmit={submit} className="mt-3">
            <textarea
              className="min-h-20 w-full resize-none rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold"
              maxLength={500}
              placeholder="Brag responsibly."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-green-900/55">{message.length}/500</p>
              <button className="rounded-md bg-pitch px-4 py-2 text-sm font-black text-white hover:bg-green-800" disabled={busy}>
                {busy ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
          {error ? (
            <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-950">
              <p>{error}</p>
              <Link className="mt-2 inline-flex underline" href="/login">
                Login
              </Link>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-green-900/10 bg-white p-3 shadow-sm">
          <div className="space-y-2">
            {messages.length > 0 ? (
              messages.map((item) => {
                const tone = getMessageTone(item);
                return (
                <article key={item.id} className={`rounded-md border px-3 py-2 shadow-sm ${tone.container}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className={`truncate text-sm font-black ${tone.name}`}>{item.username}</p>
                      {tone.badge ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${tone.badgeClass}`}>{tone.badge}</span> : null}
                    </div>
                    <time className="text-xs font-bold text-green-900/50">{formatDate(item.created_at)}</time>
                  </div>
                  <p className={`mt-1 whitespace-pre-wrap break-words text-[13px] font-semibold leading-snug ${tone.text}`}>{item.message}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {REACTIONS.map((emoji) => {
                      const r = item.reactions.find((x) => x.reaction === emoji);
                      const count = r?.count ?? 0;
                      const active = r?.user_reacted ?? false;
                      return (
                        <button
                          key={emoji}
                          onClick={() => react(item.id, emoji)}
                          className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-bold transition-colors ${
                            active
                              ? "border-green-700 bg-green-100 text-green-900"
                              : "border-green-900/15 bg-white text-green-900/70 hover:border-green-700/40 hover:bg-green-50"
                          }`}
                        >
                          <span>{emoji}</span>
                          {count > 0 && <span className="tabular-nums">{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
              })
            ) : (
              <p className="rounded-md bg-green-950/5 p-4 text-sm font-bold text-green-900/70">No messages yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function sortNewestFirst(messages: ChatMessage[]) {
  return [...messages].sort((a, b) => {
    const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return dateDiff || b.id - a.id;
  });
}

function getMessageTone(item: ChatMessage) {
  if (item.username === "admin") {
    return {
      container: "border-amber-200 bg-amber-50",
      name: "text-amber-950",
      text: "text-amber-950",
      badge: "Admin",
      badgeClass: "bg-amber-200 text-amber-950"
    };
  }
  if (item.message.startsWith("[Activity log removed by admin]")) {
    return {
      container: "border-slate-200 bg-slate-50",
      name: "text-slate-700",
      text: "text-slate-700",
      badge: "Removed",
      badgeClass: "bg-slate-200 text-slate-700"
    };
  }
  if (item.message.includes(" logged ") && item.message.includes("activity credits")) {
    return {
      container: "border-green-200 bg-green-50",
      name: "text-green-950",
      text: "text-green-950",
      badge: "Activity",
      badgeClass: "bg-green-200 text-green-900"
    };
  }
  if (item.message.includes(" pulled ") && (item.message.includes("Legend") || item.message.includes("Icon"))) {
    return {
      container: "border-amber-300 bg-amber-50",
      name: "text-amber-950",
      text: "text-amber-950",
      badge: "Big Pull",
      badgeClass: "bg-amber-200 text-amber-950"
    };
  }
  return {
    container: "border-transparent bg-green-950/5",
    name: "text-green-950",
    text: "text-green-950",
    badge: "",
    badgeClass: ""
  };
}
