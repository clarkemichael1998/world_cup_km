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
  rounds: Array<{ day: number; date: string; label: string }>;
  matches: CupMatch[];
};
type CupHubData = {
  participants: string[];
  cups: CupDefinition[];
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
      .catch(() => setData({ participants: [], cups: [], scoring: [], prizes: [] }));
  }, []);

  const selectedCup = useMemo(() => data?.cups.find((cup) => cup.id === selectedCupId) ?? data?.cups[0], [data, selectedCupId]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          title="KMXI Cups"
          subtitle="Four five-day knockout cups. Random fixtures, daily head-to-heads, activity tie-breaks, and Cup Legend cards for the winners."
        />
        <Link href="/cup-rules" className="rounded-md bg-amber-100 px-4 py-2 text-sm font-black text-amber-900 hover:bg-amber-200">
          Cup Rules
        </Link>
      </div>

      {!data ? (
        <p className="rounded-lg bg-white p-5 text-sm font-bold text-green-900/60 shadow-sm">Loading cup draw...</p>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-3 md:grid-cols-4">
            {data.cups.map((cup) => (
              <button
                key={cup.id}
                onClick={() => setSelectedCupId(cup.id)}
                className={`rounded-xl border p-4 text-left shadow-sm transition ${
                  selectedCup?.id === cup.id ? "border-amber-400 bg-amber-50" : "border-green-900/10 bg-white hover:bg-green-50"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-green-900/50">Cup {cup.id}</p>
                <p className="mt-1 text-lg font-black text-green-950">{cup.name}</p>
                <p className="mt-1 text-xs font-bold text-green-900/65">{formatDate(cup.startDate)} - {formatDate(cup.endDate)}</p>
                <p className="mt-3 rounded-md bg-green-950/5 px-2 py-1 text-xs font-black text-green-950">{cup.prize}</p>
              </button>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-green-900/10 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-green-900/50">Current Draw</p>
                  <h2 className="text-2xl font-black text-green-950">{selectedCup?.name}</h2>
                </div>
                <p className="rounded-full bg-pitch px-3 py-1 text-xs font-black text-white">{data.participants.length} players</p>
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
              <InfoCard title="Prizes">
                {data.prizes.map((item) => (
                  <div key={item.place} className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-800/60">{item.place}</p>
                    <p className="mt-1 text-sm font-bold text-amber-950">{item.reward}</p>
                  </div>
                ))}
              </InfoCard>
              <InfoCard title="Participants">
                <div className="flex flex-wrap gap-1.5">
                  {data.participants.map((name) => (
                    <span key={name} className="rounded-full bg-green-950/5 px-2 py-1 text-xs font-bold text-green-950">{name}</span>
                  ))}
                </div>
              </InfoCard>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Bracket({ cup }: { cup: CupDefinition }) {
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-5">
      {cup.rounds.map((round) => {
        const matches = cup.matches.filter((match) => match.day === round.day);
        return (
          <div key={round.day} className="rounded-lg border border-green-900/10 bg-green-950/[0.02] p-3">
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
