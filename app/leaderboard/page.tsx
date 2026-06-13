"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/Skeleton";

type Entry = {
  username: string;
  total_km: number;
  games_won: number;
  best_squad_rating: number;
  goal_bonus: number;
  assist_bonus: number;
  movement: number | null;
};
type Matchday = { date: string; entries: Array<{ username: string; credits: number; boost: number }> };

type MetricKey = "rating" | "activity" | "goals" | "assists";
const METRICS: Record<MetricKey, { label: string; get: (e: Entry) => number; fmt: (v: number) => string }> = {
  rating: { label: "Squad Avg", get: (e) => e.best_squad_rating, fmt: (v) => (v > 0 ? v.toFixed(1) : "—") },
  activity: { label: "Activity", get: (e) => e.total_km, fmt: (v) => v.toFixed(1) },
  goals: { label: "Goals", get: (e) => e.goal_bonus, fmt: (v) => (v > 0 ? `+${v}` : v < 0 ? String(v) : "—") },
  assists: { label: "Assists", get: (e) => e.assist_bonus, fmt: (v) => (v > 0 ? `+${v}` : v < 0 ? String(v) : "—") }
};

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<Entry[] | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [view, setView] = useState<"overall" | "matchday">("overall");
  const [sort, setSort] = useState<MetricKey>("rating");

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setLeaderboard(d.leaderboard ?? []);
        setMatchdays(d.matchdays ?? []);
      })
      .catch(() => setLeaderboard([]));
  }, []);

  const metric = METRICS[sort];
  const sorted = useMemo(() => (leaderboard ? [...leaderboard].sort((a, b) => metric.get(b) - metric.get(a)) : []), [leaderboard, metric]);
  const maxVal = Math.max(1, ...sorted.map((e) => metric.get(e)));

  return (
    <div>
      <PageTitle title="Leaderboard" subtitle="Your best possible XI versus the rest of the group." />

      <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-lg border border-green-900/10 bg-white p-1 shadow-sm sm:inline-grid sm:w-auto sm:grid-flow-col">
        {(["overall", "matchday"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-5 py-2 text-sm font-black transition ${view === v ? "bg-pitch text-white shadow-sm" : "text-green-950 hover:bg-green-950/5"}`}
          >
            {v === "overall" ? "Overall" : "Matchday"}
          </button>
        ))}
      </div>

      {view === "overall" ? (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(Object.keys(METRICS) as MetricKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-black transition ${sort === key ? "bg-green-950 text-white" : "bg-green-950/5 text-green-950 hover:bg-green-950/10"}`}
              >
                {METRICS[key].label}
              </button>
            ))}
          </div>

          {leaderboard === null ? (
            <LoadingState />
          ) : sorted.length === 0 ? (
            <p className="rounded-lg border border-green-900/10 bg-white p-6 text-sm font-semibold text-green-900/60 shadow-sm">No entries yet — be the first to log an activity!</p>
          ) : (
            <section className="space-y-2">
              {sorted.map((entry, i) => (
                <RankRow key={entry.username} entry={entry} rank={i + 1} value={metric.get(entry)} display={metric.fmt(metric.get(entry))} maxVal={maxVal} showMovement={sort === "rating"} />
              ))}
            </section>
          )}
        </>
      ) : (
        <MatchdayView matchdays={matchdays} loading={leaderboard === null} />
      )}
    </div>
  );
}

const RANK_CHIP: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-300 to-gold text-green-950",
  2: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900",
  3: "bg-gradient-to-br from-orange-300 to-amber-700 text-white"
};

function RankRow({ entry, rank, value, display, maxVal, showMovement }: { entry: Entry; rank: number; value: number; display: string; maxVal: number; showMovement: boolean }) {
  const barPct = Math.max(2, Math.min(100, (Math.max(0, value) / maxVal) * 100));
  const top = rank <= 3;
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 shadow-sm transition hover:shadow-md ${rank === 1 ? "border-gold/50 bg-amber-50/40" : "border-green-900/10 bg-white"}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${top ? RANK_CHIP[rank] : "bg-green-950/5 text-green-900/50"}`}>
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link className="truncate text-sm font-black text-green-950 hover:underline" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link>
          {showMovement ? <MovementTag movement={entry.movement} /> : null}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-green-950/10">
          <div className={`h-full rounded-full transition-all ${rank === 1 ? "bg-gradient-to-r from-amber-400 to-gold" : "bg-pitch"}`} style={{ width: `${barPct}%` }} />
        </div>
      </div>
      <span className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-gradient-to-br from-amber-200 to-gold">
        <span className="text-base font-black leading-none text-green-950">{display}</span>
      </span>
    </div>
  );
}

function MatchdayView({ matchdays, loading }: { matchdays: Matchday[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
            <Skeleton className="h-4 w-32" />
            <div className="mt-3 space-y-2">{Array.from({ length: 3 }).map((_, j) => <Skeleton key={j} className="h-3" />)}</div>
          </div>
        ))}
      </div>
    );
  }
  if (matchdays.length === 0) {
    return <p className="rounded-lg border border-green-900/10 bg-white p-6 text-sm font-semibold text-green-900/60 shadow-sm">No matchdays scored yet — they appear here once games finish and rewards land.</p>;
  }
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-green-900/60">Each day&apos;s winner takes the crown 👑 and sets the next day&apos;s news. Pack credits from wins, plus goal &amp; assist boosts.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {matchdays.map((day, idx) => (
          <div key={day.date} className={`rounded-lg border bg-white p-4 shadow-sm ${idx === 0 ? "border-pitch/30" : "border-green-900/10"}`}>
            <div className="flex items-center justify-between gap-3 border-b border-green-900/10 pb-2">
              <p className="flex items-center gap-2 text-sm font-black text-green-950">
                {day.date}
                {idx === 0 ? <span className="rounded-full bg-pitch px-2 py-0.5 text-[10px] font-black text-white">Latest</span> : null}
              </p>
              {day.entries[0] ? <p className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">👑 {day.entries[0].username}</p> : null}
            </div>
            <div className="mt-2 space-y-1.5">
              {day.entries.slice(0, 6).map((entry, i) => (
                <div key={entry.username} className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-2 text-sm">
                  <span className="font-black text-green-900/40">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                  <Link className="truncate font-bold text-green-950 hover:underline" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link>
                  <span className="font-black text-amber-700">{entry.credits > 0 ? `+${entry.credits}cr` : "—"}</span>
                  <span className={`w-12 text-right font-black ${entry.boost > 0 ? "text-green-700" : entry.boost < 0 ? "text-red-600" : "text-green-900/30"}`}>
                    {entry.boost !== 0 ? (entry.boost > 0 ? `+${entry.boost}` : entry.boost) : "—"}
                  </span>
                </div>
              ))}
              {day.entries.length === 0 ? <p className="text-sm font-semibold text-green-900/50">No rewards earned this matchday.</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MovementTag({ movement }: { movement: number | null }) {
  if (movement === null) return <span className="rounded-full bg-sky-100 px-1.5 text-[9px] font-black uppercase text-sky-700">New</span>;
  if (movement === 0) return <span className="text-[10px] font-black text-green-900/30">—</span>;
  const up = movement > 0;
  return (
    <span className={`text-[10px] font-black ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(movement)}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-green-900/10 bg-white px-3 py-2.5 shadow-sm">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-10 w-12 rounded-md" />
        </div>
      ))}
    </div>
  );
}
