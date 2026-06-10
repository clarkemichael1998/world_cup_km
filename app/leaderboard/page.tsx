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
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  return (
    <div>
      <PageTitle title="Leaderboard" subtitle="Your best possible XI versus the rest of the group." />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(METRICS) as MetricKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={`rounded-md px-3 py-1.5 text-xs font-black transition ${sort === key ? "bg-pitch text-white" : "bg-green-950/5 text-green-950 hover:bg-green-950/10"}`}
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
        <>
          {podium.length > 0 ? (
            <section className="mb-4 grid grid-cols-3 items-end gap-2 sm:gap-3">
              {[podium[1], podium[0], podium[2]].map((entry, i) =>
                entry ? <PodiumCard key={entry.username} entry={entry} place={i === 1 ? 1 : i === 0 ? 2 : 3} value={metric.fmt(metric.get(entry))} metricLabel={metric.label} /> : <div key={i} />
              )}
            </section>
          ) : null}

          <section className="space-y-2">
            {rest.map((entry, i) => (
              <RankRow key={entry.username} entry={entry} rank={i + 4} value={metric.get(entry)} display={metric.fmt(metric.get(entry))} maxVal={maxVal} showMovement={sort === "rating"} />
            ))}
          </section>
        </>
      )}

      {matchdays.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-black text-green-950">Matchday Head-to-Head</h2>
          <p className="mt-1 text-sm font-semibold text-green-900/60">Each day&apos;s winner — pack credits from wins, plus goal and assist boosts.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchdays.map((day) => (
              <div key={day.date} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-green-900/10 pb-2">
                  <p className="text-sm font-black text-green-950">{day.date}</p>
                  {day.entries[0] ? <p className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">👑 {day.entries[0].username}</p> : null}
                </div>
                <div className="mt-2 space-y-1.5">
                  {day.entries.slice(0, 5).map((entry, i) => (
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
        </section>
      ) : null}
    </div>
  );
}

function PodiumCard({ entry, place, value, metricLabel }: { entry: Entry; place: 1 | 2 | 3; value: string; metricLabel: string }) {
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  const leader = place === 1;
  return (
    <Link
      href={`/profile/${encodeURIComponent(entry.username)}`}
      className={`album-paper flex flex-col items-center rounded-lg border bg-[#fbf7ea] p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${leader ? "border-gold/60 pb-5 pt-5" : "border-green-900/10"}`}
    >
      <span className="text-lg">{medal}</span>
      <span className={`mt-1.5 flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-gold shadow-sm ${leader ? "h-16 w-16" : "h-12 w-12"}`}>
        <span className={`font-black leading-none text-green-950 ${leader ? "text-2xl" : "text-lg"}`}>{value}</span>
        <span className="text-[7px] font-black uppercase tracking-wide text-green-950/60">{metricLabel}</span>
      </span>
      <span className={`mt-2 truncate font-black text-green-950 ${leader ? "text-base" : "text-sm"}`}>{entry.username}</span>
      <MovementTag movement={entry.movement} />
    </Link>
  );
}

function RankRow({ entry, rank, value, display, maxVal, showMovement }: { entry: Entry; rank: number; value: number; display: string; maxVal: number; showMovement: boolean }) {
  const barPct = Math.max(2, Math.min(100, (Math.max(0, value) / maxVal) * 100));
  return (
    <div className="flex items-center gap-3 rounded-lg border border-green-900/10 bg-white px-3 py-2.5 shadow-sm transition hover:shadow-md">
      <span className="w-6 shrink-0 text-center text-sm font-black text-green-900/40">{rank}</span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-xs font-black text-green-950">
        {entry.username.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link className="truncate text-sm font-black text-green-950 hover:underline" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link>
          {showMovement ? <MovementTag movement={entry.movement} inline /> : null}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-green-950/10">
          <div className="h-full rounded-full bg-pitch transition-all" style={{ width: `${barPct}%` }} />
        </div>
      </div>
      <span className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-gradient-to-br from-amber-200 to-gold">
        <span className="text-base font-black leading-none text-green-950">{display}</span>
      </span>
    </div>
  );
}

function MovementTag({ movement, inline = false }: { movement: number | null; inline?: boolean }) {
  if (movement === null) {
    return <span className={`${inline ? "" : "mt-0.5 "}rounded-full bg-sky-100 px-1.5 text-[9px] font-black uppercase text-sky-700`}>New</span>;
  }
  if (movement === 0) {
    return <span className={`${inline ? "" : "mt-0.5 "}text-[10px] font-black text-green-900/30`}>—</span>;
  }
  const up = movement > 0;
  return (
    <span className={`${inline ? "" : "mt-0.5 "}text-[10px] font-black ${up ? "text-green-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(movement)}
    </span>
  );
}

function LoadingState() {
  return (
    <>
      <div className="mb-4 grid grid-cols-3 items-end gap-2 sm:gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-green-900/10 bg-white p-3 shadow-sm">
            <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
            <Skeleton className="mx-auto mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-green-900/10 bg-white px-3 py-2.5 shadow-sm">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-10 w-12 rounded-md" />
          </div>
        ))}
      </div>
    </>
  );
}
