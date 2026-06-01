"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";

type ChatMessage = {
  id: number;
  username: string;
  message: string;
  created_at: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadMessages();
    const timer = window.setInterval(loadMessages, 8000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadMessages() {
    const response = await fetch("/api/chat");
    const payload = await response.json();
    setMessages(payload.messages ?? []);
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
    setMessages(payload.messages ?? []);
  }

  return (
    <div>
      <PageTitle title="Chat" subtitle="Share pulls, squads, and World Cup live chaos with the group." />

      <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            {messages.length > 0 ? (
              messages.map((item) => (
                <article key={item.id} className="rounded-md bg-green-950/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-green-950">{item.username}</p>
                    <time className="text-xs font-bold text-green-900/50">{formatTime(item.created_at)}</time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-green-950">{item.message}</p>
                </article>
              ))
            ) : (
              <p className="rounded-md bg-green-950/5 p-4 text-sm font-bold text-green-900/70">No messages yet.</p>
            )}
          </div>
        </div>

        <aside className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Send Message</p>
          <form onSubmit={submit} className="mt-3">
            <textarea
              className="min-h-32 w-full resize-none rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold"
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
            <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-950">
              <p>{error}</p>
              <Link className="mt-2 inline-flex underline" href="/login">
                Login
              </Link>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
