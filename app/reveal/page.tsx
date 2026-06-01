"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { PageTitle } from "@/components/PageTitle";
import { loadRevealPlayersAsync } from "@/lib/storage";
import type { Player } from "@/lib/types";

export default function RevealPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    loadRevealPlayersAsync().then(setPlayers);
  }, []);

  const current = players[index];
  const hasRewards = players.length > 0;
  const isLast = index >= players.length - 1;

  return (
    <div>
      <PageTitle title="Reveal" subtitle={hasRewards ? `${players.length} reward${players.length === 1 ? "" : "s"} earned.` : "No rewards waiting right now."} />

      {current ? (
        <section className="mx-auto max-w-md text-center">
          <div className="animate-[pulse_1.1s_ease-in-out_1]">
            <PlayerCard player={current} large />
          </div>
          <p className="mt-4 text-sm font-bold text-green-900/70">
            Card {index + 1} of {players.length}
          </p>
          <div className="mt-5">
            {isLast ? (
              <Link className="inline-flex rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800" href="/collection">
                Continue to collection
              </Link>
            ) : (
              <button className="rounded-md bg-boot px-5 py-3 font-black text-white hover:bg-red-700" onClick={() => setIndex(index + 1)}>
                Reveal next
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
