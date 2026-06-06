"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";

type Entry = { username: string; total_km: number; games_won: number; best_squad_rating: number; goal_bonus: number; assist_bonus: number };

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.leaderboard ?? []))
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
          <p className="p-6 text-sm font-semibold text-green-900/60">Loading...</p>
        ) : leaderboard.length === 0 ? (
          <p className="p-6 text-sm font-semibold text-green-900/60">No entries yet - be the first to log an activity!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-900/10 bg-green-950/5 text-left text-xs font-black uppercase tracking-wide text-green-900/60">
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
                    <td className="px-4 py-3 font-black text-green-950">{entry.username}</td>
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
    </div>
  );
}
