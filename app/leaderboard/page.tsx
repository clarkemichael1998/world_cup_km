"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/Skeleton";

type Entry = { username: string; total_km: number; games_won: number; best_squad_rating: number; goal_bonus: number; assist_bonus: number };
type Matchday = { date: string; entries: Array<{ username: string; credits: number; boost: number }> };

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<Entry[] | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setLeaderboard(d.leaderboard ?? []);
        setMatchdays(d.matchdays ?? []);
      })
      .catch(() => setLeaderboard([]));
  }, []);

  return (
    <div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <PageTitle title="Leaderboard" subtitle="Ranked by your strongest possible squad average." />
        <Link className="mb-6 self-start rounded-md bg-pitch px-4 py-2 text-sm font-black text-white hover:bg-green-800 sm:mb-8" href="/squads">
          View squads
        </Link>
      </div>

      <section className="mt-2 overflow-x-auto overflow-hidden rounded-lg border border-green-900/10 bg-white shadow-sm">
        {leaderboard === null ? (
          <div className="divide-y divide-green-900/10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-4 w-10" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="p-6 text-sm font-semibold text-green-900/60">No entries yet - be the first to log an activity!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-900/10 bg-green-950/5 text-left text-xs font-bold uppercase tracking-wide text-green-900/60">
                <th className="w-10 px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Squad Avg</th>
                <th className="px-4 py-3 text-right">Activity Credits</th>
                <th className="px-4 py-3 text-right">Wins</th>
                <th className="px-4 py-3 text-right">Goal Boost</th>
                <th className="px-4 py-3 text-right">Assist Boost</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <tr key={entry.username} className={`border-b border-green-900/10 last:border-0 ${i === 0 ? "bg-amber-50" : "hover:bg-green-950/[0.03]"}`}>
                    <td className="px-4 py-3 text-center font-black text-green-900/40">{medal ?? i + 1}</td>
                    <td className="px-4 py-3 font-black text-green-950">
                      <Link className="hover:underline" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link>
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-black text-pitch">
                      {entry.best_squad_rating > 0 ? entry.best_squad_rating.toFixed(1) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-900/80">{entry.total_km.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-700">{entry.games_won > 0 ? entry.games_won : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">{entry.goal_bonus !== 0 ? (entry.goal_bonus > 0 ? `+${entry.goal_bonus}` : entry.goal_bonus) : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-sky-700">{entry.assist_bonus !== 0 ? (entry.assist_bonus > 0 ? `+${entry.assist_bonus}` : entry.assist_bonus) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {matchdays.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-black text-green-950">Matchday Head-to-Head</h2>
          <p className="mt-1 text-sm font-semibold text-green-900/60">Who won each matchday — pack credits earned from wins, plus rating boosts from goals and assists.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matchdays.map((day) => (
              <div key={day.date} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-green-900/10 pb-2">
                  <p className="text-sm font-black text-green-950">{day.date}</p>
                  {day.entries[0] ? (
                    <p className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">👑 {day.entries[0].username}</p>
                  ) : null}
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
