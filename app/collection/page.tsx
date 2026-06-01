"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { PageTitle } from "@/components/PageTitle";
import { allPlayers } from "@/lib/rewardEngine";
import { getOwnedPlayers } from "@/lib/squadUtils";
import { loadUserStateAsync } from "@/lib/storage";
import type { Position, Rarity, UserState } from "@/lib/types";

const rarities: Array<Rarity | "all"> = ["all", "common", "rare", "epic", "legend", "icon"];
const positions: Array<Position | "all"> = ["all", "GK", "DF", "MF", "FW"];

export default function CollectionPage() {
  const [state, setState] = useState<UserState | null>(null);
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [position, setPosition] = useState<Position | "all">("all");
  const [club, setClub] = useState("all");

  useEffect(() => {
    loadUserStateAsync().then(setState);
  }, []);

  const clubs = useMemo(() => ["all", ...Array.from(new Set(allPlayers.map((player) => player.club))).sort()], []);
  const owned = state ? getOwnedPlayers(state) : [];
  const filtered = owned.filter((player) => {
    return (
      (rarity === "all" || player.rarity === rarity) &&
      (position === "all" || player.pos === position) &&
      (club === "all" || player.club === club)
    );
  });

  return (
    <div>
      <PageTitle title="Collection" subtitle={`${owned.length} unique player${owned.length === 1 ? "" : "s"} owned.`} />

      <section className="mb-6 grid gap-3 rounded-lg border border-green-900/10 bg-white p-4 shadow-sm md:grid-cols-3">
        <Filter label="Rarity" value={rarity} onChange={(value) => setRarity(value as Rarity | "all")} options={rarities} />
        <Filter label="Position" value={position} onChange={(value) => setPosition(value as Position | "all")} options={positions} />
        <Filter label="Club" value={club} onChange={setClub} options={clubs} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((player) => (
          <PlayerCard key={player.id} player={player} duplicateCount={state?.duplicateCounts[player.id] ?? 0} />
        ))}
      </section>
      {filtered.length === 0 ? <p className="rounded-lg bg-white p-6 text-center font-bold text-green-950">No players match those filters.</p> : null}
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="text-sm font-bold uppercase tracking-wide text-green-900/70">
      {label}
      <select className="mt-2 w-full rounded-md border border-green-900/20 bg-white px-3 py-2 normal-case tracking-normal" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? "All" : option}
          </option>
        ))}
      </select>
    </label>
  );
}
