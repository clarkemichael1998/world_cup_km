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
  implemented_at: string | null;
  implemented_by_username: string | null;
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadSuggestions();
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((p) => setIsAdmin(Boolean(p.user?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  async function loadSuggestions() {
    const r = await fetch("/api/suggestions");
    const p = await r.json();
    const loaded = p.suggestions ?? [];
    setSuggestions(loaded);
    markImplementedSuggestionsSeen(loaded);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ title, details })
    });
    const p = await r.json();
    setBusy(false);
    if (!r.ok) { setError(p.error ?? "Could not add suggestion."); return; }
    setTitle("");
    setDetails("");
    setSuggestions(p.suggestions ?? []);
  }

  async function vote(suggestionId: number, value: -1 | 1) {
    const r = await fetch("/api/suggestions/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ suggestionId, vote: value })
    });
    const p = await r.json();
    if (!r.ok) { setError(p.error ?? "Login required to vote."); return; }
    setError("");
    setSuggestions(p.suggestions ?? []);
  }

  async function toggleImplemented(suggestion: Suggestion) {
    const r = await fetch("/api/suggestions/implement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ suggestionId: suggestion.id, implemented: !suggestion.implemented_at })
    });
    const p = await r.json();
    if (!r.ok) { setError(p.error ?? "Could not update suggestion."); return; }
    setError("");
    setSuggestions(p.suggestions ?? []);
  }

  const titleNearLimit = title.length >= 100;

  return (
    <div>
      <PageTitle title="Proposals" subtitle="Pitch an improvement, vote ideas up or down, and help shape what gets built next." />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Submission form */}
        <aside className="h-fit rounded-xl border border-white/10 bg-white/8 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-white/50">New Proposal</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div>
              <input
                className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                maxLength={120}
                placeholder="One-line title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className={`mt-1 text-right text-[10px] font-bold ${titleNearLimit ? "text-amber-400" : "text-white/30"}`}>{title.length}/120</p>
            </div>
            <textarea
              className="min-h-28 w-full resize-none rounded-lg border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/35 focus:border-amber-400/60 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
              maxLength={1000}
              placeholder="What should change, and why? (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <button
              className="w-full rounded-lg bg-amber-400 py-2.5 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
              disabled={busy || !title.trim()}
            >
              {busy ? "Submitting…" : "Submit Proposal"}
            </button>
          </form>
          {error ? (
            <div className="mt-3 rounded-lg bg-red-950/30 px-3 py-2.5 text-sm font-semibold text-red-200">
              {error}
              {error.toLowerCase().includes("login") ? <Link className="ml-1 font-black underline" href="/login">Log in</Link> : null}
            </div>
          ) : null}
        </aside>

        {/* Suggestions list */}
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-sm font-bold text-white/50">No proposals yet — be the first.</p>
            </div>
          ) : (
            suggestions.map((s) => {
              const net = s.upvotes - s.downvotes;
              const scoreColour = net > 0 ? "bg-green-500/15 text-green-300 ring-green-500/20" : net < 0 ? "bg-red-500/15 text-red-300 ring-red-500/20" : "bg-white/8 text-white/40 ring-white/10";
              return (
                <article
                  key={s.id}
                  className={`rounded-xl border p-4 shadow-sm transition ${
                    s.implemented_at
                      ? "border-green-500/25 bg-green-950/20"
                      : "border-white/10 bg-white/6"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Net score */}
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg ring-1 ${scoreColour}`}>
                      <span className="text-sm font-black leading-none">{net > 0 ? `+${net}` : net}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words font-black text-white">{s.title}</h2>
                        {s.implemented_at ? (
                          <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-green-300">
                            ✓ Done
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-0.5 text-xs font-semibold text-white/40">
                        {s.username} · {formatDate(s.created_at)}
                        {s.implemented_at ? ` · shipped ${formatDate(s.implemented_at)}${s.implemented_by_username ? ` by ${s.implemented_by_username}` : ""}` : ""}
                      </p>

                      {s.details ? (
                        <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/65">{s.details}</p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => vote(s.id, 1)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                            s.user_vote === 1
                              ? "bg-green-500/20 text-green-300 ring-1 ring-green-500/30"
                              : "bg-white/8 text-white/55 hover:bg-white/12 hover:text-white/80"
                          }`}
                        >
                          ▲ {s.upvotes}
                        </button>
                        <button
                          onClick={() => vote(s.id, -1)}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition ${
                            s.user_vote === -1
                              ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                              : "bg-white/8 text-white/55 hover:bg-white/12 hover:text-white/80"
                          }`}
                        >
                          ▼ {s.downvotes}
                        </button>
                        {isAdmin ? (
                          <button
                            onClick={() => toggleImplemented(s)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                              s.implemented_at
                                ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                                : "bg-green-500/15 text-green-300 hover:bg-green-500/25"
                            }`}
                          >
                            {s.implemented_at ? "Mark undone" : "Mark done"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function markImplementedSuggestionsSeen(suggestions: Suggestion[]) {
  const times = suggestions
    .map((s) => s.implemented_at)
    .filter((v): v is string => Boolean(v))
    .map((v) => new Date(v).getTime());
  if (times.length === 0) return;
  window.localStorage.setItem("kmxi-last-implemented-idea-seen", String(Math.max(...times)));
}
