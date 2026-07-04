"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { formatDate } from "@/lib/formatDate";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { getCupThemeById } from "@/lib/cupLegends";
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
  collectionBoosts: Record<number, number>;
  boosts: Array<{ playerId: number; matchId: string; type: "goal" | "assist"; amount: number; createdAt: string }>;
  lockedHistory: Array<{ lockDate: string; players: Array<{ slot: string; playerId: number }> }>;
};

type PlayerBoost = { total: number; goal: number; assist: number };
type XiPlayer = { slot: string; player: Player; boost: PlayerBoost; collectionBoost: number; effectiveRating: number };

const formationSlots = ["GK", "DF1", "DF2", "DF3", "DF4", "MF1", "MF2", "MF3", "FW1", "FW2", "FW3"];
const formationRows = [["FW1", "FW2", "FW3"], ["MF1", "MF2", "MF3"], ["DF1", "DF2", "DF3", "DF4"], ["GK"]];
const rarityClasses: Record<Player["rarity"], string> = {
  clowns: "border-red-300 bg-red-50 text-red-950",
  common: "border-slate-200 bg-white text-slate-950",
  rare: "border-sky-300 bg-sky-50 text-sky-950",
  epic: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950",
  legend: "border-amber-300 bg-amber-50 text-amber-950",
  icon: "border-amber-300 bg-zinc-950 text-amber-50"
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
  const boostsByPlayer = useMemo(() => {
    const result = new Map<number, PlayerBoost>();
    for (const award of profile?.boosts ?? []) {
      const current = result.get(award.playerId) ?? { total: 0, goal: 0, assist: 0 };
      current.total += award.amount;
      current[award.type] += award.amount;
      result.set(award.playerId, current);
    }
    return result;
  }, [profile]);

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
      .map(([nation, counts]) => ({ nation, ...counts, percent: Math.round((counts.owned / counts.total) * 100) }))
      .filter((item) => item.owned > 0)
      .sort((a, b) => b.percent - a.percent || a.nation.localeCompare(b.nation));
  }, [profile, playerPool, ownedIds]);

  const bestXi = useMemo(() => {
    if (!profile) return [];
    const owned = profile.ownedPlayerIds.map((id) => playerById.get(id)).filter((player): player is Player => Boolean(player));
    const used = new Set<number>();
    const picked: XiPlayer[] = [];
    for (const slot of formationSlots) {
      const pos = slot.slice(0, 2);
      const best = owned
        .filter((player) => player.pos === pos && !used.has(player.id))
        .sort((a, b) => effectiveRating(b, boostsByPlayer, profile.collectionBoosts) - effectiveRating(a, boostsByPlayer, profile.collectionBoosts) || a.name.localeCompare(b.name))[0];
      if (!best) continue;
      used.add(best.id);
      const boost = boostsByPlayer.get(best.id) ?? emptyBoost();
      const collectionBoost = profile.collectionBoosts[best.id] ?? 0;
      picked.push({ slot, player: best, boost, collectionBoost, effectiveRating: best.rating + boost.total + collectionBoost });
    }
    return picked;
  }, [profile, playerById, boostsByPlayer]);

  const bestAvg = bestXi.length ? bestXi.reduce((sum, item) => sum + item.effectiveRating, 0) / bestXi.length : 0;
  const albumPercent = playerPool.length > 0 && profile ? Math.round((profile.ownedPlayerIds.length / playerPool.length) * 100) : 0;
  const boostTotal = profile?.boosts.reduce((sum, boost) => sum + boost.amount, 0) ?? 0;

  if (error) return <div><PageTitle title="Profile" subtitle={error} /><Link className="inline-flex rounded-md bg-pitch px-5 py-3 font-black text-white" href="/leaderboard">Back to Leaderboard</Link></div>;
  if (!profile) return <LoadingProfile username={username} />;

  return (
    <div>
      <PageTitle title={profile.username} subtitle={`Playing since ${formatDate(profile.joinedAt)} · Album ${albumPercent}% complete`} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        <ProfileStat label="Best XI Avg" value={bestAvg > 0 ? bestAvg.toFixed(1) : "--"} />
        <ProfileStat label="Stickers" value={`${profile.ownedPlayerIds.length}/${playerPool.length}`} />
        <ProfileStat label="Activity Credits" value={profile.totalKm.toFixed(1)} />
        <ProfileStat label="Games Won" value={profile.gamesWon > 0 ? String(profile.gamesWon) : "--"} />
        <ProfileStat label="Streak" value={profile.streak > 0 ? `${profile.streak} days` : "--"} />
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-green-900/10 bg-white shadow-sm">
        <div className="flex items-end justify-between gap-4 border-b border-green-900/10 px-5 py-4">
          <div><p className="text-sm font-black uppercase tracking-wide text-green-900/60">Best XI</p><p className="mt-1 text-sm font-semibold text-green-900/55">Strongest owned formation, including permanent upgrades.</p></div>
          <SquadAverage value={bestAvg} />
        </div>
        <XiFormation players={bestXi} empty="No stickers collected yet." />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Boosts Won {boostTotal !== 0 ? <span className={boostTotal > 0 ? "text-green-700" : "text-red-600"}>({signed(boostTotal)} total)</span> : null}</p>
          <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {profile.boosts.length ? profile.boosts.map((boost, index) => (
              <div key={`${boost.matchId}-${boost.playerId}-${index}`} className="flex items-center gap-3 rounded-lg bg-green-950/5 px-3 py-2 text-sm">
                <AwardBadge type={boost.type} amount={boost.amount} />
                <span className="min-w-0 flex-1 truncate font-bold text-green-950">{playerById.get(boost.playerId)?.name ?? `Player ${boost.playerId}`}</span>
                <span className="text-xs font-semibold text-green-900/50">{formatDate(boost.createdAt)}</span>
              </div>
            )) : <p className="text-sm font-semibold text-green-900/60">No goal or assist boosts yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Album Progress</p>
          {profile.completedNations.length ? <p className="mt-1 text-xs font-bold text-amber-700">Completed pages: {profile.completedNations.join(", ")}</p> : null}
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {nationProgress.map((item) => <NationProgress key={item.nation} {...item} />)}
            {!nationProgress.length ? <p className="text-sm font-semibold text-green-900/60">Album is empty so far.</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-green-900/10 bg-white p-5 shadow-sm lg:col-span-2">
          <p className="text-sm font-bold uppercase tracking-wide text-green-900/60">Locked XI History</p>
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {profile.lockedHistory.length ? profile.lockedHistory.map((lock, index) => {
              const players = lock.players.map(({ slot, playerId }) => toXiPlayer(slot, playerById.get(playerId), boostsByPlayer, profile.collectionBoosts)).filter((item): item is XiPlayer => Boolean(item));
              const average = players.length ? players.reduce((sum, item) => sum + item.effectiveRating, 0) / players.length : 0;
              return (
                <details key={lock.lockDate} open={index === 0} className="overflow-hidden rounded-lg border border-green-900/10 bg-green-950/5">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-black text-green-950">
                    <span>{lock.lockDate} <span className="font-bold text-green-900/55">· {lock.players.length}/11 locked</span></span>
                    <span className="rounded bg-white px-2 py-1 text-xs text-pitch shadow-sm">{average ? average.toFixed(1) : "--"}</span>
                  </summary>
                  <XiFormation players={players} empty="Empty lock." compact />
                </details>
              );
            }) : <p className="text-sm font-semibold text-green-900/60">No locked squads yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function XiFormation({ players, empty, compact = false }: { players: XiPlayer[]; empty: string; compact?: boolean }) {
  if (!players.length) return <p className="p-5 text-sm font-semibold text-green-900/60">{empty}</p>;
  return (
    <div className={`relative overflow-hidden bg-green-800 ${compact ? "p-3" : "p-4 sm:p-6"}`}>
      <div className="pointer-events-none absolute inset-3 rounded-[45%] border border-white/15" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-full border-l border-white/15" />
      <div className="relative space-y-3 sm:space-y-4">
        {formationRows.map((row) => <div key={row.join("-")} className="flex items-stretch justify-center gap-1.5 sm:gap-3">{row.map((slot) => <XiCard key={slot} slot={slot} item={players.find((candidate) => candidate.slot === slot)} compact={compact} />)}</div>)}
      </div>
    </div>
  );
}

function XiCard({ slot, item, compact }: { slot: string; item?: XiPlayer; compact: boolean }) {
  if (!item) return <div className={`${compact ? "h-14 w-16" : "h-24 w-20 sm:w-32"} rounded-lg border border-dashed border-white/25 bg-white/5`} />;
  const cupTheme = getCupThemeById(item.player.cupId);
  return (
    <div className={`${cupTheme ? "profile-cup-legend-xi text-slate-950" : rarityClasses[item.player.rarity]} ${compact ? "w-16 p-1.5" : "w-20 p-2 sm:w-32 sm:p-2.5"} relative overflow-hidden rounded-lg border-2 shadow-md`}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[8px] font-black uppercase opacity-70">{slot}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-black ${cupTheme ? "bg-white/90 text-slate-950 shadow-sm" : "bg-green-950 text-white"}`}>{item.effectiveRating}</span>
      </div>
      <p className={`${compact ? "text-[9px]" : "text-[10px] sm:text-xs"} mt-1 line-clamp-2 font-black leading-tight`}>{item.player.name}</p>
      {!compact ? <p className="mt-0.5 hidden truncate text-[9px] font-bold opacity-75 sm:block">{cupTheme ? `${cupTheme.cupName} Legend` : item.player.nation}</p> : null}
      {item.boost.total !== 0 || item.collectionBoost !== 0 ? <div className="mt-1 flex flex-wrap gap-1">{item.boost.goal !== 0 ? <AwardBadge type="goal" amount={item.boost.goal} compact /> : null}{item.boost.assist !== 0 ? <AwardBadge type="assist" amount={item.boost.assist} compact /> : null}{item.collectionBoost !== 0 ? <AwardBadge type="collection" amount={item.collectionBoost} compact /> : null}</div> : null}
    </div>
  );
}

function AwardBadge({ type, amount, compact = false }: { type: "goal" | "assist" | "collection"; amount: number; compact?: boolean }) {
  const positive = amount > 0;
  const label = type === "assist" ? "Assist" : type === "goal" ? "Goal" : "Collection";
  const mark = type === "assist" ? "A" : type === "goal" ? "G" : "C";
  return <span title={`${label} boost ${signed(amount)}`} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-black ring-1 ${compact ? "text-[8px]" : "text-[10px]"} ${positive ? "bg-emerald-100 text-emerald-800 ring-emerald-600/20" : "bg-red-100 text-red-700 ring-red-500/20"}`}><span className={`inline-flex h-3 w-3 items-center justify-center rounded-full text-[7px] text-white ${positive ? "bg-emerald-700" : "bg-red-600"}`}>{mark}</span>{signed(amount)}</span>;
}

function NationProgress({ nation, owned, total, percent }: { nation: string; owned: number; total: number; percent: number }) {
  return <div className="rounded-md bg-green-950/5 px-3 py-1.5"><div className="flex items-center justify-between text-xs font-bold text-green-950"><span className="truncate">{nation}</span><span className="shrink-0 text-green-900/55">{owned}/{total}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-green-950/10"><div className={`h-full rounded-full ${percent === 100 ? "bg-amber-500" : "bg-pitch"}`} style={{ width: `${percent}%` }} /></div></div>;
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-green-800/70">{label}</p><p className="mt-1 text-2xl font-black text-green-950">{value}</p></div>;
}

function SquadAverage({ value }: { value: number }) {
  return <div className="rounded-lg bg-green-950 px-3 py-2 text-right text-white shadow-sm"><p className="text-[9px] font-black uppercase tracking-widest text-white/60">Squad avg</p><p className="text-2xl font-black leading-none">{value > 0 ? value.toFixed(1) : "--"}</p></div>;
}

function LoadingProfile({ username }: { username: string }) {
  return <div><PageTitle title={username || "Profile"} subtitle="Loading profile..." /><section className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm"><Skeleton className="h-3 w-3/4" /><Skeleton className="mt-2 h-7 w-1/2" /></div>)}</section><div className="mt-5 grid gap-5 lg:grid-cols-2"><SkeletonCard lines={8} /><SkeletonCard lines={5} /></div></div>;
}

function emptyBoost(): PlayerBoost { return { total: 0, goal: 0, assist: 0 }; }
function effectiveRating(player: Player, boosts: Map<number, PlayerBoost>, collectionBoosts: Record<number, number>) { return player.rating + (boosts.get(player.id)?.total ?? 0) + (collectionBoosts[player.id] ?? 0); }
function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function toXiPlayer(slot: string, player: Player | undefined, boosts: Map<number, PlayerBoost>, collectionBoosts: Record<number, number>): XiPlayer | null {
  if (!player) return null;
  const boost = boosts.get(player.id) ?? emptyBoost();
  const collectionBoost = collectionBoosts[player.id] ?? 0;
  return { slot, player, boost, collectionBoost, effectiveRating: player.rating + boost.total + collectionBoost };
}
