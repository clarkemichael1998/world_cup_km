"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { formatDate } from "@/lib/formatDate";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import type { Player } from "@/lib/types";

type Profile = {
  username: string;
  joinedAt: string;
  totalKm: number;
  gamesWon: number;
  winCredits: number;
  streak: number;
  ownedPlayerIds: number[];
  duplicateCounts: Record<number, number>;
  completedNations: string[];
  boosts: Array<{ playerId: number; matchId: string; type: "goal" | "assist"; amount: number; createdAt: string }>;
  lockedHistory: Array<{ lockDate: string; players: Array<{ slot: string; playerId: number }> }>;
};

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username ?? "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [playerPool, setPlayerPool] = useState<Player[]>(basePlayerPool);

  useEffect(() => {
    loadPlayerPool().then(setPlayerPool);
    fetch(`/api/profile/${encodeURIComponent(username)}`, { credentials: "include" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Could not load profile.");
        setProfile(payload.profile);
      })
      .catch((err: Error) => setError(err.message));
  }, [username]);

  const playerById = useMemo(() => new Map(playerPool.map((player) => [player.id, player])), [playerPool]);
  const ownedIds = useMemo(() => new Set(profile?.ownedPlayerIds ?? []), [profile]);

  const nationProgress = useMemo(() => {
    if (!profile) return [];
    const byNation = new Map<string, { total: number; owned: number }>();
    for (const player of playerPool) {
      const entry = byNation.get(player.nation) ?? { total: 0, owned: 0 };
      entry.total++;
      if (ownedIds.has(player.id)) entry.owned++;
      byNation.set(player.nation, entry);
    }
    return Array.from(byNation.entries())
      .map(([nation, counts]) => ({ nation, ...counts, percent: counts.total ? Math.round((counts.owned / counts.total) * 100) : 0 }))
      .filter((item) => item.owned > 0)
      .sort((a, b) => b.percent - a.percent || a.nation.localeCompare(b.nation));
  }, [profile, playerPool, ownedIds]);

  const bestXi = useMemo(() => {
    if (!profile) return [];
    const owned = profile.ownedPlayerIds.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
    const used = new Set<number>();
    const picked: Player[] = [];
    for (const pos of ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"]) {
      const best = owned.filter((player) => player.pos === pos && !used.has(player.id)).sort((a, b) => b.rating - a.rating)[0];
      if (best) {
        used.add(best.id);
        picked.push(best);
      }
    }
    return picked;
  }, [profile, playerById]);

  const bestAvg = bestXi.length > 0 ? Math.round((bestXi.reduce((sum, player) => sum + player.rating, 0) / bestXi.length) * 10) / 10 : 0;
  const albumPercent = playerPool.length > 0 && profile ? Math.round((profile.ownedPlayerIds.length / playerPool.length) * 100) : 0;
  const boostTotal = profile?.boosts.reduce((sum, boost) => sum + boost.amount, 0) ?? 0;

  if (error) {
    return (
      <div>
        <PageTitle title="Profile" subtitle={error} />
        <Link className="inline-flex rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800" href="/leaderboard">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <PageTitle title={username || "Profile"} subtitle="Loading profile..." />
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="mt-2 h-7 w-1/2" />
            </div>
          ))}
        </section>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} lines={5} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title={profile.username} subtitle={`Playing since ${formatDate(profile.joinedAt)} · Album ${albumPercent}% complete`} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <ProfileStat label="Best XI Avg" value={bestAvg > 0 ? bestAvg.toFixed(1) : "—"} />
        <ProfileStat label="Stickers" value={`${profile.ownedPlayerIds.length}/${playerPool.length}`} />
        <ProfileStat label="Activity Credits" value={profile.totalKm.toFixed(1)} />
        <ProfileStat label="Games Won" value={profile.gamesWon > 0 ? String(profile.gamesWon) : "—"} />
        <ProfileStat label="Streak" value={profile.streak > 0 ? `🔥 ${profile.streak}d` : "—"} />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Best XI</p>
          <div className="mt-3 space-y-1.5">
            {bestXi.length > 0 ? (
              bestXi.map((player) => (
                <div key={player.id} className="flex items-center justify-between gap-3 rounded-md bg-green-950/5 px-3 py-1.5 text-sm">
                  <span className="w-8 shrink-0 text-xs font-black text-green-900/50">{player.pos}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-green-950">{player.name}</span>
                  <span className="truncate text-xs font-semibold text-green-900/55">{player.nation}</span>
                  <span className="rounded bg-gold px-1.5 py-0.5 text-xs font-black text-green-950">{player.rating}</span>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-green-900/60">No stickers collected yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">
            Boosts Won {boostTotal !== 0 ? <span className={boostTotal > 0 ? "text-green-700" : "text-red-600"}>({boostTotal > 0 ? `+${boostTotal}` : boostTotal} total)</span> : null}
          </p>
          <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {profile.boosts.length > 0 ? (
              profile.boosts.map((boost, index) => {
                const player = playerById.get(boost.playerId);
                return (
                  <div key={index} className="flex items-center justify-between gap-3 rounded-md bg-green-950/5 px-3 py-1.5 text-sm">
                    <span className="shrink-0">{boost.type === "goal" ? "⚽" : "🅰️"}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-green-950">{player?.name ?? `Player ${boost.playerId}`}</span>
                    <span className="text-xs font-semibold text-green-900/50">{formatDate(boost.createdAt)}</span>
                    <span className={`w-10 text-right font-black ${boost.amount > 0 ? "text-green-700" : "text-red-600"}`}>
                      {boost.amount > 0 ? `+${boost.amount}` : boost.amount}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm font-semibold text-green-900/60">No goal or assist boosts yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Album Progress</p>
          {profile.completedNations.length > 0 ? (
            <p className="mt-1 text-xs font-bold text-amber-700">📖 Completed pages: {profile.completedNations.join(", ")}</p>
          ) : null}
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {nationProgress.map((item) => (
              <div key={item.nation} className="rounded-md bg-green-950/5 px-3 py-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-green-950">
                  <span className="truncate">{item.nation}</span>
                  <span className="shrink-0 text-green-900/55">{item.owned}/{item.total}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-green-950/10">
                  <div className={`h-full rounded-full ${item.percent === 100 ? "bg-amber-500" : "bg-pitch"}`} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
            {nationProgress.length === 0 ? <p className="text-sm font-semibold text-green-900/60">Album is empty so far.</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Locked XI History</p>
          <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
            {profile.lockedHistory.length > 0 ? (
              profile.lockedHistory.map((lock) => (
                <details key={lock.lockDate} className="rounded-md bg-green-950/5 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-black text-green-950">
                    {lock.lockDate} <span className="font-bold text-green-900/55">· {lock.players.length}/11 locked</span>
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lock.players.map(({ slot, playerId }) => {
                      const player = playerById.get(playerId);
                      return (
                        <span key={slot} className="rounded bg-white px-2 py-1 text-xs font-bold text-green-950 shadow-sm">
                          {player?.name ?? `Player ${playerId}`}
                        </span>
                      );
                    })}
                    {lock.players.length === 0 ? <span className="text-xs font-semibold text-green-900/55">Empty lock.</span> : null}
                  </div>
                </details>
              ))
            ) : (
              <p className="text-sm font-semibold text-green-900/60">No locked squads yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-green-800/70">{label}</p>
      <p className="mt-1 text-2xl font-black text-green-950">{value}</p>
    </div>
  );
}
