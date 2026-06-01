"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { formatDate } from "@/lib/formatDate";

type LivePayload = {
  user: { username: string; rewardCredits: number };
  live: {
    tournamentActive: boolean;
    lockDate: string;
    lockAt: string;
    unlockAt: string;
    rewardCredits: number;
    providerStatus: { provider: string; status: "ok" | "fallback" | "error"; message: string; checkedAt: string };
    lockedSquad: Array<{ slot: string; player: { id: number; name: string; nation: string; club: string; rating: number } }>;
    finishedMatches: Array<{ matchId: string; homeTeam: string; awayTeam: string; winner: string | null; matchDate: string; verified: boolean }>;
    rewardEvents: Array<{ matchId: string; playerName: string; nation: string; credits: number }>;
    leaderboard: Array<{ username: string; averageRating: number; selectedCount: number }>;
  };
};

export default function LivePage() {
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/live")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load live status.");
        setPayload(data);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div>
        <PageTitle title="Live" subtitle="Daily squad locks and World Cup win bonuses." />
        <div className="rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
          <p className="font-bold text-green-950">{error}</p>
          <Link className="mt-4 inline-flex rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800" href="/login">
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div>
        <PageTitle title="Live" subtitle="Loading daily lock status..." />
      </div>
    );
  }

  const { live } = payload;
  const creditsEarned = live.rewardEvents.reduce((sum, event) => sum + event.credits, 0);

  return (
    <div>
      <PageTitle title="Live" subtitle={live.tournamentActive ? `Locked squad window: ${formatDate(live.lockAt)} to ${formatDate(live.unlockAt)}` : "Live World Cup bonuses activate from 11 June to 19 July 2026."} />

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Reward credits" value={String(live.rewardCredits)} />
        <Stat label="Locked players" value={`${live.lockedSquad.length}/11`} />
        <Stat label="Today's bonuses" value={`+${creditsEarned}`} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Locked XI</p>
                <p className="mt-1 text-sm font-semibold text-green-900/75">{live.tournamentActive ? "Auto-locks daily at 11:00 UK time." : "Your draft squad can be planned now; locking starts with the tournament."}</p>
              </div>
              <Link className="rounded-md bg-green-950 px-4 py-2 text-sm font-black text-white hover:bg-green-800" href="/squad">
                Plan tomorrow
              </Link>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {live.lockedSquad.map(({ slot, player }) => (
                <div key={slot} className="rounded-md bg-green-950/5 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-green-900/55">{slot}</p>
                  <p className="mt-1 truncate text-base font-black text-green-950">{player.name}</p>
                  <p className="truncate text-sm font-semibold text-green-900/75">{player.nation}</p>
                </div>
              ))}
              {live.lockedSquad.length === 0 ? <p className="text-sm font-bold text-green-900/70">Sync your squad from the Squad page to create tomorrow's lock.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-green-900/60">Live Leaderboard</p>
            <p className="mt-1 text-sm font-semibold text-green-900/75">Ranked by each user's best possible XI from owned players. This does not change locked live squads.</p>
            <div className="mt-4 space-y-2">
              {live.leaderboard.length > 0 ? (
                live.leaderboard.map((entry, index) => (
                  <div key={entry.username} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 rounded-md bg-green-950/5 px-3 py-2 text-sm font-bold text-green-950">
                    <span className="text-lg font-black">{index + 1}</span>
                    <span className="truncate">{entry.username}</span>
                    <span className="rounded-md bg-gold px-2 py-1 text-xs font-black">
                      {entry.averageRating} avg - {entry.selectedCount}/11
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm font-semibold text-green-900/70">Leaderboard starts once squads lock during the tournament.</p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Panel title="Result Feed">
            <div className={`rounded-md p-3 text-sm font-bold ${live.providerStatus.status === "ok" ? "bg-green-50 text-green-950" : "bg-amber-50 text-amber-950"}`}>
              <p>{live.providerStatus.provider}</p>
              <p className="mt-1">{live.providerStatus.message}</p>
              <p className="mt-1 text-xs opacity-70">Checked {formatDate(live.providerStatus.checkedAt)}</p>
            </div>
          </Panel>

          <Panel title="Finished Results">
            {live.finishedMatches.length > 0 ? (
              live.finishedMatches.map((match) => (
                <div key={match.matchId} className="rounded-md bg-green-950/5 p-3 text-sm font-bold text-green-950">
                  <p>
                    {match.homeTeam} vs {match.awayTeam}
                  </p>
                  <p className="mt-1 text-green-900/70">Winner: {match.winner ?? "None"}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-green-900/50">{match.verified ? "Verified for rewards" : "Pending verification"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-green-900/70">No finished World Cup results in this lock window yet.</p>
            )}
          </Panel>

          <Panel title="Bonus Ledger">
            {live.rewardEvents.length > 0 ? (
              live.rewardEvents.map((event) => (
                <div key={`${event.matchId}-${event.playerName}`} className="rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-950">
                  +{event.credits} credits: {event.playerName} ({event.nation})
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold text-green-900/70">No result bonuses awarded yet.</p>
            )}
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-green-800/70">{label}</p>
      <p className="mt-2 text-4xl font-black text-green-950">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <p className="text-sm font-black uppercase tracking-wide text-green-900/60">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

