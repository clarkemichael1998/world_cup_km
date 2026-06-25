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
  const [selectedCupId, setSelectedCupId] = useState(1);

  useEffect(() => {
    fetch("/api/cups", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => setData(payload))
      .catch(() => setData({ participants: [], cups: [], restDates: [], scoring: [], prizes: [] }));
  }, []);

  const selectedCup = useMemo(() => data?.cups.find((cup) => cup.id === selectedCupId) ?? data?.cups[0], [data, selectedCupId]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          title="KMXI Cups"
          subtitle="Four five-round knockout cups across the remaining World Cup matchdays. Random fixtures, activity-heavy head-to-heads, and 100+ Cup Legend cards for the winners."
        />
        <Link href="/cup-rules" className="rounded-md bg-amber-100 px-4 py-2 text-sm font-black text-amber-900 hover:bg-amber-200">
          Cup Rules
        </Link>
      </div>

      {!data ? (
        <p className="rounded-lg bg-white p-5 text-sm font-bold text-green-900/60 shadow-sm">Loading cup draw...</p>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            {data.cups.map((cup) => (
              <button
                key={cup.id}
                onClick={() => setSelectedCupId(cup.id)}
                className={`group overflow-hidden rounded-2xl border text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                  selectedCup?.id === cup.id ? "border-amber-300 ring-4 ring-amber-200/60" : "border-white/40"
                }`}
              >
                <div className={`relative min-h-52 bg-gradient-to-br ${cup.colours} p-4 text-white`}>
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/20 blur-sm" />
                  <div className="absolute bottom-4 right-4 h-24 w-24 rounded-full border-8 border-white/20" />
                  <div className="absolute bottom-10 right-10 h-8 w-8 rounded-full bg-white/30" />
                  <p className="relative text-xs font-black uppercase tracking-[0.25em] text-white/70">Cup {cup.id}</p>
                  <p className="relative mt-2 text-2xl font-black leading-none drop-shadow">{cup.name}</p>
                  <p className="relative mt-1 text-sm font-bold text-white/80">{cup.country}</p>
                  <p className="relative mt-8 max-w-[12rem] text-xs font-bold leading-5 text-white/80">{cup.motif}</p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-xs font-bold text-green-900/60">{formatDate(cup.startDate)} - {formatDate(cup.endDate)}</p>
                  <p className="mt-2 text-lg font-black text-green-950">{cup.prize}</p>
                  <p className="mt-1 text-xs font-bold text-green-900/60">Winner: 35 stickers + Cup Legend</p>
                </div>
              </button>
            ))}
          </section>

          {selectedCup ? <HeroCup cup={selectedCup} /> : null}

          <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border border-green-900/10 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-green-900/50">Current Draw</p>
                  <h2 className="text-2xl font-black text-green-950">{selectedCup?.name}</h2>
                </div>
                <p className="rounded-full bg-pitch px-3 py-1 text-xs font-black text-white">{formatDate(selectedCup?.startDate ?? "")} - {formatDate(selectedCup?.endDate ?? "")}</p>
              </div>
              {selectedCup ? <Bracket cup={selectedCup} /> : null}
            </div>

            <div className="space-y-4">
              <InfoCard title="Scoring">
                {data.scoring.map((item) => (
                  <div key={item.label} className="rounded-lg bg-green-950/5 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-green-900/50">{item.label}</p>
                    <p className="mt-1 text-sm font-bold text-green-950">{item.value}</p>
                  </div>
                ))}
              </InfoCard>
              <InfoCard title="Rest Days">
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-sm font-bold text-slate-700">
                    No cup fixtures or cup scoring on {data.restDates.map(formatDate).join(", ")}.
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">Cup 4 final is scheduled for 19 July.</p>
                </div>
              </InfoCard>
              <InfoCard title="Prizes">
                {data.prizes.map((item) => (
                  <div key={item.place} className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-800/60">{item.place}</p>
                    <p className="mt-1 text-sm font-bold text-amber-950">{item.reward}</p>
                  </div>
                ))}
              </InfoCard>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function HeroCup({ cup }: { cup: CupDefinition }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${cup.colours} p-6 text-white shadow-xl`}>
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-md" />
      <div className="absolute bottom-0 right-8 h-40 w-40 rounded-full border-[18px] border-white/15" />
      <div className="absolute bottom-16 right-24 h-12 w-12 rounded-full bg-white/25" />
      <div className="relative grid gap-5 md:grid-cols-[1fr_0.8fr] md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-white/70">{cup.country} Legend Theme</p>
          <h2 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">{cup.legend}</h2>
          <p className="mt-3 max-w-xl text-sm font-bold leading-6 text-white/80">{cup.motif}</p>
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

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
