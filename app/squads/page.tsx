"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";

type SquadPlayer = {
  slot: string;
  id: number;
  name: string;
  nation: string;
  club: string;
  pos: string;
  rarity: string;
  rating: number;
  boost: number;
  goalBoost: number;
  assistBoost: number;
  winCredits: number;
  effectiveRating: number;
};

type CommunitySquad = {
  username: string;
  best: {
    rating: number;
    players: SquadPlayer[];
  };
  locked: {
    lockDate: string;
    rating: number;
    players: SquadPlayer[];
  } | null;
};

const rowGroups = [
  { label: "FW", slots: ["FW1", "FW2", "FW3"] },
  { label: "MF", slots: ["MF1", "MF2", "MF3"] },
  { label: "DF", slots: ["DF1", "DF2", "DF3", "DF4"] },
  { label: "GK", slots: ["GK"] }
];

export default function CommunitySquadsPage() {
  const [squads, setSquads] = useState<CommunitySquad[] | null>(null);

  useEffect(() => {
    fetch("/api/community-squads")
      .then((response) => response.json())
      .then((payload) => setSquads(payload.squads ?? []))
      .catch(() => setSquads([]));
  }, []);

  return (
    <div>
      <PageTitle title="Rivals" subtitle="Compare everyone's strongest XI, locked squads, and player-level win, goal, and assist awards." />

      {squads === null ? (
        <p className="rounded-lg bg-white p-6 text-sm font-bold text-green-900/60 shadow-sm">Loading squads...</p>
      ) : squads.length === 0 ? (
        <p className="rounded-lg bg-white p-6 text-sm font-bold text-green-900/60 shadow-sm">No squads yet.</p>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {squads.map((entry) => (
            <article key={entry.username} className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-green-950">
                    <Link className="hover:underline" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link>
                  </h2>
                  <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">
                    Best XI {entry.best.rating > 0 ? entry.best.rating.toFixed(1) : "--"} avg
                    {entry.locked ? ` / Locked ${entry.locked.rating.toFixed(1)} avg` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <SquadPanel title="Best XI" rating={entry.best.rating} players={entry.best.players} empty="No players collected yet." />
                <SquadPanel
                  title={entry.locked ? `Locked XI / ${entry.locked.lockDate}` : "Locked XI"}
                  rating={entry.locked?.rating ?? 0}
                  players={entry.locked?.players ?? []}
                  empty="No locked squad yet."
                />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function SquadPanel({ title, rating, players, empty }: { title: string; rating: number; players: SquadPlayer[]; empty: string }) {
  return (
    <div className="rounded-lg bg-green-950/5 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-green-900/60">{title}</p>
        <p className="rounded-md bg-white px-2 py-1 text-xs font-black text-pitch">{rating > 0 ? rating.toFixed(1) : "--"}</p>
      </div>

      {players.length === 0 ? (
        <p className="rounded-md bg-white/70 p-3 text-sm font-bold text-green-900/60">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rowGroups.map((group) => (
            <div key={group.label} className="grid grid-cols-[26px_1fr] items-center gap-2">
              <p className="text-[10px] font-black text-green-900/45">{group.label}</p>
              <div className={`grid gap-1.5 ${group.slots.length === 4 ? "grid-cols-4" : group.slots.length === 3 ? "grid-cols-3" : "grid-cols-1"}`}>
                {group.slots.map((slot) => {
                  const player = players.find((item) => item.slot === slot);
                  return <MiniCard key={slot} slot={slot} player={player} />;
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniCard({ slot, player }: { slot: string; player?: SquadPlayer }) {
  if (!player) {
    return (
      <div className="min-h-20 rounded-md border border-dashed border-green-900/15 bg-white/50 p-2">
        <p className="text-[10px] font-black text-green-900/35">{slot}</p>
      </div>
    );
  }

  const hasSplitBoost = player.goalBoost !== 0 || player.assistBoost !== 0;
  const boostLabel = player.boost > 0 ? `+${player.boost}` : `${player.boost}`;
  const goalLabel = player.goalBoost > 0 ? `+${player.goalBoost}` : `${player.goalBoost}`;
  const assistLabel = player.assistBoost > 0 ? `+${player.assistBoost}` : `${player.assistBoost}`;

  return (
    <div className="min-h-20 rounded-md bg-white p-2 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <p className="text-[9px] font-black uppercase text-green-900/45">{slot}</p>
        <p className="rounded bg-gold px-1.5 py-0.5 text-[10px] font-black text-green-950">
          {player.effectiveRating}
        </p>
      </div>
      <p className="mt-1 break-words text-[11px] font-black leading-tight text-green-950">{player.name}</p>
      <p className="mt-0.5 truncate text-[9px] font-bold text-green-900/60">{player.nation}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {player.winCredits > 0 ? <AwardPill label={`Win +${player.winCredits}`} tone="gold" /> : null}
        {player.goalBoost !== 0 ? <AwardPill label={`Goal ${goalLabel}`} tone="green" /> : null}
        {player.assistBoost !== 0 ? <AwardPill label={`Assist ${assistLabel}`} tone="green" /> : null}
        {!hasSplitBoost && player.boost !== 0 ? <AwardPill label={`Boost ${boostLabel}`} tone="green" /> : null}
      </div>
    </div>
  );
}

function AwardPill({ label, tone }: { label: string; tone: "gold" | "green" }) {
  const className =
    tone === "gold"
      ? "bg-gold/30 text-green-950 ring-gold/40"
      : "bg-green-100 text-green-800 ring-green-700/10";

  return <span className={`rounded px-1 py-0.5 text-[8px] font-black leading-none ring-1 ${className}`}>{label}</span>;
}
