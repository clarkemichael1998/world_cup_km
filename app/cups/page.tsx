"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/PageTitle";

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
  colours: string;
  accent: string;
  motif: string;
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
      {cups.map((cup) => (
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
          <div className={`relative min-h-56 overflow-hidden bg-gradient-to-br ${cup.colours} p-4 text-white`}>
            <CupMotif cupId={cup.id} />
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
      ))}
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
  return (
    <div className="space-y-6">
      <HeroCup cup={cup} />

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-green-900/10 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-green-900/50">Current Draw</p>
              <h2 className="text-2xl font-black text-green-950">{cup.name}</h2>
            </div>
            <p className="rounded-full bg-pitch px-3 py-1 text-xs font-black text-white">{formatDate(cup.startDate)} - {formatDate(cup.endDate)}</p>
          </div>
          <Bracket cup={cup} />
        </div>

        <div className="space-y-4">
          <InfoCard title="Scoring">
            {scoring.map((item) => (
              <div key={item.label} className="rounded-lg bg-green-950/5 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-green-900/50">{item.label}</p>
                <p className="mt-1 text-sm font-bold text-green-950">{item.value}</p>
              </div>
            ))}
          </InfoCard>
          <InfoCard title="Rest Days">
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-sm font-bold text-slate-700">No cup fixtures or cup scoring on {restDates.map(formatDate).join(", ")}.</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Cup 4 final is scheduled for 19 July.</p>
            </div>
          </InfoCard>
          <InfoCard title="Prizes">
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

function HeroCup({ cup }: { cup: CupDefinition }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${cup.colours} p-6 text-white shadow-xl`}>
      <CupMotif cupId={cup.id} large />
      <div className="relative grid gap-5 md:grid-cols-[1fr_0.8fr] md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-white/70">{cup.country} Legend Theme</p>
          <h2 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">{cup.legend}</h2>
        </div>
        <div className="rounded-2xl bg-white/15 p-4 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-wide text-white/70">Prize Card</p>
          <p className="mt-2 text-3xl font-black">{cup.prize}</p>
          <p className="mt-2 text-sm font-bold text-white/80">Cup winner also receives 35 stickers. Runner-up receives 30 stickers plus a guaranteed Icon.</p>
        </div>
      </div>
    </section>
  );
}

function Bracket({ cup }: { cup: CupDefinition }) {
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-5">
      {cup.rounds.map((round) => {
        const matches = cup.matches.filter((match) => match.day === round.day);
        return (
          <div key={round.day} className="rounded-xl border border-green-900/10 bg-green-950/[0.02] p-3">
            <p className="text-xs font-black uppercase tracking-wide text-green-900/50">Day {round.day}</p>
            <p className="font-black text-green-950">{round.label}</p>
            <p className="mb-3 text-xs font-bold text-green-900/55">{formatDate(round.date)}</p>
            <div className="space-y-2">
              {matches.map((match) => (
                <div key={`${match.round}-${match.label}`} className="rounded-md bg-white p-3 shadow-sm ring-1 ring-green-900/5">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-green-900/45">{match.label}</p>
                  <Team name={match.home} />
                  <p className="my-1 text-center text-[10px] font-black text-green-900/35">vs</p>
                  <Team name={match.away} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Team({ name }: { name: string }) {
  const placeholder = name.startsWith("Winner") || name.startsWith("Bye");
  return <p className={`rounded px-2 py-1 text-sm font-black ${placeholder ? "bg-slate-100 text-slate-500" : "bg-pitch/10 text-green-950"}`}>{name}</p>;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-green-900/10 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm font-black uppercase tracking-wide text-green-900/60">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Decorative, wordless motifs per cup — inspired by each legend's nation
// (flag shapes, light, movement) rather than literal portraits or captions.
function CupMotif({ cupId, large = false }: { cupId: number; large?: boolean }) {
  const wrapClass = large
    ? "pointer-events-none absolute -right-10 -top-16 h-72 w-72 opacity-90"
    : "pointer-events-none absolute inset-0 h-full w-full";
  switch (cupId) {
    case 1:
      return <LarssonMotif className={wrapClass} large={large} />;
    case 2:
      return <DalglishMotif className={wrapClass} />;
    case 3:
      return <MaradonaMotif className={wrapClass} />;
    case 4:
      return <PeleMotif className={wrapClass} />;
    default:
      return null;
  }
}

// Sweden / Larsson — braided gold arcs sweeping like a striker's run, plus
// cold floodlight beams fanning from the corner.
function LarssonMotif({ className, large }: { className: string; large: boolean }) {
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#fde68a" strokeWidth={large ? 1.5 : 2} opacity="0.28">
        <line x1="200" y1="0" x2="40" y2="200" />
        <line x1="200" y1="0" x2="90" y2="200" />
        <line x1="200" y1="0" x2="140" y2="200" />
        <line x1="200" y1="0" x2="190" y2="200" />
      </g>
      <g fill="none" stroke="#fde68a" strokeWidth="4" opacity="0.55" strokeLinecap="round">
        <path d="M -20 165 Q 100 95 220 165" />
        <path d="M -20 195 Q 100 125 220 195" />
      </g>
      <circle cx="34" cy="40" r="3" fill="#fde68a" opacity="0.7" />
    </svg>
  );
}

// Scotland / Dalglish — a fragmented saltire (the diagonal cross of the
// Scottish flag), broken into shards rather than a solid flag graphic.
function DalglishMotif({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#ffffff" strokeWidth="11" strokeLinecap="square" opacity="0.32" strokeDasharray="20 12">
        <line x1="-20" y1="-20" x2="220" y2="220" />
        <line x1="220" y1="-20" x2="-20" y2="220" />
      </g>
      <g stroke="#cfe0ff" strokeWidth="5" strokeLinecap="square" opacity="0.4" strokeDasharray="8 26">
        <line x1="-20" y1="-20" x2="220" y2="220" />
        <line x1="220" y1="-20" x2="-20" y2="220" />
      </g>
    </svg>
  );
}

// Argentina / Maradona — a sunburst halo fanning from the corner over the
// sky-blue-and-white stripes of the national shirt.
function MaradonaMotif({ className }: { className: string }) {
  const rays = [10, 28, 46, 64, 82, 100, 118, 136];
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g opacity="0.16" fill="#ffffff">
        <rect x="0" y="34" width="200" height="16" />
        <rect x="0" y="84" width="200" height="16" />
        <rect x="0" y="134" width="200" height="16" />
      </g>
      <g stroke="#fff7d6" strokeWidth="2.5" opacity="0.4">
        {rays.map((angle) => {
          const radians = (angle * Math.PI) / 180;
          const x2 = 220 * Math.cos(radians);
          const y2 = 220 - 220 * Math.sin(radians);
          return <line key={angle} x1="0" y1="200" x2={x2} y2={y2} />;
        })}
      </g>
    </svg>
  );
}

// Brazil / Pele — rolling samba waves with small gold flare bursts, in the
// green/gold/blue of the shirt.
function PeleMotif({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#ffffff" strokeWidth="3.5" opacity="0.3" strokeLinecap="round">
        <path d="M -20 60 Q 30 35 80 60 T 220 60" />
        <path d="M -20 105 Q 30 80 80 105 T 220 105" />
        <path d="M -20 150 Q 30 125 80 150 T 220 150" />
      </g>
      <g fill="#fde68a" opacity="0.75">
        <path d="M42 26 L46 38 L58 42 L46 46 L42 58 L38 46 L26 42 L38 38 Z" />
        <path d="M162 152 L165 161 L174 164 L165 167 L162 176 L159 167 L150 164 L159 161 Z" />
      </g>
    </svg>
  );
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
