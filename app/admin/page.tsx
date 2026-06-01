"use client";

import { useState } from "react";
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
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [winner, setWinner] = useState<"home" | "away" | "draw" | "">("");
  const [status, setStatus] = useState<MatchStatus>("FINISHED");
  const [matchDate, setMatchDate] = useState(today);
  const [kickoffTime, setKickoffTime] = useState("20:00");
  const [submitting, setSubmitting] = useState(false);
  const [log, setLog] = useState<SubmittedResult[]>([]);
  const [forbidden, setForbidden] = useState(false);

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
        body: JSON.stringify({
          matchId,
          matchDate,
          kickoffAt,
          homeTeam,
          awayTeam,
          winner: resolvedWinner,
          status,
        }),
      });

      if (res.status === 403) {
        setForbidden(true);
        return;
      }

      const data = (await res.json()) as { ok?: boolean; error?: string };
      setLog((prev) => [
        {
          matchId,
          homeTeam,
          awayTeam,
          winner: resolvedWinner,
          status,
          matchDate,
          ok: res.ok,
          error: data.error,
        },
        ...prev,
      ]);

      if (res.ok) {
        setWinner("");
      }
    } finally {
      setSubmitting(false);
    }
  }

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
      <PageTitle title="Admin" subtitle="Manually enter World Cup results to trigger bonuses." />

      <div className="grid gap-6 lg:grid-cols-[480px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-green-900/10 bg-white p-6 shadow-sm space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Home Team">
              <TeamSelect value={homeTeam} onChange={setHomeTeam} exclude={awayTeam} />
            </Field>
            <Field label="Away Team">
              <TeamSelect value={awayTeam} onChange={setAwayTeam} exclude={homeTeam} />
            </Field>
          </div>

          <Field label="Result">
            <div className="grid grid-cols-3 gap-2">
              {(["home", "draw", "away"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setWinner(opt)}
                  className={`rounded-md px-3 py-2 text-sm font-black transition-colors ${
                    winner === opt
                      ? "bg-green-950 text-white"
                      : "bg-green-950/8 text-green-950 hover:bg-green-950/15 focus:ring-2 focus:ring-green-800 focus:outline-none"
                  }`}
                >
                  {opt === "home"
                    ? homeTeam || "Home"
                    : opt === "away"
                    ? awayTeam || "Away"
                    : "Draw"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Status">
            <div className="grid grid-cols-3 gap-2">
              {(["SCHEDULED", "LIVE", "FINISHED"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-md px-3 py-2 text-sm font-black transition-colors ${
                    status === s
                      ? "bg-green-950 text-white"
                      : "bg-green-950/8 text-green-950 hover:bg-green-950/15 focus:ring-2 focus:ring-green-800 focus:outline-none"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Match Date">
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800"
                required
              />
            </Field>
            <Field label="Kickoff (UTC)">
              <input
                type="time"
                value={kickoffTime}
                onChange={(e) => setKickoffTime(e.target.value)}
                className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800"
                required
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting || !homeTeam || !awayTeam || homeTeam === awayTeam}
            className="w-full rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800 disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Save Result"}
          </button>
        </form>

        <div className="space-y-3">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Submission Log</p>
          {log.length === 0 ? (
            <p className="text-sm font-semibold text-green-900/60">No results submitted this session.</p>
          ) : (
            log.map((entry, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 text-sm font-semibold ${
                  entry.ok
                    ? "border-green-200 bg-green-50 text-green-950"
                    : "border-red-200 bg-red-50 text-red-950"
                }`}
              >
                <p className="font-black">
                  {entry.homeTeam} vs {entry.awayTeam} — {entry.matchDate}
                </p>
                <p className="mt-1">
                  Winner: {entry.winner ?? "None"} · Status: {entry.status}
                </p>
                {entry.error ? <p className="mt-1 text-red-700">{entry.error}</p> : null}
                <p className="mt-1 text-xs opacity-60">{entry.matchId}</p>
              </div>
            ))
          )}
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
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-green-900/20 bg-white px-3 py-2 text-sm font-semibold text-green-950 focus:outline-none focus:ring-2 focus:ring-green-800"
      required
    >
      <option value="">Select team…</option>
      {WC_TEAMS.filter((t) => t !== exclude).map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}
