"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { PlayerCard } from "@/components/PlayerCard";
import { CupMotif } from "@/components/CupMotif";
import { LegendSilhouette } from "@/components/LegendSilhouette";
import { getCupLegendPlayer, getCupThemeById } from "@/lib/cupLegends";

type CupMatch = { round: string; day: number; date: string; label: string; home: string; away: string };
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
  return (
    <section className="mt-2 grid gap-4 sm:grid-cols-2">
      {cups.map((cup) => {
        const theme = getCupThemeById(cup.id);
        if (!theme) return null;
        return (
          <button
            key={cup.id}
            type="button"
            disabled={cup.locked}
            onClick={() => onSelect(cup.id)}
            title={cup.locked ? `Unlocks ${formatDate(cup.unlocksOn)}` : `Open ${cup.name}`}
            className={`group relative overflow-hidden rounded-2xl border text-left shadow-sm transition ${
              cup.locked ? "cursor-not-allowed border-white/10" : "border-white/40 hover:-translate-y-1 hover:shadow-xl"
            }`}
          >
            <div className={`relative min-h-56 overflow-hidden bg-gradient-to-br ${theme.colours} p-4 text-white`}>
              <CupMotif cupId={cup.id} className="pointer-events-none absolute inset-0 h-full w-full" />
              <LegendSilhouette shirtNumber={theme.shirtNumber} className="pointer-events-none absolute -bottom-2 -right-4 h-32 w-24 opacity-50" />
              <div className="relative">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">Cup {cup.id}</p>
                <p className="mt-2 text-2xl font-black leading-none drop-shadow">{cup.name}</p>
                <p className="mt-1 text-sm font-bold text-white/80">{cup.country}</p>
              </div>
              {cup.locked ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-green-950/60 backdrop-blur-[1px]">
                  <LockIcon />
                  <p className="text-xs font-black uppercase tracking-wide text-white/90">Unlocks {formatDate(cup.unlocksOn)}</p>
                </div>
              ) : null}
            </div>
            <div className="bg-white p-4">
              <p className="text-xs font-bold text-green-900/60">{formatDate(cup.startDate)} - {formatDate(cup.endDate)}</p>
              <p className="mt-2 text-lg font-black text-green-950">{cup.locked ? "???" : cup.prize}</p>
              <p className="mt-1 text-xs font-bold text-green-900/60">Winner: 35 stickers + Cup Legend</p>
            </div>
          </button>
        );
      })}
    </section>
  );
}

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
  if (!theme) return null;

  return (
    <div className="relative space-y-6">
      {/* Faint theme wash behind everything below the saturated hero, so the
          cup's identity carries through the bracket and sidebar too. */}
      <div className={`pointer-events-none absolute inset-x-0 top-56 -z-10 bottom-0 bg-gradient-to-b ${theme.colours} opacity-[0.05]`} />

      <HeroCup cup={cup} theme={theme} legendPlayer={legendPlayer} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className={`relative overflow-hidden rounded-2xl border-2 ${theme.border} bg-white p-5 shadow-sm`}>
          <CupMotif cupId={cup.id} className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Current Draw</p>
              <h2 className="text-2xl font-black text-green-950">{cup.name}</h2>
            </div>
            <p className={`rounded-full bg-gradient-to-r ${theme.colours} px-3 py-1 text-xs font-black text-white shadow-sm`}>
              {formatDate(cup.startDate)} - {formatDate(cup.endDate)}
            </p>
          </div>
          <Bracket cup={cup} theme={theme} />
        </div>

        <div className="space-y-4">
          <InfoCard title="Scoring" theme={theme}>
            {scoring.map((item) => (
              <div key={item.label} className={`rounded-lg p-3 ${theme.soft}`}>
                <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>{item.label}</p>
                <p className="mt-1 text-sm font-bold text-green-950">{item.value}</p>
              </div>
            ))}
          </InfoCard>
          <InfoCard title="Rest Days" theme={theme}>
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-sm font-bold text-slate-700">No cup fixtures or cup scoring on {restDates.map(formatDate).join(", ")}.</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Cup 4 final is scheduled for 19 July.</p>
            </div>
          </InfoCard>
          <InfoCard title="Prizes" theme={theme}>
            {prizes.map((item) => (
              <div key={item.place} className="rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-amber-800/60">{item.place}</p>
                <p className="mt-1 text-sm font-bold text-amber-950">{item.reward}</p>
              </div>
            ))}
          </InfoCard>
        </div>
      </section>
    </div>
  );
}

function HeroCup({ cup, theme, legendPlayer }: { cup: CupDefinition; theme: NonNullable<ReturnType<typeof getCupThemeById>>; legendPlayer: ReturnType<typeof getCupLegendPlayer> }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${theme.colours} p-6 text-white shadow-xl`}>
      <CupMotif cupId={cup.id} className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 opacity-90" />
      <LegendSilhouette shirtNumber={theme.shirtNumber} className="pointer-events-none absolute -bottom-6 left-2 hidden h-64 w-48 opacity-40 sm:block" />
      <div className="relative grid gap-5 md:grid-cols-[1fr_0.8fr] md:items-end">
        <div className="md:pl-44">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-white/70">{cup.country} Legend Theme</p>
          <h2 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">{cup.legend}</h2>
        </div>
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/70">Prize Card</p>
          {legendPlayer ? (
            <div className="max-w-xs">
              <PlayerCard player={legendPlayer} variant="album" hideRating />
            </div>
          ) : null}
          <p className="mt-2 text-xs font-bold text-white/80">Cup winner also receives 35 stickers. Runner-up receives 30 stickers plus a guaranteed Icon.</p>
        </div>
      </div>
    </section>
  );
}

function Bracket({ cup, theme }: { cup: CupDefinition; theme: NonNullable<ReturnType<typeof getCupThemeById>> }) {
  return (
    <div className="relative mt-5 grid gap-4 xl:grid-cols-5">
      {cup.rounds.map((round) => {
        const matches = cup.matches.filter((match) => match.day === round.day);
        return (
          <div key={round.day} className={`rounded-xl border ${theme.border} ${theme.soft} p-3`}>
            <p className={`text-xs font-black uppercase tracking-wide ${theme.text}`}>Day {round.day}</p>
            <p className="font-black text-green-950">{round.label}</p>
            <p className="mb-3 text-xs font-bold text-green-900/55">{formatDate(round.date)}</p>
            <div className="space-y-2">
              {matches.map((match) => (
                <div key={`${match.round}-${match.label}`} className="rounded-md bg-white p-3 shadow-sm ring-1 ring-green-900/5">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-green-900/45">{match.label}</p>
                  <Team name={match.home} theme={theme} />
                  <p className="my-1 text-center text-[10px] font-black text-green-900/35">vs</p>
                  <Team name={match.away} theme={theme} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Team({ name, theme }: { name: string; theme: NonNullable<ReturnType<typeof getCupThemeById>> }) {
  const placeholder = name.startsWith("Winner") || name.startsWith("Bye");
  return <p className={`rounded px-2 py-1 text-sm font-black ${placeholder ? "bg-slate-100 text-slate-500" : `${theme.soft} ${theme.text}`}`}>{name}</p>;
}

function InfoCard({ title, theme, children }: { title: string; theme: NonNullable<ReturnType<typeof getCupThemeById>>; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl border-2 ${theme.border} bg-white p-4 shadow-sm`}>
      <p className={`mb-3 text-sm font-black uppercase tracking-wide ${theme.text}`}>{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
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
