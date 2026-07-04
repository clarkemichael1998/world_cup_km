"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/Skeleton";

type Entry = {
  username: string;
  total_km: number;
  games_won: number;
  daily_wins: number;
  best_squad_rating: number;
  goal_bonus: number;
  assist_bonus: number;
  movement: number | null;
};
type LiveMatchdayEntry = {
  method: "live";
  username: string;
  activityRaw: number;
  activityPoints: number;
  winCount: number;
  winPoints: number;
  boostRaw: number;
  footballRaw: number;
  footballPoints: number;
  total: number;
};
type LegacyMatchdayEntry = { method: "legacy"; username: string; credits: number; boost: number };
type MatchdayEntry = LiveMatchdayEntry | LegacyMatchdayEntry;
type Matchday = { date: string; entries: MatchdayEntry[] };

type MetricKey = "rating" | "wins" | "activity" | "goals" | "assists";
const METRICS: Record<MetricKey, { label: string; get: (e: Entry) => number; fmt: (v: number) => string }> = {
  rating: { label: "Squad Avg", get: (e) => e.best_squad_rating, fmt: (v) => (v > 0 ? v.toFixed(1) : "—") },
  wins: { label: "Daily Wins", get: (e) => e.daily_wins, fmt: (v) => (v > 0 ? String(v) : "—") },
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
                className={`rounded-md px-3 py-1.5 text-xs font-black transition ${sort === key ? "bg-white text-green-950 shadow-sm" : "bg-white/10 text-white/80 hover:bg-white/15"}`}
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
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 shadow-sm transition hover:shadow-md ${rank === 1 ? "border-amber-300/70 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 shadow-amber-200/60" : "border-green-900/10 bg-white"}`}>
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
  const hasLegacy = matchdays.some((day) => day.entries[0]?.method === "legacy");
  const hasLive = matchdays.some((day) => day.entries[0]?.method === "live");

  return (
    <div>
      <div className="mb-3 space-y-1.5 rounded-lg border border-white/10 bg-white/8 p-3 text-xs font-bold text-white/70">
        {hasLive ? (
          <p>
            From today onward — same formula as a cup match: <span className="text-white">Activity points</span> (1 per activity credit logged, capped at 40) +{" "}
            <span className="text-white">Football points</span> (+2 per locked player whose nation won, plus goal/assist boost amounts, capped at 40) ={" "}
            <span className="text-white">Total</span>. Tied totals are broken by whoever logged more uncapped activity that day.
          </p>
        ) : null}
        {hasLegacy ? (
          <p>Days before today keep the crown they were originally awarded — ranked by pack credits earned, then boost amount, under the old rules.</p>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {matchdays.map((day, idx) => {
          const isLegacyDay = day.entries[0]?.method === "legacy";
          return (
            <div key={day.date} className={`rounded-lg border bg-white p-4 shadow-sm ${idx === 0 ? "border-pitch/30" : "border-green-900/10"}`}>
              <div className="flex items-center justify-between gap-3 border-b border-green-900/10 pb-2">
                <p className="flex items-center gap-2 text-sm font-black text-green-950">
                  {day.date}
                  {idx === 0 ? <span className="rounded-full bg-pitch px-2 py-0.5 text-[10px] font-black text-white">Latest</span> : null}
                  {isLegacyDay ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">Legacy scoring</span> : null}
                </p>
                {day.entries[0] ? <p className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">👑 {day.entries[0].username}</p> : null}
              </div>
              {isLegacyDay ? (
                <div className="mt-2 grid grid-cols-[20px_1fr_auto_auto] items-center gap-x-2 gap-y-1.5 text-sm">
                  <span />
                  <span />
                  <span className="text-right text-[9px] font-black uppercase tracking-wide text-green-900/40">Credits</span>
                  <span className="text-right text-[9px] font-black uppercase tracking-wide text-green-900/40">Boost</span>
                  {day.entries.map((entry, i) => <LegacyMatchdayRow key={entry.username} entry={entry as LegacyMatchdayEntry} rank={i + 1} />)}
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-[20px_1fr_auto_auto_auto] items-center gap-x-2 gap-y-1.5 text-sm">
                  <span />
                  <span />
                  <span className="text-right text-[9px] font-black uppercase tracking-wide text-green-900/40">Activity</span>
                  <span className="text-right text-[9px] font-black uppercase tracking-wide text-green-900/40">Football</span>
                  <span className="text-right text-[9px] font-black uppercase tracking-wide text-green-900/40">Total</span>
                  {day.entries.map((entry, i) => <LiveMatchdayRow key={entry.username} entry={entry as LiveMatchdayEntry} rank={i + 1} />)}
                </div>
              )}
              {day.entries.length === 0 ? <p className="mt-2 text-sm font-semibold text-green-900/50">No locked squads this matchday.</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegacyMatchdayRow({ entry, rank }: { entry: LegacyMatchdayEntry; rank: number }) {
  return (
    <>
      <span className="font-black text-green-900/40">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}</span>
      <Link className="truncate font-bold text-green-950 hover:underline" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link>
      <span className="text-right font-black text-amber-700">{entry.credits > 0 ? `+${entry.credits}cr` : "—"}</span>
      <span className={`text-right font-bold ${entry.boost > 0 ? "text-green-700" : entry.boost < 0 ? "text-red-600" : "text-green-900/30"}`}>
        {entry.boost !== 0 ? (entry.boost > 0 ? `+${entry.boost}` : entry.boost) : "—"}
      </span>
    </>
  );
}

function LiveMatchdayRow({ entry, rank }: { entry: LiveMatchdayEntry; rank: number }) {
  const activityCapped = entry.activityRaw > entry.activityPoints;
  const footballCapped = entry.footballRaw > entry.footballPoints;
  return (
    <>
      <span className="font-black text-green-900/40">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}</span>
      <Link className="truncate font-bold text-green-950 hover:underline" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link>
      <span className="text-right font-bold text-green-900/70" title={activityCapped ? `${entry.activityRaw.toFixed(1)} logged, capped at 40` : undefined}>
        {entry.activityPoints.toFixed(1)}
        {activityCapped ? <span className="text-green-900/35">*</span> : null}
      </span>
      <span
        className={`text-right font-bold ${entry.footballPoints > 0 ? "text-amber-700" : entry.footballPoints < 0 ? "text-red-600" : "text-green-900/35"}`}
        title={footballCapped ? `${entry.footballRaw} earned, capped at 40` : `${entry.winCount} nation win${entry.winCount === 1 ? "" : "s"}, ${entry.boostRaw >= 0 ? "+" : ""}${entry.boostRaw} boosts`}
      >
        {entry.footballPoints.toFixed(0)}
        {footballCapped ? <span className="text-green-900/35">*</span> : null}
      </span>
      <span className="text-right font-black text-green-950">{entry.total.toFixed(1)}</span>
    </>
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
