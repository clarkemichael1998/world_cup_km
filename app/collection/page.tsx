"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { PageTitle } from "@/components/PageTitle";
import { allPlayers } from "@/lib/rewardEngine";
import { getOwnedPlayers } from "@/lib/squadUtils";
import { loadUserStateAsync } from "@/lib/storage";
import type { Position, Rarity, UserState } from "@/lib/types";

const rarities: Array<Rarity | "all"> = ["all", "clowns", "common", "rare", "epic", "legend", "icon"];
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
  const raritySummary = rarities
    .filter((item): item is Rarity => item !== "all")
    .map((item) => ({ rarity: item, count: owned.filter((player) => player.rarity === item).length }))
    .filter((item) => item.count > 0);

  return (
    <div>
      <PageTitle title="Sticker Album" subtitle={`${owned.length} official KMXI sticker${owned.length === 1 ? "" : "s"} placed in your World Cup 2026 album.`} />

      <section className="mb-5 overflow-hidden rounded-lg border border-green-900/10 bg-[#fbf7ea] shadow-sm">
        <div className="border-b border-green-900/10 bg-white/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-green-900/45">Album Page</p>
              <h2 className="mt-1 text-2xl font-black text-green-950">Collected Stickers</h2>
            </div>
            {raritySummary.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {raritySummary.map((item) => (
                  <span key={item.rarity} className="rounded-full bg-green-950/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-green-950">
                    {item.rarity} x{item.count}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Filter label="Rarity" value={rarity} onChange={(value) => setRarity(value as Rarity | "all")} options={rarities} />
          <Filter label="Position" value={position} onChange={(value) => setPosition(value as Position | "all")} options={positions} />
          <Filter label="Club" value={club} onChange={setClub} options={clubs} />
        </div>
      </section>

      <section className="rounded-lg border border-green-900/10 bg-[#fbf7ea] p-3 shadow-sm md:p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((player) => (
            <div key={player.id} className="rounded-lg border border-dashed border-green-900/20 bg-white/45 p-2 shadow-inner">
              <PlayerCard player={player} duplicateCount={state?.duplicateCounts[player.id] ?? 0} ratingBoost={state?.ratingBoosts?.[player.id] ?? 0} variant="album" />
            </div>
          ))}
        </div>
      </section>
      {filtered.length === 0 ? (
        <div className="mt-4 rounded-lg border border-green-900/10 bg-[#fbf7ea] p-6 text-center shadow-sm">
          <p className="text-lg font-black text-green-950">{owned.length === 0 ? "Your collection is waiting." : "No cards match those filters."}</p>
          <p className="mt-1 text-sm font-semibold text-green-900/60">
            {owned.length === 0 ? "Log activity or open packs to add your first player cards." : "Try clearing a filter or searching by another position, rarity, or club."}
          </p>
          {owned.length === 0 ? (
            <Link href="/add-km" className="mt-4 inline-flex rounded-md bg-boot px-5 py-3 text-sm font-black text-white hover:bg-red-700">
              Log Activity
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="text-xs font-black uppercase tracking-wide text-green-900/60">
      {label}
      <select className="mt-2 w-full rounded-md border border-green-900/20 bg-white/85 px-3 py-2 text-sm font-bold normal-case tracking-normal text-green-950" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? "All" : option}
          </option>
        ))}
      </select>
    </label>
  );
}
