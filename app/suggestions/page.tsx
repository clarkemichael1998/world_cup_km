"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { formatDate } from "@/lib/formatDate";

type Suggestion = {
  id: number;
  title: string;
  details: string | null;
  username: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  user_vote: -1 | 0 | 1;
};

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  async function loadSuggestions() {
    const response = await fetch("/api/suggestions");
    const payload = await response.json();
    setSuggestions(payload.suggestions ?? []);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, details })
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not add suggestion.");
      return;
    }

    setTitle("");
    setDetails("");
    setSuggestions(payload.suggestions ?? []);
  }

  async function vote(suggestionId: number, value: -1 | 1) {
    const response = await fetch("/api/suggestions/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ suggestionId, vote: value })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Login required to vote.");
      return;
    }
    setError("");
    setSuggestions(payload.suggestions ?? []);
  }

  return (
    <div>
      <PageTitle title="Suggestions" subtitle="Pitch improvements, vote ideas up or down, and help shape what gets built next." />

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Add Suggestion</p>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <input
              className="w-full rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold"
              maxLength={120}
              placeholder="Short title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              className="min-h-32 w-full resize-none rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold"
              maxLength={1000}
              placeholder="What should improve?"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-green-900/50">{title.length}/120</p>
              <button className="rounded-md bg-pitch px-4 py-2 text-sm font-black text-white hover:bg-green-800 disabled:opacity-50" disabled={busy}>
                {busy ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
          {error ? (
            <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-950">
              <p>{error}</p>
              {error.toLowerCase().includes("login") ? <Link className="mt-2 inline-flex underline" href="/login">Login</Link> : null}
            </div>
          ) : null}
        </aside>

        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="rounded-lg bg-white p-6 text-sm font-bold text-green-900/60 shadow-sm">No suggestions yet.</p>
          ) : (
            suggestions.map((suggestion) => (
              <article key={suggestion.id} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-black text-green-950">{suggestion.title}</h2>
                    <p className="mt-1 text-xs font-bold text-green-900/50">
                      {suggestion.username} · {formatDate(suggestion.created_at)}
                    </p>
                  </div>
                  <p className="rounded-md bg-green-950/5 px-3 py-2 text-center text-sm font-black text-pitch">
                    {suggestion.upvotes - suggestion.downvotes}
                  </p>
                </div>

                {suggestion.details ? <p className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-green-900/75">{suggestion.details}</p> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className={`rounded-md border px-3 py-1.5 text-sm font-black ${suggestion.user_vote === 1 ? "border-green-700 bg-green-100 text-green-900" : "border-green-900/15 bg-white text-green-900/70 hover:bg-green-50"}`}
                    onClick={() => vote(suggestion.id, 1)}
                  >
                    Upvote {suggestion.upvotes}
                  </button>
                  <button
                    className={`rounded-md border px-3 py-1.5 text-sm font-black ${suggestion.user_vote === -1 ? "border-red-700 bg-red-100 text-red-900" : "border-green-900/15 bg-white text-green-900/70 hover:bg-green-50"}`}
                    onClick={() => vote(suggestion.id, -1)}
                  >
                    Downvote {suggestion.downvotes}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
