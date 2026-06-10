"use client";

import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { flagUrl } from "@/lib/flags";

type Contributor = { name: string; nation: string; rarity: string; count: number };
type Match = {
  matchId: string;
  kickoffAt: string;
  homeTeam: string;
  awayTeam: string;
  winner: string | null;
  status: string;
  scorers: Contributor[];
  assisters: Contributor[];
};
type Day = { date: string; matches: Match[] };

export default function ResultsPage() {
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    fetch("/api/results")
      .then((r) => r.json())
      .then((d) => setDays(d.days ?? []))
      .catch(() => setDays([]));
  }, []);

  return (
    <div>
      <PageTitle title="Results" subtitle="Every World Cup fixture by day, with the KMXI players who scored and assisted." />

      {days === null ? (
        <p className="rounded-lg bg-white p-6 text-sm font-semibold text-green-900/60 shadow-sm">Loading results...</p>
      ) : days.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-sm font-semibold text-green-900/60 shadow-sm">No fixtures yet. They&apos;ll appear here as the tournament kicks off.</p>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.date}>
              <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-green-900/55">{formatDay(day.date)}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {day.matches.map((match) => (
                  <MatchCard key={match.matchId} match={match} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs font-semibold text-green-900/45">
        Goalscorers and assisters shown are players in the KMXI sticker pool. Players outside the pool aren&apos;t tracked.
      </p>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  const finished = match.status === "FINISHED";
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Team name={match.homeTeam} won={match.winner === match.homeTeam} />
        <div className="shrink-0 text-center">
          {finished ? (
            <span className="rounded-md bg-green-950/5 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-green-900/60">Full time</span>
          ) : (
            <span className="rounded-md bg-sky-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-sky-700">{match.status === "IN_PLAY" || match.status === "LIVE" ? "Live" : kickoffTime(match.kickoffAt)}</span>
          )}
        </div>
        <Team name={match.awayTeam} won={match.winner === match.awayTeam} alignRight />
      </div>

      {finished && !match.winner ? <p className="mt-2 text-center text-[11px] font-black uppercase tracking-wide text-green-900/45">Draw</p> : null}

      {match.scorers.length > 0 || match.assisters.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-green-900/10 pt-3">
          {match.scorers.map((c, i) => (
            <ContributorRow key={`g${i}`} icon="⚽" c={c} />
          ))}
          {match.assisters.map((c, i) => (
            <ContributorRow key={`a${i}`} icon="🅰️" c={c} />
          ))}
        </div>
      ) : finished ? (
        <p className="mt-3 border-t border-green-900/10 pt-3 text-[11px] font-semibold text-green-900/45">No KMXI-pool goals or assists in this match.</p>
      ) : null}
    </div>
  );
}

function Team({ name, won, alignRight = false }: { name: string; won: boolean; alignRight?: boolean }) {
  const flag = flagUrl(name);
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${alignRight ? "flex-row-reverse text-right" : ""}`}>
      {flag ? <img src={flag} alt="" className="h-5 w-7 shrink-0 rounded-sm object-cover shadow-sm" /> : null}
      <span className={`truncate text-sm font-black ${won ? "text-green-950" : "text-green-900/70"}`}>
        {name}
        {won ? <span className="ml-1 text-pitch">✓</span> : null}
      </span>
    </div>
  );
}

function ContributorRow({ icon, c }: { icon: string; c: Contributor }) {
  const flag = flagUrl(c.nation);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0">{icon}</span>
      {flag ? <img src={flag} alt="" className="h-3 shrink-0 rounded-sm object-cover" style={{ width: "1.1rem" }} /> : null}
      <span className="truncate font-bold text-green-950">{c.name}</span>
      {c.count > 1 ? <span className="shrink-0 rounded bg-green-950/10 px-1.5 text-xs font-black text-green-900">×{c.count}</span> : null}
    </div>
  );
}

function kickoffTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });
}
