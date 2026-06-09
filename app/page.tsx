"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle } from "@/components/PageTitle";
import { formatDate } from "@/lib/formatDate";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { activityDefinitions } from "@/lib/rewardEngine";
import { calculateSquadRating, getPlayer, squadSlots } from "@/lib/squadUtils";
import { loadUserStateAsync } from "@/lib/storage";
import type { ActivityType, Player, UserState } from "@/lib/types";

const WC_FINAL = new Date("2026-07-19T18:00:00Z");

function useCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = WC_FINAL.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs };
}

type FeedEntry = {
  username: string;
  distance_km: number;
  activity_type?: ActivityType;
  activity_amount?: number | null;
  activity_unit?: string | null;
  comment?: string | null;
  cards_earned: number;
  created_at: string;
};

type LockStatus = {
  lockDate: string;
  lockAt: string;
  isLocked: boolean;
  upcomingFixtures: Array<{ matchId: string; homeTeam: string; awayTeam: string; kickoffAt: string; status: string; winner: string | null }>;
};

export default function Home() {
  const [state, setState] = useState<UserState | null>(null);
  const [communityKm, setCommunityKm] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [rewardCredits, setRewardCredits] = useState<number | null>(null);
  const [matchday, setMatchday] = useState<LockStatus | null>(null);
  const [redeemAmount, setRedeemAmount] = useState(1);
  const [redeeming, setRedeeming] = useState(false);
  const [playerPool, setPlayerPool] = useState<Player[]>(basePlayerPool);
  const router = useRouter();
  const countdown = useCountdown();

  useEffect(() => {
    loadUserStateAsync().then(setState);
    loadPlayerPool().then(setPlayerPool);
    fetch("/api/community")
      .then((r) => r.json())
      .then((p) => setCommunityKm(p.community.totalKm))
      .catch(() => {});
    fetch("/api/credits", { credentials: "include" })
      .then((r) => r.json())
      .then((p) => setRewardCredits(p.credits ?? 0))
      .catch(() => {});
    fetch("/api/km-log")
      .then((r) => r.json())
      .then((p) => setFeed(p.feed ?? []))
      .catch(() => {});
    fetch("/api/squad/lock", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setMatchday(p))
      .catch(() => {});
  }, []);

  const squadRating = state ? calculateSquadRating(state, playerPool) : 0;
  const nextRewardProgress = state ? Math.min(100, Math.round(state.kmBalance * 100)) : 0;
  const matchdayNations = new Set(matchday?.upcomingFixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]) ?? []);
  const selectedPlayers = state ? squadSlots.map((slot) => getPlayer(state.squad[slot], playerPool)).filter(Boolean) : [];
  const selectedPlayingToday = selectedPlayers.filter((player) => player && matchdayNations.has(player.nation)).length;

  async function openPack() {
    if (redeeming || !rewardCredits || rewardCredits < redeemAmount) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: redeemAmount }),
      });
      if (res.ok) {
        setRewardCredits((c) => (c ?? 0) - redeemAmount);
        router.push("/reveal");
      }
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div>
      <PageTitle title="KMXI" subtitle="Your World Cup 2026 sticker chase. Log activity, open packs, and keep your XI sharp." />

      {countdown ? (
        <section className="mb-4 rounded-lg border border-green-900/20 bg-pitch p-4 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-green-200/80">World Cup Final Countdown</p>
          <div className="mt-2 flex items-end gap-4">
            <CountUnit value={countdown.days} label="days" />
            <CountUnit value={countdown.hours} label="hrs" />
            <CountUnit value={countdown.mins} label="min" />
            <CountUnit value={countdown.secs} label="sec" />
          </div>
          <p className="mt-2 text-xs font-semibold text-green-200/70">Activity logging locks at kick-off · July 19, 2026</p>
        </section>
      ) : (
        <section className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-black text-amber-900">The World Cup Final has kicked off — activity logging is now locked. Thanks for playing!</p>
        </section>
      )}

      <section className="mb-4 rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-green-900/50">Next best move</p>
            <h2 className="mt-1 text-2xl font-black text-green-950">{rewardCredits && rewardCredits > 0 ? "Open your available packs" : "Log activity to earn your next sticker"}</h2>
            <p className="mt-1 text-sm font-semibold text-green-900/65">
              {state ? `${state.kmBalance.toFixed(2)} activity credits banked. ${(1 - state.kmBalance).toFixed(2)} to the next pull.` : "Loading your progress..."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/add-km" className="rounded-md bg-boot px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-red-700">
              Log Activity
            </Link>
            {rewardCredits && rewardCredits > 0 ? (
              <button onClick={openPack} disabled={redeeming} className="rounded-md bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-amber-700 disabled:opacity-40">
                {redeeming ? "Opening..." : "Open Pack"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="Activity Credits" value={state ? state.totalKm.toFixed(1) : "..."} />
        <Stat label="Group Credits" value={communityKm === null ? "..." : communityKm.toFixed(1)} />
        <Stat label="Stickers" value={state ? String(state.ownedPlayerIds.length) : "..."} />
        <Stat label="Squad Avg" value={state ? String(squadRating) : "..."} />
      </section>

      {matchday ? (
        <section className="mt-4 rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Daily Matchday</p>
              <h2 className="mt-1 text-2xl font-black text-green-950">{matchday.lockDate}</h2>
              <p className="mt-1 text-sm font-semibold text-green-900/60">
                {matchday.isLocked ? "Squad locked" : "Squad not locked"} · Locks {new Date(matchday.lockAt).toLocaleString("en-GB", { timeStyle: "short", timeZone: "Europe/London" })} UK
              </p>
              <LockCountdown lockAt={matchday.lockAt} isLocked={matchday.isLocked} />
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:w-[420px]">
              <MatchdayStat label="Locked Players Involved" value={`${selectedPlayingToday}/${selectedPlayers.length || 11}`} />
              <MatchdayStat label="Fixtures" value={String(matchday.upcomingFixtures.length)} />
              <MatchdayStat label="Possible Coverage" value={`${countCoveredFixtures(matchday, state, playerPool)}/${matchday.upcomingFixtures.length}`} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {matchday.upcomingFixtures.length > 0 ? (
              matchday.upcomingFixtures.map((fixture) => (
                <span key={fixture.matchId} className="rounded-md bg-green-950/5 px-3 py-2 text-xs font-black text-green-950">
                  {fixture.homeTeam} vs {fixture.awayTeam}
                </span>
              ))
            ) : (
              <p className="text-sm font-semibold text-green-900/60">No fixtures listed for this lock date yet.</p>
            )}
          </div>
        </section>
      ) : null}

      {rewardCredits !== null && rewardCredits > 0 && (
        <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-amber-800">Pack Credits</p>
              <p className="mt-1 text-2xl font-black text-amber-900">{rewardCredits} <span className="text-sm font-semibold text-amber-700">credit{rewardCredits === 1 ? "" : "s"} available</span></p>
              <p className="mt-0.5 text-xs font-semibold text-amber-700">1 pack credit = 1 random player sticker</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setRedeemAmount((a) => Math.max(1, a - 1))} disabled={redeemAmount <= 1}
                  className="rounded-md bg-amber-200 px-2 py-1 text-sm font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40">−</button>
                <span className="w-8 text-center text-lg font-black text-amber-900">{redeemAmount}</span>
                <button onClick={() => setRedeemAmount((a) => Math.min(rewardCredits, 20, a + 1))} disabled={redeemAmount >= Math.min(rewardCredits, 20)}
                  className="rounded-md bg-amber-200 px-2 py-1 text-sm font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40">+</button>
              </div>
              <button onClick={openPack} disabled={redeeming}
                className="rounded-md bg-amber-600 px-5 py-2.5 font-black text-white hover:bg-amber-700 disabled:opacity-40">
                {redeeming ? "Opening…" : `Open ${redeemAmount} Pack${redeemAmount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="mt-4 rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-green-800/70">Next Reward</p>
            <p className="mt-1 text-sm font-semibold text-green-950">
              {state ? `${state.kmBalance.toFixed(2)} credits banked · ${(1 - state.kmBalance).toFixed(2)} credits to go` : "Loading..."}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-black text-pitch">{nextRewardProgress}%</p>
        </div>
        <div
          className="mt-4 h-3 overflow-hidden rounded-full bg-green-100"
          role="progressbar"
          aria-valuenow={nextRewardProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress to next reward"
        >
          <div className="h-full rounded-full bg-boot transition-all" style={{ width: `${nextRewardProgress}%` }} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-2 content-start">
          <HomeLink href="/add-km" title="Log Activity" text="Turn movement and workouts into player stickers." />
          <HomeLink href="/collection" title="Stickers" text="Browse your sticker album by nation." />
          <HomeLink href="/squad" title="Squad" text="Pick your XI and lock it before matchday." />
          <HomeLink href="/chat" title="Chat" text="Talk tactics, pulls, and live scores with the group." />
        </section>

        <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Activity Feed</p>
          <div className="mt-3 space-y-2">
            {feed.length === 0 ? (
              <p className="text-sm font-semibold text-green-900/60">No activity yet — be the first to log a session!</p>
            ) : (
              feed.map((entry, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-md bg-green-950/5 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-black text-green-950">{entry.username}</p>
                      <ActivityBadge type={entry.activity_type} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-green-900/60">{formatActivity(entry)} · {formatDate(entry.created_at)}</p>
                    {entry.comment ? <p className="mt-1 line-clamp-2 text-xs font-semibold text-green-950/75">“{entry.comment}”</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-pitch">+{entry.distance_km.toFixed(1)} credits</p>
                    {entry.cards_earned > 0 && (
                      <p className="text-xs font-bold text-amber-700">+{entry.cards_earned} sticker{entry.cards_earned === 1 ? "" : "s"}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function formatActivity(entry: FeedEntry) {
  const activity = entry.activity_type ? activityDefinitions[entry.activity_type] : undefined;
  const amount = entry.activity_amount ?? entry.distance_km;
  const unit = entry.activity_unit ?? "km";
  return `${activity?.label ?? "Activity"} · ${Number(amount).toFixed(unit === "km" ? 1 : 0)} ${unit}`;
}

const activityBadgeStyles: Record<ActivityType, string> = {
  walk: "bg-sky-100 text-sky-800",
  run: "bg-green-100 text-green-800",
  cycle: "bg-violet-100 text-violet-800",
  strength: "bg-amber-100 text-amber-900",
  sport: "bg-red-100 text-red-800",
  mobility: "bg-teal-100 text-teal-800"
};

function ActivityBadge({ type }: { type?: ActivityType }) {
  const activityType = type ?? "walk";
  const activity = activityDefinitions[activityType];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${activityBadgeStyles[activityType]}`}>
      {activity.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-green-800/70 md:text-sm">{label}</p>
      <p className="mt-2 text-3xl font-black text-green-950 md:text-4xl">{value}</p>
    </div>
  );
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-black leading-none tabular-nums">{String(value).padStart(2, "0")}</p>
      <p className="text-[10px] font-black uppercase tracking-wide text-green-200/70">{label}</p>
    </div>
  );
}

function LockCountdown({ lockAt, isLocked }: { lockAt: string; isLocked: boolean }) {
  const remaining = new Date(lockAt).getTime() - Date.now();
  if (remaining <= 0) {
    return (
      <p className="mt-2 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
        🔒 Window live — squads are locked in for this matchday
      </p>
    );
  }
  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const urgent = remaining < 2 * 3600000;
  return (
    <p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${urgent ? "bg-amber-100 text-amber-900" : "bg-green-950/5 text-green-900/70"}`}>
      {urgent ? "⚠️ " : "⏱️ "}Locks in {hours > 0 ? `${hours}h ` : ""}{mins}m{isLocked ? " — your XI is set" : " — draft auto-locks if you don't"}
    </p>
  );
}

function MatchdayStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-green-950/5 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-green-900/50">{label}</p>
      <p className="mt-0.5 text-lg font-black text-green-950">{value}</p>
    </div>
  );
}

function countCoveredFixtures(matchday: LockStatus, state: UserState | null, playerPool: Player[]) {
  if (!state) return 0;
  const selected = squadSlots.map((slot) => getPlayer(state.squad[slot], playerPool)).filter(Boolean);
  return matchday.upcomingFixtures.filter((fixture) => selected.some((player) => player && (player.nation === fixture.homeTeam || player.nation === fixture.awayTeam))).length;
}

function HomeLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-lg border border-white/10 bg-pitch p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-800 hover:shadow-md md:p-5">
      <h2 className="text-xl font-black md:text-2xl">{title}</h2>
      <p className="mt-2 text-xs font-medium text-green-50/85 md:text-sm">{text}</p>
    </Link>
  );
}
