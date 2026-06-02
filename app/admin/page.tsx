"use client";

import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";

type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED";

type SubmittedResult = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  winner: string | null;
  status: MatchStatus;
  matchDate: string;
  ok: boolean;
  error?: string;
};

type GoalScorerRow = {
  id: number;
  match_id: string;
  scorer_name_raw: string;
  player_id: number | null;
  goal_count: number;
  status: string;
  source: string;
  home_team: string | null;
  away_team: string | null;
  match_date: string | null;
};

const WC_TEAMS = [
  "Argentina", "Australia", "Belgium", "Brazil", "Cameroon", "Canada",
  "Chile", "Colombia", "Costa Rica", "Croatia", "Czech Republic", "Denmark",
  "Ecuador", "Egypt", "England", "France", "Germany", "Ghana", "Greece",
  "Honduras", "Hungary", "Indonesia", "Iran", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Kenya", "Malaysia", "Mexico", "Morocco", "Netherlands",
  "New Zealand", "Nigeria", "Panama", "Paraguay", "Peru", "Poland",
  "Portugal", "Qatar", "Romania", "Saudi Arabia", "Senegal", "Serbia",
  "Slovenia", "South Africa", "South Korea", "Spain", "Switzerland",
  "Thailand", "Tunisia", "Turkey", "Ukraine", "United States", "Uruguay",
  "Venezuela", "Vietnam", "DR Congo",
].sort();

const today = new Date().toISOString().slice(0, 10);

export default function AdminPage() {
  const [tab, setTab] = useState<"results" | "goalscorers">("results");
  const [forbidden, setForbidden] = useState(false);

  if (forbidden) {
    return (
      <div>
        <PageTitle title="Admin" subtitle="Results management" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="font-bold text-red-900">Access denied. You must be logged in as the admin account.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Admin" subtitle="Tournament management" />

      <div className="mb-6 flex gap-2">
        {(["results", "goalscorers"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-black transition-colors ${tab === t ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}
          >
            {t === "results" ? "Match Results" : "Goal Scorers"}
          </button>
        ))}
      </div>

      {tab === "results" && <ResultsTab onForbidden={() => setForbidden(true)} />}
      {tab === "goalscorers" && <GoalScorersTab onForbidden={() => setForbidden(true)} />}
    </div>
  );
}

function ResultsTab({ onForbidden }: { onForbidden: () => void }) {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [winner, setWinner] = useState<"home" | "away" | "draw" | "">("");
  const [status, setStatus] = useState<MatchStatus>("FINISHED");
  const [matchDate, setMatchDate] = useState(today);
  const [kickoffTime, setKickoffTime] = useState("20:00");
  const [submitting, setSubmitting] = useState(false);
  const [log, setLog] = useState<SubmittedResult[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeam || !awayTeam || homeTeam === awayTeam) return;

    const kickoffAt = `${matchDate}T${kickoffTime}:00.000Z`;
    const matchId = `manual-${matchDate}-${homeTeam.toLowerCase().replace(/\s+/g, "-")}-vs-${awayTeam.toLowerCase().replace(/\s+/g, "-")}`;
    const resolvedWinner =
      winner === "home" ? homeTeam : winner === "away" ? awayTeam : null;

    setSubmitting(true);
    try {
      const res = await fetch("/api/live/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ matchId, matchDate, kickoffAt, homeTeam, awayTeam, winner: resolvedWinner, status }),
      });

      if (res.status === 403) { onForbidden(); return; }

      const data = (await res.json()) as { ok?: boolean; error?: string };
      setLog((prev) => [{ matchId, homeTeam, awayTeam, winner: resolvedWinner, status, matchDate, ok: res.ok, error: data.error }, ...prev]);
      if (res.ok) setWinner("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[480px_1fr]">
      <form onSubmit={handleSubmit} className="rounded-lg border border-green-900/10 bg-white p-6 shadow-sm space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Home Team"><TeamSelect value={homeTeam} onChange={setHomeTeam} exclude={awayTeam} /></Field>
          <Field label="Away Team"><TeamSelect value={awayTeam} onChange={setAwayTeam} exclude={homeTeam} /></Field>
        </div>

        <Field label="Result">
          <div className="grid grid-cols-3 gap-2">
            {(["home", "draw", "away"] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => setWinner(opt)}
                className={`rounded-md px-3 py-2 text-sm font-black transition-colors ${winner === opt ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
                {opt === "home" ? homeTeam || "Home" : opt === "away" ? awayTeam || "Away" : "Draw"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Status">
          <div className="grid grid-cols-3 gap-2">
            {(["SCHEDULED", "LIVE", "FINISHED"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-2 text-sm font-black transition-colors ${status === s ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
                {s}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Match Date">
            <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)}
              className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
          <Field label="Kickoff (UTC)">
            <input type="time" value={kickoffTime} onChange={(e) => setKickoffTime(e.target.value)}
              className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required />
          </Field>
        </div>

        <button type="submit" disabled={submitting || !homeTeam || !awayTeam || homeTeam === awayTeam}
          className="w-full rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40">
          {submitting ? "Saving…" : "Save Result"}
        </button>
      </form>

      <div className="space-y-3">
        <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Submission Log</p>
        {log.length === 0 ? (
          <p className="text-sm font-semibold text-green-900/60">No results submitted this session.</p>
        ) : (
          log.map((entry, i) => (
            <div key={i} className={`rounded-lg border p-4 text-sm font-semibold ${entry.ok ? "border-green-200 bg-green-50 text-green-950" : "border-red-200 bg-red-50 text-red-950"}`}>
              <p className="font-black">{entry.homeTeam} vs {entry.awayTeam} — {entry.matchDate}</p>
              <p className="mt-1">Winner: {entry.winner ?? "None"} · Status: {entry.status}</p>
              {entry.error ? <p className="mt-1 text-red-700">{entry.error}</p> : null}
              <p className="mt-1 text-xs opacity-60">{entry.matchId}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GoalScorersTab({ onForbidden }: { onForbidden: () => void }) {
  const [goals, setGoals] = useState<GoalScorerRow[]>([]);
  const [assists, setAssists] = useState<GoalScorerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventType, setEventType] = useState<"goal" | "assist">("goal");
  const [filter, setFilter] = useState<"all" | "pending" | "matched" | "ignored">("pending");
  const [addMatchId, setAddMatchId] = useState("");
  const [addScorerName, setAddScorerName] = useState("");
  const [addCount, setAddCount] = useState(1);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/goal-scorers", { credentials: "include" });
      if (res.status === 403) { onForbidden(); return; }
      const data = (await res.json()) as { goalScorers: GoalScorerRow[]; assistScorers: GoalScorerRow[] };
      setGoals(data.goalScorers ?? []);
      setAssists(data.assistScorers ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: number, playerId: number | null) {
    await fetch("/api/admin/goal-scorers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "resolve", eventType, id, playerId }),
    });
    await load();
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!addMatchId || !addScorerName) return;
    setAdding(true);
    try {
      await fetch("/api/admin/goal-scorers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "add", eventType, matchId: addMatchId, scorerName: addScorerName, count: addCount }),
      });
      setAddScorerName("");
      await load();
    } finally {
      setAdding(false);
    }
  }

  const active = eventType === "goal" ? goals : assists;
  const filtered = active.filter((s) => filter === "all" || s.status === filter);
  const pendingGoals = goals.filter((s) => s.status === "pending").length;
  const pendingAssists = assists.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Event type toggle */}
      <div className="flex gap-2">
        {(["goal", "assist"] as const).map((t) => (
          <button key={t} onClick={() => setEventType(t)}
            className={`rounded-md px-4 py-2 text-sm font-black transition-colors ${eventType === t ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
            {t === "goal" ? `Goals${pendingGoals > 0 ? ` (${pendingGoals} pending)` : ""}` : `Assists${pendingAssists > 0 ? ` (${pendingAssists} pending)` : ""}`}
          </button>
        ))}
      </div>

      {/* Add manual entry */}
      <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-black uppercase tracking-wide text-green-900/60">Add {eventType === "goal" ? "Goal Scorer" : "Assist"} Manually</p>
        <form onSubmit={addManual} className="flex flex-wrap gap-3">
          <input value={addMatchId} onChange={(e) => setAddMatchId(e.target.value)} placeholder="Match ID (e.g. football-data-123)"
            className="flex-1 min-w-48 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <input value={addScorerName} onChange={(e) => setAddScorerName(e.target.value)} placeholder="Player name (e.g. K. Mbappé)"
            className="flex-1 min-w-48 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <input type="number" min={1} max={10} value={addCount} onChange={(e) => setAddCount(Number(e.target.value))}
            title={eventType === "goal" ? "Goals scored" : "Assists"}
            className="w-16 rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" />
          <button type="submit" disabled={adding || !addMatchId || !addScorerName}
            className="rounded-md bg-green-950 px-4 py-2 text-sm font-black text-white hover:bg-green-800 disabled:opacity-40">
            {adding ? "Adding…" : "Add & Fuzzy Match"}
          </button>
        </form>
      </div>

      {/* Filter + list */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex gap-2">
            {(["all", "pending", "matched", "ignored"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-colors ${filter === f ? "bg-green-950 text-white" : "bg-green-950/8 text-green-950 hover:bg-green-950/15"}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={load} className="ml-auto rounded-md bg-green-950/8 px-3 py-1.5 text-xs font-black text-green-950 hover:bg-green-950/15">Refresh</button>
        </div>

        {loading ? (
          <p className="text-sm font-semibold text-green-900/60">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm font-semibold text-green-900/60">No records in this filter.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((scorer) => (
              <GoalScorerCard key={scorer.id} scorer={scorer} eventType={eventType} onResolve={resolve} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalScorerCard({ scorer, eventType, onResolve }: { scorer: GoalScorerRow; eventType: "goal" | "assist"; onResolve: (id: number, playerId: number | null) => void }) {
  const [playerIdInput, setPlayerIdInput] = useState(scorer.player_id?.toString() ?? "");

  const statusColour =
    scorer.status === "matched" ? "border-green-200 bg-green-50"
    : scorer.status === "ignored" ? "border-slate-200 bg-slate-50"
    : "border-amber-200 bg-amber-50";

  return (
    <div className={`rounded-lg border p-4 text-sm ${statusColour}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-green-950">{scorer.scorer_name_raw}</p>
          <p className="mt-0.5 text-xs font-semibold text-green-900/60">
            {scorer.home_team ?? "?"} vs {scorer.away_team ?? "?"} · {scorer.match_date ?? scorer.match_id}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-green-900/40">
            Status: {scorer.status} · Source: {scorer.source} · {eventType === "goal" ? `Goals: ${scorer.goal_count}` : `Assists: ${scorer.goal_count}`}
            {scorer.player_id != null ? ` · Player ID: ${scorer.player_id}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={playerIdInput}
            onChange={(e) => setPlayerIdInput(e.target.value)}
            placeholder="Player ID"
            className="w-24 rounded-md border border-green-900/20 bg-white px-2 py-1.5 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800"
          />
          <button
            onClick={() => onResolve(scorer.id, playerIdInput ? Number(playerIdInput) : null)}
            className="rounded-md bg-green-950 px-3 py-1.5 text-xs font-black text-white hover:bg-green-800"
          >
            Match
          </button>
          <button
            onClick={() => onResolve(scorer.id, null)}
            className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-300"
          >
            Ignore
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-black uppercase tracking-wide text-green-900/60">{label}</label>
      {children}
    </div>
  );
}

function TeamSelect({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800" required>
      <option value="">Select team…</option>
      {WC_TEAMS.filter((t) => t !== exclude).map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
