"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { PlayerCard } from "@/components/PlayerCard";
import { CupMotif } from "@/components/CupMotif";
import { LegendPortrait } from "@/components/LegendPortrait";
import { getCupLegendPlayer, getCupThemeById, type CupTheme } from "@/lib/cupLegends";

type CupMatch = {
  id: string;
  round: string;
  day: number;
  date: string;
  label: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
  status: "scheduled" | "live" | "decided" | "bye";
};
type CupDefinition = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  prize: string;
  runnerUpPrize: string;
  legend: string;
  country: string;
  locked: boolean;
  unlocksOn: string | null;
  rounds: Array<{ day: number; date: string; label: string }>;
  matches: CupMatch[];
};
type CupHubData = {
  participants: string[];
  cups: CupDefinition[];
  restDates: string[];
  scoring: Array<{ label: string; value: string }>;
  prizes: Array<{ place: string; reward: string }>;
};

export default function CupsPage() {
  const [data, setData] = useState<CupHubData | null>(null);
  const [selectedCupId, setSelectedCupId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/cups", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch(() => setData({ participants: [], cups: [], restDates: [], scoring: [], prizes: [] }));
  }, []);

  const selectedCup = useMemo(() => data?.cups.find((cup) => cup.id === selectedCupId) ?? null, [data, selectedCupId]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {selectedCup ? (
          <button
            type="button"
            onClick={() => setSelectedCupId(null)}
            className="mb-1 inline-flex items-center gap-1.5 rounded-md bg-green-950/5 px-3 py-2 text-sm font-black text-green-950 hover:bg-green-950/10"
          >
            <BackArrowIcon /> Back to Cups
          </button>
        ) : (
          <PageTitle
            title="KMXI Cups"
            subtitle="Four five-round knockout cups across the remaining World Cup matchdays. Pick a cup to see its draw and prizes."
          />
        )}
        <Link href="/cup-rules" className="rounded-md bg-amber-100 px-4 py-2 text-sm font-black text-amber-900 hover:bg-amber-200">
          Cup Rules
        </Link>
      </div>

      {!data ? (
        <p className="rounded-lg bg-white p-5 text-sm font-bold text-green-900/60 shadow-sm">Loading cup draw...</p>
      ) : selectedCup ? (
        <CupDetail cup={selectedCup} scoring={data.scoring} restDates={data.restDates} prizes={data.prizes} />
      ) : (
        <CupMenu cups={data.cups} onSelect={(id) => setSelectedCupId(id)} />
      )}
    </div>
  );
}

function CupMenu({ cups, onSelect }: { cups: CupDefinition[]; onSelect: (id: number) => void }) {
  const liveCup = cups.find((cup) => !cup.locked && cup.matches.some((match) => match.status === "live"));
  const openCups = cups.filter((cup) => !cup.locked).length;

  return (
    <div className="mt-2 space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-green-950 p-5 text-white shadow-xl sm:p-7">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-300/20 blur-2xl" />
        <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-sky-300/10 blur-2xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-200/80">Cup Season</p>
            <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Four knockout runs. Four legend cards. Every round has a story.</h2>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-white/70">
              Pick a cup to see the draw, live scores, prizes, and the route to the final. Completed rounds settle from the same daily activity and match-event score used on the leaderboard.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <HeroStat label="Unlocked" value={`${openCups}/4`} />
            <HeroStat label="Live Now" value={liveCup ? liveCup.name.replace(" Cup", "") : "--"} />
            <HeroStat label="Final Cup Ends" value="19 Jul" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cups.map((cup) => {
          const theme = getCupThemeById(cup.id);
          if (!theme) return null;
          const progress = getCupProgress(cup);
          const status = getCupStatus(cup);
          return (
            <button
              key={cup.id}
              type="button"
              disabled={cup.locked}
              onClick={() => onSelect(cup.id)}
              title={cup.locked ? `Unlocks ${formatDate(cup.unlocksOn)}` : `Open ${cup.name}`}
              className={`group relative overflow-hidden rounded-3xl border text-left shadow-sm transition ${
                cup.locked ? "cursor-not-allowed border-white/10 opacity-75" : "border-white/50 hover:-translate-y-1 hover:shadow-2xl"
              }`}
            >
              <div className={`relative min-h-64 overflow-hidden bg-gradient-to-br ${theme.colours} p-4 text-white`}>
                <CupMotif cupId={cup.id} className="pointer-events-none absolute inset-0 h-full w-full opacity-90" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
                <div className="pointer-events-none absolute -bottom-4 -right-5 h-40 w-28 opacity-90 transition duration-300 group-hover:scale-105">
                  <LegendPortrait imagePath={theme.imagePath} shirtNumber={theme.shirtNumber} alt={theme.legend} className="h-full w-full" rounded="rounded-2xl" silhouetteOpacity="opacity-100" />
                </div>
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">Cup {cup.id}</p>
                    <p className="mt-2 text-2xl font-black leading-none drop-shadow">{cup.name}</p>
                    <p className="mt-1 text-sm font-bold text-white/80">{cup.country}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase shadow-sm ${cup.locked ? "bg-white/15 text-white" : status.className}`}>
                    {cup.locked ? "Locked" : status.label}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wide text-white/80">
                    <span>{formatDate(cup.startDate)}</span>
                    <span>{formatDate(cup.endDate)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-white shadow-sm transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                {cup.locked ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-950/65 backdrop-blur-[2px]">
                    <LockIcon />
                    <p className="text-xs font-black uppercase tracking-wide text-white/90">Unlocks {formatDate(cup.unlocksOn)}</p>
                  </div>
                ) : null}
              </div>
              <div className="bg-white p-4">
                <p className="text-xs font-bold text-green-900/55">Prize card</p>
                <p className="mt-1 text-lg font-black text-green-950">{cup.locked ? "Mystery Legend" : cup.prize}</p>
                <p className="mt-2 text-xs font-bold text-green-900/60">{cup.locked ? "Draw hidden until unlock." : "Tap for bracket, scores, and awards."}</p>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}

function getCupProgress(cup: CupDefinition) {
  if (cup.locked) return 0;
  const finishedRounds = cup.rounds.filter((round) => cup.matches.some((match) => match.day === round.day && (match.status === "decided" || match.status === "bye"))).length;
  return Math.round((finishedRounds / cup.rounds.length) * 100);
}

function getCupStatus(cup: CupDefinition) {
  if (cup.matches.some((match) => match.status === "live")) return { label: "Live", className: "bg-red-50 text-red-600" };
  if (cup.matches.some((match) => match.round === "final" && match.status === "decided")) return { label: "Complete", className: "bg-white text-green-950" };
  if (cup.matches.some((match) => match.status === "decided" || match.status === "bye")) return { label: "In Play", className: "bg-amber-100 text-amber-900" };
  return { label: "Open", className: "bg-white text-green-950" };
}

const PANEL_LABELS = ["Bracket", "Rules", "Awards"] as const;

function CupDetail({
  cup,
  scoring,
  restDates,
  prizes
}: {
  cup: CupDefinition;
  scoring: Array<{ label: string; value: string }>;
  restDates: string[];
  prizes: Array<{ place: string; reward: string }>;
}) {
  const theme = getCupThemeById(cup.id);
  const legendPlayer = getCupLegendPlayer(cup.id);
  const [panel, setPanel] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (!theme) return null;

  function go(delta: number) {
    setPanel((i) => Math.min(PANEL_LABELS.length - 1, Math.max(0, i + delta)));
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50) go(1);
    else if (delta > 50) go(-1);
    touchStartX.current = null;
  }

  return (
    <div className="space-y-5">
      <HeroCup cup={cup} theme={theme} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {PANEL_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => setPanel(i)}
              className={`rounded-md px-4 py-2 text-sm font-black transition ${panel === i ? `bg-gradient-to-r ${theme.colours} text-white shadow-sm` : "bg-green-950/5 text-green-950 hover:bg-green-950/10"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => go(-1)}
            disabled={panel === 0}
            aria-label="Previous"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-green-950/5 text-green-950 hover:bg-green-950/10 disabled:opacity-30"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            onClick={() => go(1)}
            disabled={panel === PANEL_LABELS.length - 1}
            aria-label="Next"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-green-950/5 text-green-950 hover:bg-green-950/10 disabled:opacity-30"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ width: `${PANEL_LABELS.length * 100}%`, transform: `translateX(-${(100 / PANEL_LABELS.length) * panel}%)` }}
        >
          <PanelSlide width={PANEL_LABELS.length}>
            <BracketPanel cup={cup} theme={theme} />
          </PanelSlide>
          <PanelSlide width={PANEL_LABELS.length}>
            <RulesPanel theme={theme} scoring={scoring} restDates={restDates} />
          </PanelSlide>
          <PanelSlide width={PANEL_LABELS.length}>
            <AwardsPanel theme={theme} legendPlayer={legendPlayer} prizes={prizes} />
          </PanelSlide>
        </div>
      </div>
    </div>
  );
}

function PanelSlide({ width, children }: { width: number; children: React.ReactNode }) {
  return <div className="shrink-0 px-0.5" style={{ width: `${100 / width}%` }}>{children}</div>;
}

function HeroCup({ cup, theme }: { cup: CupDefinition; theme: CupTheme }) {
  const status = getCupStatus(cup);
  const progress = getCupProgress(cup);
  const final = cup.matches.find((match) => match.round === "final");

  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.colours} p-5 text-white shadow-xl sm:p-7`}>
      <CupMotif cupId={cup.id} className="pointer-events-none absolute -right-10 -top-16 h-80 w-80 opacity-90" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/30 to-transparent" />
      <div className="relative grid gap-5 lg:grid-cols-[auto_1fr_auto] lg:items-end">
        <LegendPortrait imagePath={theme.imagePath} shirtNumber={theme.shirtNumber} alt={theme.legend} className="h-28 w-28 shrink-0 sm:h-40 sm:w-40" rounded="rounded-3xl" silhouetteOpacity="opacity-85" />
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-white/75 backdrop-blur">{cup.country} Legend Theme</p>
            <p className={`rounded-full px-3 py-1 text-[10px] font-black uppercase shadow-sm ${status.className}`}>{status.label}</p>
          </div>
          <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{cup.legend}</h2>
          <p className="mt-2 text-sm font-bold text-white/80">{cup.name} · {formatDate(cup.startDate)} to {formatDate(cup.endDate)}</p>
        </div>
        <div className="min-w-48 rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-wide text-white/55">Route progress</p>
          <p className="mt-1 text-3xl font-black">{progress}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-xs font-bold text-white/75">Final: {final ? formatDate(final.date) : formatDate(cup.endDate)}</p>
        </div>
      </div>
    </section>
  );
}

function BracketPanel({ cup, theme }: { cup: CupDefinition; theme: CupTheme }) {
  const featured = getFeaturedMatch(cup);

  return (
    <div className={`rounded-3xl border-2 ${theme.border} ${theme.soft} p-4 shadow-sm sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Cup Route</p>
          <h2 className="text-3xl font-black tracking-tight text-green-950">{cup.name}</h2>
          <p className="mt-1 text-sm font-bold text-green-900/55">Featured tie stays up top. Scroll the route below for the full bracket.</p>
        </div>
        <p className={`rounded-full bg-gradient-to-r ${theme.colours} px-3 py-1 text-xs font-black text-white shadow-sm`}>
          {formatDate(cup.startDate)} - {formatDate(cup.endDate)}
        </p>
      </div>

      {featured ? <FeaturedMatch match={featured} theme={theme} /> : null}

      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/50 bg-white/55 px-3 py-2">
        <p className="text-xs font-black uppercase tracking-wide text-green-900/45">Full bracket route</p>
        <p className="text-xs font-bold text-green-900/55">Scroll up / down</p>
      </div>

      <div className="mt-3 max-h-[72vh] overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cup.rounds.map((round) => {
          const matches = cup.matches.filter((match) => match.day === round.day);
          return (
            <div key={round.day} className="rounded-2xl border border-white/50 bg-white/65 p-3 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Day {round.day}</p>
                  <p className="font-black text-green-950">{round.label}</p>
                  <p className="text-xs font-bold text-green-900/55">{formatDate(round.date)}</p>
                </div>
                <span className="rounded-full bg-green-950/5 px-2 py-1 text-[9px] font-black uppercase text-green-900/50">{matches.length} tie{matches.length === 1 ? "" : "s"}</span>
              </div>
              <div className="space-y-2">
                {matches.map((match) => <MatchCard key={match.id} match={match} theme={theme} />)}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function getFeaturedMatch(cup: CupDefinition) {
  return (
    cup.matches.find((match) => match.status === "live") ??
    cup.matches.find((match) => match.status === "scheduled" && match.home !== "TBD" && match.away !== "TBD") ??
    [...cup.matches].reverse().find((match) => match.status === "decided" || match.status === "bye") ??
    cup.matches[0] ??
    null
  );
}

function FeaturedMatch({ match, theme }: { match: CupMatch; theme: CupTheme }) {
  const status = match.status === "live" ? "Live fixture" : match.status === "scheduled" ? "Next fixture" : "Latest result";
  return (
    <section className={`relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br ${theme.colours} p-4 text-white shadow-lg sm:p-5`}>
      <CupMotif cupId={theme.cupId} className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 opacity-80" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
      <div className="relative grid gap-4 lg:grid-cols-[0.65fr_1fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white/80 backdrop-blur">{status}</span>
            <MatchStatusBadge status={match.status} theme={theme} />
          </div>
          <h3 className="mt-3 text-2xl font-black tracking-tight sm:text-4xl">{match.label}</h3>
          <p className="mt-1 text-sm font-bold text-white/75">{formatDate(match.date)}</p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/15 p-3 backdrop-blur">
          <Team name={match.home} score={match.homeScore} isWinner={match.winner === match.home} theme={theme} featured />
          <p className="my-2 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/60">versus</p>
          <Team name={match.away} score={match.awayScore} isWinner={match.winner === match.away} theme={theme} featured />
        </div>
      </div>
    </section>
  );
}

function MatchCard({ match, theme }: { match: CupMatch; theme: CupTheme }) {
  return (
    <div className={`rounded-xl bg-white p-3 shadow-sm ring-1 transition ${match.status === "decided" ? "ring-green-900/15" : match.status === "live" ? "ring-2 ring-red-400/50" : "ring-green-900/5"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-wide text-green-900/45">{match.label}</p>
        <MatchStatusBadge status={match.status} theme={theme} />
      </div>
      <Team name={match.home} score={match.homeScore} isWinner={match.winner === match.home} theme={theme} />
      <p className="my-1 text-center text-[10px] font-black text-green-900/35">vs</p>
      <Team name={match.away} score={match.awayScore} isWinner={match.winner === match.away} theme={theme} />
    </div>
  );
}

function MatchStatusBadge({ status, theme }: { status: CupMatch["status"]; theme: CupTheme }) {
  if (status === "decided") return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase ${theme.accent}`}>Final</span>;
  if (status === "bye") return <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">Bye</span>;
  if (status === "live") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-red-600">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live
      </span>
    );
  }
  return <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-600">Upcoming</span>;
}

function Team({ name, score, isWinner, theme, featured = false }: { name: string; score: number | null; isWinner: boolean; theme: CupTheme; featured?: boolean }) {
  const placeholder = name === "TBD" || name === "Bye";
  return (
    <p
      className={`flex items-center justify-between gap-2 rounded px-2 py-1 font-black ${
        featured ? "text-base sm:text-lg" : "text-sm"
      } ${
        placeholder ? "bg-slate-100 text-slate-400" : isWinner ? `${theme.soft} ${theme.text}` : featured ? "bg-white/85 text-green-950" : "bg-slate-50 text-green-900/55"
      }`}
    >
      <span className="truncate">{name}</span>
      {score !== null ? <span className={`shrink-0 tabular-nums ${featured ? "text-xl sm:text-2xl" : ""}`}>{score.toFixed(1)}</span> : null}
    </p>
  );
}

function RulesPanel({ theme, scoring, restDates }: { theme: CupTheme; scoring: Array<{ label: string; value: string }>; restDates: string[] }) {
  return (
    <div className={`rounded-2xl border-2 ${theme.border} ${theme.soft} p-5 shadow-sm`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${theme.text}`}>This Cup&apos;s Scoring</p>
      <h2 className="text-2xl font-black text-green-950">Rules at a Glance</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {scoring.map((item) => (
          <div key={item.label} className="rounded-lg bg-white p-3 shadow-sm">
            <p className={`text-xs font-bold uppercase tracking-wide ${theme.text}`}>{item.label}</p>
            <p className="mt-1 text-sm font-bold text-green-950">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-white p-3 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Rest Days</p>
        <p className="mt-1 text-sm font-bold text-slate-700">No cup fixtures or cup scoring on {restDates.map(formatDate).join(", ")}.</p>
      </div>
      <Link href="/cup-rules" className="mt-4 inline-flex rounded-md bg-white px-4 py-2 text-sm font-black text-green-950 shadow-sm hover:bg-green-50">
        Full cup rules →
      </Link>
    </div>
  );
}

function AwardsPanel({ theme, legendPlayer, prizes }: { theme: CupTheme; legendPlayer: ReturnType<typeof getCupLegendPlayer>; prizes: Array<{ place: string; reward: string }> }) {
  return (
    <div className={`rounded-2xl border-2 ${theme.border} ${theme.soft} p-5 shadow-sm`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${theme.text}`}>What&apos;s Up For Grabs</p>
      <h2 className="text-2xl font-black text-green-950">Awards</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1fr]">
        {legendPlayer ? (
          <div className="max-w-xs">
            <PlayerCard player={legendPlayer} variant="album" hideRating />
          </div>
        ) : null}
        <div className="space-y-2">
          {prizes.map((item) => (
            <div key={item.place} className="rounded-lg bg-white p-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700/80">{item.place}</p>
              <p className="mt-1 text-sm font-bold text-green-950">{item.reward}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-white">
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}
