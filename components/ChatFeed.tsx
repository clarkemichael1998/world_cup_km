"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/Badge";
import { formatDate } from "@/lib/formatDate";

const REACTIONS = ["👍", "👎", "🔥", "❤️", "😂", "🤡", "💩", "🫪"];

type ReactionCount = { reaction: string; count: number; user_reacted: boolean; users: string[] };

type ChatMessage = {
  id: number;
  username: string;
  message: string;
  created_at: string;
  reply_to_message_id: number | null;
  reply_to_username: string | null;
  reply_to_message: string | null;
  reactions: ReactionCount[];
};

export function ChatFeed() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
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
    const sorted = sortNewestFirst(payload.messages ?? []);
    setMessages(sorted);
    markChatSeen(sorted);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message, replyToMessageId: replyingTo?.id ?? null })
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not send message.");
      return;
    }
    setMessage("");
    setReplyingTo(null);
    const sorted = sortNewestFirst(payload.messages ?? []);
    setMessages(sorted);
    markChatSeen(sorted);
  }

  async function react(messageId: number, reaction: string) {
    const response = await fetch("/api/chat/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messageId, reaction })
    });
    if (response.ok) {
      loadMessages();
    }
  }

  function jumpToMessage(messageId: number) {
    const element = document.getElementById(`chat-message-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => setHighlightedMessageId(null), 1800);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Group Chat</p>
          <p className="text-xs font-bold text-green-900/45">Newest first</p>
        </div>
        <form onSubmit={submit} className="mt-3">
          {replyingTo ? (
            <div className="mb-2 flex items-start justify-between gap-3 rounded-md border border-green-900/10 bg-green-950/5 px-3 py-2">
              <p className="min-w-0 text-[11px] font-bold leading-snug text-green-900/65">
                Replying to <span className="font-black text-green-950">{replyingTo.username}</span>:{" "}
                <span>{truncate(replyingTo.message, 90)}</span>
              </p>
              <button type="button" onClick={() => setReplyingTo(null)} className="shrink-0 text-[11px] font-black uppercase text-green-900/50 hover:text-green-950">
                Cancel
              </button>
            </div>
          ) : null}
          <textarea
            className="min-h-16 w-full resize-none rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold"
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
                <article id={`chat-message-${item.id}`} key={item.id} className={`rounded-md border px-3 py-2 shadow-sm transition ${highlightedMessageId === item.id ? "ring-2 ring-amber-400" : ""} ${tone.container}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {item.username === "admin" ? (
                        <span className={`truncate text-sm font-black ${tone.name}`}>KMXI</span>
                      ) : (
                        <Link className={`truncate text-sm font-black hover:underline ${tone.name}`} href={`/profile/${encodeURIComponent(item.username)}`}>{item.username}</Link>
                      )}
                      {tone.badge ? <Badge tone={tone.badgeTone}>{tone.badge}</Badge> : null}
                    </div>
                    <time className="text-xs font-bold text-green-900/50">{formatDate(item.created_at)}</time>
                  </div>
                  <p className={`mt-1 whitespace-pre-wrap break-words text-[13px] font-semibold leading-snug ${tone.text}`}>{item.message}</p>
                  {item.reply_to_message ? (
                    <button type="button" onClick={() => item.reply_to_message_id && jumpToMessage(item.reply_to_message_id)} className="mt-1.5 block w-full rounded border-l-2 border-green-800/25 bg-white/45 px-2 py-1 text-left text-[10px] font-semibold leading-snug text-green-900/55 hover:bg-white/70">
                      <span className="font-black text-green-900/70">Reply to {item.reply_to_username === "admin" ? "KMXI" : item.reply_to_username ?? "someone"}:</span>{" "}
                      {truncate(item.reply_to_message, 120)}
                    </button>
                  ) : null}
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
                          title={r?.users.length ? `${emoji} ${r.users.join(", ")}` : emoji}
                        >
                          <span>{emoji}</span>
                          {count > 0 && <span className="tabular-nums">{count}</span>}
                        </button>
                      );
                    })}
                    <button
                      className="rounded-full border border-green-900/15 bg-white px-2 py-0.5 text-[11px] font-black text-green-900/55 hover:border-green-700/40 hover:bg-green-50 hover:text-green-900"
                      onClick={() => setReplyingTo(item)}
                    >
                      Reply
                    </button>
                  </div>
                  <ReactionUsers reactions={item.reactions} />
                </article>
              );
            })
          ) : (
            <p className="rounded-md bg-green-950/5 p-4 text-sm font-bold text-green-900/70">No messages yet — say hello.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ReactionUsers({ reactions }: { reactions: ReactionCount[] }) {
  const active = reactions.filter((reaction) => reaction.count > 0 && reaction.users.length > 0);
  if (active.length === 0) return null;

  return (
    <p className="mt-1 break-words text-[10px] font-semibold leading-snug text-green-900/45">
      {active.map((reaction) => `${reaction.reaction} ${reaction.users.join(", ")}`).join(" · ")}
    </p>
  );
}

function sortNewestFirst(messages: ChatMessage[]) {
  return [...messages].sort((a, b) => {
    const dateDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return dateDiff || b.id - a.id;
  });
}

function markChatSeen(messages: ChatMessage[]) {
  if (messages.length === 0) return;
  const latest = Math.max(...messages.map((message) => new Date(message.created_at).getTime()));
  window.localStorage.setItem("kmxi-last-chat-seen", String(latest));
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function getMessageTone(item: ChatMessage): { container: string; name: string; text: string; badge: string; badgeTone: BadgeTone } {
  if (item.message.startsWith("⚡ UPGRADE")) {
    return { container: "border-emerald-300 bg-emerald-50", name: "text-emerald-900", text: "text-emerald-950", badge: "Upgrade", badgeTone: "green" };
  }
  if (item.message.startsWith("🤡 CLOWN TAX")) {
    return { container: "border-red-300 bg-red-50", name: "text-red-900", text: "text-red-950", badge: "Clown Tax", badgeTone: "red" };
  }
  if (item.message.startsWith("🔁 Trade complete")) {
    return { container: "border-sky-200 bg-sky-50", name: "text-sky-900", text: "text-sky-950", badge: "Trade", badgeTone: "sky" };
  }
  if (item.message.startsWith("📖 Album milestone")) {
    return { container: "border-amber-200 bg-amber-50", name: "text-amber-950", text: "text-amber-950", badge: "Milestone", badgeTone: "amber" };
  }
  if (item.username === "admin") {
    return { container: "border-amber-200 bg-amber-50", name: "text-amber-950", text: "text-amber-950", badge: "Admin", badgeTone: "amber" };
  }
  if (item.message.startsWith("[Activity log removed by admin]")) {
    return { container: "border-slate-200 bg-slate-50", name: "text-slate-700", text: "text-slate-700", badge: "Removed", badgeTone: "slate" };
  }
  if (item.message.includes(" logged ") && item.message.includes("activity credits")) {
    return { container: "border-green-200 bg-green-50", name: "text-green-950", text: "text-green-950", badge: "Activity", badgeTone: "green" };
  }
  if (item.message.includes(" pulled ") && (item.message.includes("Legend") || item.message.includes("Icon"))) {
    return { container: "border-amber-300 bg-amber-50", name: "text-amber-950", text: "text-amber-950", badge: "Big Pull", badgeTone: "amber" };
  }
  return { container: "border-transparent bg-green-950/5", name: "text-green-950", text: "text-green-950", badge: "", badgeTone: "neutral" };
}
