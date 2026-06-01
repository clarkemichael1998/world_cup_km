"use client";

import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";

type Entry = { username: string; total_km: number; entry_count: number };

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
      <PageTitle title="Leaderboard" subtitle="Total kilometres logged by all players." />

      <section className="mt-2 rounded-lg border border-green-900/10 bg-white shadow-sm overflow-hidden">
        {leaderboard === null ? (
          <p className="p-6 text-sm font-semibold text-green-900/60">Loading...</p>
        ) : leaderboard.length === 0 ? (
          <p className="p-6 text-sm font-semibold text-green-900/60">No entries yet — be the first to log a run!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-green-900/10 bg-green-950/5 text-left text-xs font-black uppercase tracking-wide text-green-900/60">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Total KM</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Entries</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => {
                const isTop = i === 0;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <tr
                    key={entry.username}
                    className={`border-b border-green-900/10 last:border-0 ${isTop ? "bg-amber-50" : ""}`}
                  >
                    <td className="px-4 py-3 text-center font-black text-green-900/40">
                      {medal ?? i + 1}
                    </td>
                    <td className="px-4 py-3 font-black text-green-950">{entry.username}</td>
                    <td className="px-4 py-3 text-right font-black text-pitch">
                      {entry.total_km.toFixed(1)} km
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-900/60 hidden sm:table-cell">
                      {entry.entry_count}
                    </td>
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
