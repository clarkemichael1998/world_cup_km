"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { ChatFeed } from "@/components/ChatFeed";

const WC_FINAL = new Date("2026-07-19T18:00:00Z");

type CupStatus = {
  cupId: number;
  cupName: string;
  state: "champion" | "through" | "live" | "upcoming" | "eliminated";
  round: string;
  roundDate: string;
  opponent: string | null;
  myScore: number | null;
  opponentScore: number | null;
};

type MatchdayScore = {
  date: string;
  lockAt: string;
  unlockAt: string;
  settled: boolean;
  score: {
    activityRaw: number;
    activityPoints: number;
    winCount: number;
    winPoints: number;
    boostRaw: number;
    footballRaw: number;
    footballPoints: number;
    total: number;
  };
};

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

export default function Home() {
  const [rewardCredits, setRewardCredits] = useState<number | null>(null);
  const [canSetNews, setCanSetNews] = useState(false);
  const [wonMatchday, setWonMatchday] = useState<string | null>(null);
  const [newsMessage, setNewsMessage] = useState("");
  const [newsNotice, setNewsNotice] = useState("");
  const [newsBusy, setNewsBusy] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(1);
  const [redeeming, setRedeeming] = useState(false);
  const [matchdayScore, setMatchdayScore] = useState<MatchdayScore | null>(null);
  const [cupStatuses, setCupStatuses] = useState<CupStatus[] | null>(null);
  const [dangerPending, setDangerPending] = useState(0);
  const [claimingDanger, setClaimingDanger] = useState(false);
  const [bonusPending, setBonusPending] = useState(0);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [locked, setLocked] = useState(false);
  const router = useRouter();
  const countdown = useCountdown();

  useEffect(() => {
    fetch("/api/cups/my-status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setCupStatuses(p?.statuses ?? []))
      .catch(() => {});
    fetch("/api/credits", { credentials: "include" })
      .then((r) => r.json())
      .then((p) => setRewardCredits(p.credits ?? 0))
      .catch(() => {});
    fetch("/api/news", { credentials: "include" })
      .then((r) => r.json())
      .then((p) => {
        setCanSetNews(Boolean(p.canSetNews) && Boolean(p.wonMatchday));
        setWonMatchday(p.wonMatchday ?? null);
        setNewsMessage(p.news?.message ?? "");
      })
      .catch(() => {});
    fetch("/api/matchday/score", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setMatchdayScore(p))
      .catch(() => {});
    fetch("/api/danger-rewards", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setDangerPending(p?.pending ?? 0))
      .catch(() => {});
    fetch("/api/bonus-reveal", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setBonusPending(p?.pending ?? 0))
      .catch(() => {});
    fetch("/api/lockdown", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setLocked(p?.locked ?? false))
      .catch(() => {});
  }, []);

  async function submitNews() {
    if (newsBusy || !newsMessage.trim()) return;
    setNewsBusy(true);
    setNewsNotice("");
    try {
      const response = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: newsMessage })
      });
      const payload = await response.json();
      setNewsNotice(response.ok ? "Headline live — it's on the reel now." : payload.error ?? "Could not set the news.");
    } finally {
      setNewsBusy(false);
    }
  }

  async function claimDangerReward() {
    if (claimingDanger) return;
    setClaimingDanger(true);
    try {
      const res = await fetch("/api/danger-rewards", { method: "POST", credentials: "include" });
      if (res.ok) router.push("/reveal");
    } finally {
      setClaimingDanger(false);
    }
  }

  async function claimBonusReward() {
    if (claimingBonus) return;
    setClaimingBonus(true);
    try {
      const res = await fetch("/api/bonus-reveal", { method: "POST", credentials: "include" });
      if (res.ok) router.push("/reveal");
    } finally {
      setClaimingBonus(false);
    }
  }

  async function openPack() {
    if (redeeming || !rewardCredits || rewardCredits < redeemAmount) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: redeemAmount })
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <BrandLogo />
        {countdown ? (
          <div className="flex items-end justify-between gap-2 rounded-lg border border-green-900/20 bg-pitch px-3 py-2 text-white shadow-sm sm:justify-start sm:gap-3 sm:px-4 sm:py-2.5">
            <CountUnit value={countdown.days} label="days" />
            <CountUnit value={countdown.hours} label="hrs" />
            <CountUnit value={countdown.mins} label="min" />
            <CountUnit value={countdown.secs} label="sec" />
          </div>
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-black text-amber-900">Final kicked off — logging locked.</p>
        )}
      </div>

      <LastMileHero cupStatuses={cupStatuses ?? []} locked={locked} />

      {matchdayScore ? <MatchdayScoreCard data={matchdayScore} /> : null}

      {canSetNews ? (
        <section className="rounded-lg border border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-amber-800">👑 Matchday Champion{wonMatchday ? ` — ${wonMatchday}` : ""}</p>
          <p className="mt-1 text-sm font-bold text-amber-900">You won yesterday&apos;s head-to-head. Your prize: set today&apos;s news reel.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950"
              maxLength={180}
              placeholder="Write today's headline..."
              value={newsMessage}
              onChange={(event) => setNewsMessage(event.target.value)}
            />
            <Button variant="accent" onClick={submitNews} disabled={newsBusy || !newsMessage.trim()}>
              {newsBusy ? "Publishing..." : "Publish"}
            </Button>
          </div>
          {newsNotice ? <p className="mt-2 text-xs font-black text-amber-800">{newsNotice}</p> : null}
        </section>
      ) : null}

      {rewardCredits !== null && rewardCredits > 0 ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-amber-800">Pack Credits</p>
            <p className="mt-0.5 text-xl font-black text-amber-900">{rewardCredits} <span className="text-sm font-semibold text-amber-700">to open</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setRedeemAmount((a) => Math.max(1, a - 1))} disabled={redeemAmount <= 1}
                className="rounded-md bg-amber-200 px-2 py-1 text-sm font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40">−</button>
              <span className="w-8 text-center text-lg font-black text-amber-900">{redeemAmount}</span>
              <button onClick={() => setRedeemAmount((a) => Math.min(rewardCredits, 20, a + 1))} disabled={redeemAmount >= Math.min(rewardCredits, 20)}
                className="rounded-md bg-amber-200 px-2 py-1 text-sm font-black text-amber-900 hover:bg-amber-300 disabled:opacity-40">+</button>
            </div>
            <Button variant="accent" onClick={openPack} disabled={redeeming}>
              {redeeming ? "Opening…" : `Open ${redeemAmount}`}
            </Button>
          </div>
        </section>
      ) : null}

      {bonusPending > 0 ? (
        <section className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-950/60 via-black/60 to-emerald-950/40 p-5 shadow-lg">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-green-400/70">Bonus Stickers</p>
              <p className="mt-1 text-lg font-black text-white">You have {bonusPending} bonus sticker{bonusPending !== 1 ? "s" : ""} waiting.</p>
              <p className="mt-0.5 text-xs font-semibold text-green-200/50">A small thank-you from us — tap to reveal.</p>
            </div>
            <button
              onClick={claimBonusReward}
              disabled={claimingBonus}
              className="shrink-0 rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-green-500 disabled:opacity-50"
            >
              {claimingBonus ? "Loading…" : "Reveal"}
            </button>
          </div>
        </section>
      ) : null}

      {dangerPending > 0 ? (
        <section className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-950/80 via-black/60 to-red-950/40 p-5 shadow-lg shadow-red-950/30">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.10),transparent_70%)]" />
          <div className="relative flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-400/70">Dangerous</p>
              <p className="mt-1 text-lg font-black text-white">Something&apos;s waiting for you.</p>
            </div>
            <button
              onClick={claimDangerReward}
              disabled={claimingDanger}
              className="shrink-0 rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-red-400 disabled:opacity-50"
            >
              {claimingDanger ? "Loading…" : "Reveal"}
            </button>
          </div>
        </section>
      ) : null}

      {!locked && <SprintSection />}

      <ChatFeed />
    </div>
  );
}

function LastMileHero({ cupStatuses, locked }: { cupStatuses: CupStatus[]; locked: boolean }) {
  const fixtureCup = cupStatuses.find((status) => status.state === "live" && status.opponent)
    ?? cupStatuses.find((status) => status.state === "upcoming" && status.opponent)
    ?? cupStatuses.find((status) => status.state === "live")
    ?? cupStatuses.find((status) => status.state === "upcoming")
    ?? cupStatuses.find((status) => status.state === "through")
    ?? cupStatuses[0];
  const hasScore = fixtureCup?.myScore !== null && fixtureCup?.opponentScore !== null;
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-900 p-5 text-white shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400/60">KMXI · Final Week</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            THE LAST MILE
          </h1>
          {locked ? (
            <p className="mt-3 max-w-2xl text-sm font-semibold text-white/60">The app has locked down. Leaderboard frozen. No further actions.</p>
          ) : (
            <p className="mt-3 max-w-2xl text-sm font-semibold text-white/75">
              The final week of KMXI is here. Log 5km a day, pick mystery cards, double your points from the semis onwards. Everything ends 11pm on 19 July.
            </p>
          )}
          {!locked && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/last-mile" className="flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-emerald-950 shadow-sm transition hover:bg-emerald-300">
                Click here for your guide to the final week of KMXI
              </Link>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Cup pulse</p>
          <p className="mt-1 text-sm font-black">{fixtureCup ? fixtureCup.cupName : "Cup brackets are live"}</p>
          {fixtureCup ? (
            <div className="mt-3 rounded-lg bg-white/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wide text-white/55">{CUP_STATE_LABEL[fixtureCup.state]}</span>
                <span className="text-[10px] font-bold text-white/55">{formatCupDate(fixtureCup.roundDate)}</span>
              </div>
              <p className="mt-1 text-sm font-black">
                {fixtureCup.opponent ? `${fixtureCup.round} vs ${fixtureCup.opponent}` : `${fixtureCup.round} awaits`}
              </p>
              <p className="mt-1 text-xs font-semibold text-white/65">
                {hasScore ? `Current score: ${fixtureCup.myScore?.toFixed(1)} - ${fixtureCup.opponentScore?.toFixed(1)}` : "Scores use the same 3pm UK matchday window."}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs font-semibold text-white/65">Check brackets, fixtures, and rewards.</p>
          )}
          <Link href="/cups" className="mt-3 block text-xs font-black uppercase tracking-wide text-emerald-300 underline">
            View cups
          </Link>
        </div>
      </div>
    </section>
  );
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black leading-none tabular-nums">{String(value).padStart(2, "0")}</p>
      <p className="text-[9px] font-black uppercase tracking-wide text-green-200/70">{label}</p>
    </div>
  );
}

// Same activity/football/total formula the leaderboard and cup matches use,
// updating live as the player logs activity — visible before the matchday
// window even closes, not just after.
function MatchdayScoreCard({ data }: { data: MatchdayScore }) {
  const { score } = data;
  const activityCapped = score.activityRaw > score.activityPoints;
  const footballCapped = score.footballRaw > score.footballPoints;

  return (
    <section className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">
            {data.settled ? "Last Matchday" : "Today's Matchday"} · {data.date}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-green-900/55">
            {data.settled ? "Closed — final score for that day." : "Still open — updates live as you log activity and matches play out."}
          </p>
        </div>
        <span className={`text-2xl font-black ${data.settled ? "text-green-950" : "text-pitch"}`}>{score.total.toFixed(1)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-green-950/5 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-green-900/40">Activity</p>
          <p className="mt-0.5 text-lg font-black text-green-950">
            {score.activityPoints.toFixed(1)}
            {activityCapped ? <span className="ml-1 text-xs font-bold text-green-900/40">(capped, {score.activityRaw.toFixed(1)} logged)</span> : null}
          </p>
        </div>
        <div className="rounded-md bg-green-950/5 px-3 py-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-green-900/40">Football</p>
          <p className="mt-0.5 text-lg font-black text-green-950">
            {score.footballPoints.toFixed(0)}
            {footballCapped ? <span className="ml-1 text-xs font-bold text-green-900/40">(capped)</span> : null}
          </p>
          <p className="text-[10px] font-semibold text-green-900/45">{score.winCount} win{score.winCount === 1 ? "" : "s"} · {score.boostRaw >= 0 ? "+" : ""}{score.boostRaw} boosts</p>
        </div>
      </div>
    </section>
  );
}

const CUP_STATE_LABEL: Record<CupStatus["state"], string> = {
  champion: "Champion!",
  through: "Through to next round",
  live: "Live now",
  upcoming: "Upcoming",
  eliminated: "Eliminated"
};

function formatCupDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

type SprintPlayer = { id: number; name: string; pos: string; rating: number | null; nation: string; rarity: string };
type SprintStatus = {
  activeDay: { date: string; dayNumber: number } | null;
  players: SprintPlayer[];
  claimed: Record<string, number>;
  qualifies: boolean;
  lockedDown: boolean;
};

function SprintSection() {
  const [status, setStatus] = useState<SprintStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/last-mile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setStatus(p))
      .catch(() => {});
  }, []);

  if (!status?.activeDay) return null;

  const todayClaimed = status.claimed[status.activeDay.date];

  async function pick(playerId: number) {
    if (claiming || todayClaimed) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/last-mile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playerId })
      });
      if (res.ok) router.push("/reveal");
    } finally {
      setClaiming(false);
    }
  }

  const sectionBorder = status.qualifies && !todayClaimed
    ? "border-emerald-400/50"
    : "border-emerald-500/20";

  return (
    <section className={`rounded-2xl border ${sectionBorder} bg-gradient-to-br from-emerald-950/70 via-teal-950/50 to-slate-900/70 p-5 shadow-lg transition-colors duration-300`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400/60">Daily Sprint · Day {status.activeDay.dayNumber}</p>
          <p className="mt-1 text-base font-black text-white">
            {todayClaimed
              ? "Card claimed — see you tomorrow."
              : status.qualifies
              ? "✓ 5km logged — pick your card for today."
              : "Log 5km (or equivalent) today to unlock your pick."}
          </p>
          {!todayClaimed && !status.qualifies && (
            <p className="mt-0.5 text-xs font-semibold text-white/40">Walk, run, cycle ÷3, strength ÷10, sport ÷10, mobility ÷30 — all count.</p>
          )}
        </div>
        <Link href="/last-mile" className="shrink-0 text-xs font-black text-emerald-400/70 underline">Guide</Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {status.players.map((player) => {
          const isClaimed = todayClaimed === player.id;
          const canPick = status.qualifies && !todayClaimed && !claiming;
          return (
            <button
              key={player.id}
              disabled={!canPick}
              onClick={() => pick(player.id)}
              className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                isClaimed
                  ? "border-emerald-400/70 bg-emerald-800/50 ring-1 ring-emerald-400/30"
                  : canPick
                  ? "border-emerald-400/50 bg-emerald-900/40 hover:border-emerald-300/70 hover:bg-emerald-800/50 cursor-pointer shadow-emerald-900/40 shadow-md"
                  : "border-white/10 bg-white/5 opacity-50 cursor-not-allowed"
              }`}
            >
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${canPick || isClaimed ? "text-emerald-400/70" : "text-white/30"}`}>{player.pos}</p>
              <p className="mt-1 text-sm font-black text-white leading-tight">{player.name}</p>
              <p className={`text-[10px] font-semibold ${canPick || isClaimed ? "text-white/60" : "text-white/30"}`}>{player.nation}</p>
              <p className={`mt-2 text-lg font-black ${canPick || isClaimed ? "text-emerald-300" : "text-white/30"}`}>
                {player.rating !== null ? player.rating : "?"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
