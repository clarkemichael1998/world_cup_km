"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { PageTitle } from "@/components/PageTitle";
import { loadRevealPlayersAsync } from "@/lib/storage";
import type { Player } from "@/lib/types";

const revealLabels = ["Open pack", "Reveal rating", "Reveal player", "View card"];

export default function RevealPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    loadRevealPlayersAsync().then(setPlayers);
  }, []);

  const current = players[index];
  const hasRewards = players.length > 0;
  const isLast = index >= players.length - 1;
  const isFinalStage = stage >= 3;

  function advance() {
    if (!isFinalStage) {
      setStage(stage + 1);
      return;
    }

    if (!isLast) {
      setIndex(index + 1);
      setStage(0);
    }
  }

  return (
    <div>
      <PageTitle title="Reveal" subtitle={hasRewards ? `${players.length} reward${players.length === 1 ? "" : "s"} earned.` : "No rewards waiting right now."} />

      {current ? (
        <section className="mx-auto max-w-xl text-center">
          <RevealProgress stage={stage} />

          <div className="mt-5">
            {isFinalStage ? <PlayerCard player={current} large /> : <RevealPack player={current} stage={stage} />}
          </div>

          <p className="mt-4 text-sm font-bold text-green-900/70">
            Card {index + 1} of {players.length}
          </p>

          <div className="mt-5">
            {isFinalStage && isLast ? (
              <Link className="inline-flex rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800" href="/collection">
                Continue to collection
              </Link>
            ) : (
              <button className="rounded-md bg-boot px-5 py-3 font-black text-white hover:bg-red-700" onClick={advance}>
                {isFinalStage ? "Reveal next" : revealLabels[stage + 1]}
              </button>
            )}
          </div>
        </section>
      ) : (
        <Link className="inline-flex rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800" href="/add-km">
          Add KM
        </Link>
      )}
    </div>
  );
}

function RevealPack({ player, stage }: { player: Player; stage: number }) {
  return (
    <article className="mx-auto min-h-[420px] rounded-lg border-2 border-green-900/15 bg-gradient-to-br from-green-950 via-pitch to-green-800 p-5 text-white shadow-lg">
      <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-md border border-white/20 bg-white/5 p-6">
        {stage === 0 ? (
          <>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-green-100/70">KMXI</p>
            <p className="mt-4 text-5xl font-black">?</p>
            <p className="mt-4 text-sm font-bold text-green-50/80">Tap to open the card.</p>
          </>
        ) : null}

        {stage >= 1 ? (
          <div className="rounded-lg bg-white px-8 py-5 text-green-950 shadow-sm">
            <p className="text-6xl font-black leading-none">{player.rating}</p>
            <p className="mt-1 text-lg font-black">{player.pos}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-wide text-green-900/60">{player.rarity}</p>
          </div>
        ) : null}

        {stage >= 2 ? (
          <div className="mt-6 animate-[pulse_0.8s_ease-in-out_1]">
            <p className="text-4xl font-black leading-tight">{player.name}</p>
            <p className="mt-2 text-lg font-bold text-green-50/85">{player.nation}</p>
            <p className="mt-1 text-sm font-semibold text-green-50/70">{player.club}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function RevealProgress({ stage }: { stage: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {revealLabels.map((label, index) => (
        <div key={label} className={`rounded-md px-2 py-2 text-xs font-black uppercase tracking-wide ${index <= stage ? "bg-pitch text-white" : "bg-white text-green-900/50"}`}>
          {label}
        </div>
      ))}
    </div>
  );
}
