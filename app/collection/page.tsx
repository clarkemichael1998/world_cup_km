"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { PageTitle } from "@/components/PageTitle";
import { flagUrl } from "@/lib/flags";
import { allPlayers } from "@/lib/rewardEngine";
import { getOwnedPlayers } from "@/lib/squadUtils";
import { loadUserStateAsync } from "@/lib/storage";
import type { Player, Position, Rarity, UserState } from "@/lib/types";

const rarities: Array<Rarity | "all"> = ["all", "clowns", "common", "rare", "epic", "legend", "icon"];
const positions: Array<Position | "all"> = ["all", "GK", "DF", "MF", "FW"];

export default function CollectionPage() {
  const [state, setState] = useState<UserState | null>(null);
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [position, setPosition] = useState<Position | "all">("all");
  const [club, setClub] = useState("all");
  const [nation, setNation] = useState("Argentina");

  useEffect(() => {
    loadUserStateAsync().then(setState);
  }, []);

  const nations = useMemo(() => Array.from(new Set(allPlayers.map((player) => player.nation))).sort(), []);
  const countryPlayers = useMemo(
    () => allPlayers.filter((player) => player.nation === nation).sort((a, b) => positionRank(a.pos) - positionRank(b.pos) || b.rating - a.rating || a.name.localeCompare(b.name)),
    [nation]
  );
  const clubs = useMemo(() => ["all", ...Array.from(new Set(countryPlayers.map((player) => player.club))).sort()], [countryPlayers]);
  const owned = state ? getOwnedPlayers(state) : [];
  const ownedIds = new Set(owned.map((player) => player.id));
  const visiblePlayers = countryPlayers.filter((player) => {
    return (
      (rarity === "all" || player.rarity === rarity) &&
      (position === "all" || player.pos === position) &&
      (club === "all" || player.club === club)
    );
  });
  const collectedOnPage = countryPlayers.filter((player) => ownedIds.has(player.id)).length;
  const visibleCollected = visiblePlayers.filter((player) => ownedIds.has(player.id)).length;
  const raritySummary = rarities
    .filter((item): item is Rarity => item !== "all")
    .map((item) => ({ rarity: item, count: countryPlayers.filter((player) => player.rarity === item && ownedIds.has(player.id)).length }))
    .filter((item) => item.count > 0);
  const albumCode = `KMXI-${nation.slice(0, 3).toUpperCase()}-${String(collectedOnPage).padStart(2, "0")}`;
  const activeFilters = [rarity !== "all" ? rarity : null, position !== "all" ? position : null, club !== "all" ? club : null].filter(Boolean);
  const selectedFlag = flagUrl(nation);

  return (
    <div>
      <PageTitle title="Sticker Album" subtitle={`${owned.length} official KMXI sticker${owned.length === 1 ? "" : "s"} placed in your World Cup 2026 album.`} />

      <section className="mb-5 rounded-lg border border-green-900/10 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-green-900/45">Country Pages</p>
            <p className="text-sm font-bold text-green-950">Pick a nation to browse its full sticker page.</p>
          </div>
          <p className="rounded-md bg-green-950/5 px-2 py-1 text-xs font-black text-green-950">{nations.length} nations</p>
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {nations.map((item) => {
            const complete = allPlayers.filter((player) => player.nation === item && ownedIds.has(player.id)).length;
            const total = allPlayers.filter((player) => player.nation === item).length;
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setNation(item);
                  setClub("all");
                }}
                className={`shrink-0 rounded-md border px-3 py-2 text-left transition ${
                  nation === item ? "border-pitch bg-pitch text-white shadow-sm" : "border-green-900/10 bg-green-950/5 text-green-950 hover:bg-green-950/10"
                }`}
              >
                <span className="block text-xs font-black">{item}</span>
                <span className={`mt-0.5 block text-[10px] font-bold ${nation === item ? "text-green-50/75" : "text-green-900/50"}`}>{complete}/{total}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="album-paper relative mb-5 overflow-hidden rounded-lg border border-green-900/10 bg-[#fbf7ea] shadow-sm">
        <div className="pointer-events-none absolute bottom-0 left-8 top-0 hidden w-px bg-green-950/10 sm:block" />
        <div className="pointer-events-none absolute bottom-0 left-10 top-0 hidden w-px bg-white/70 sm:block" />

        <div className="relative border-b border-green-900/10 bg-white/60 p-4 sm:pl-16">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-green-900/45">Album Page {albumCode}</p>
              <div className="mt-1 flex items-center gap-3">
                {selectedFlag ? <img src={selectedFlag} alt={`${nation} flag`} className="h-8 w-12 rounded object-cover shadow-sm" /> : null}
                <h2 className="text-2xl font-black text-green-950">{nation}</h2>
              </div>
              <p className="mt-1 text-sm font-bold text-green-900/55">
                {collectedOnPage}/{countryPlayers.length} stickers collected. {visiblePlayers.length} spaces showing{activeFilters.length > 0 ? ` - filtered by ${activeFilters.join(", ")}` : " - full country page"}.
              </p>
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

        <div className="relative grid gap-3 p-4 sm:pl-16 md:grid-cols-3">
          <Filter label="Rarity" value={rarity} onChange={(value) => setRarity(value as Rarity | "all")} options={rarities} />
          <Filter label="Position" value={position} onChange={(value) => setPosition(value as Position | "all")} options={positions} />
          <Filter label="Club" value={club} onChange={setClub} options={clubs} />
        </div>
      </section>

      <section className="album-paper relative rounded-lg border border-green-900/10 bg-[#fbf7ea] p-3 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-green-900/10 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-green-900/40">Page Spread</p>
            <p className="text-sm font-black text-green-950">{nation} sticker spaces</p>
          </div>
          <div className="rounded-md border border-green-900/10 bg-white/60 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-green-900/50">
            {visibleCollected}/{visiblePlayers.length} filled
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visiblePlayers.map((player) => (
            <div key={player.id} className="sticker-slot rounded-lg border border-dashed border-green-900/20 bg-white/45 p-2 shadow-inner">
              <div className="mb-2 flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-wide text-green-900/35">
                <span>{player.nation}</span>
                <span>{player.pos}</span>
              </div>
              {ownedIds.has(player.id) ? (
                <PlayerCard player={player} duplicateCount={state?.duplicateCounts[player.id] ?? 0} ratingBoost={state?.ratingBoosts?.[player.id] ?? 0} variant="album" />
              ) : (
                <EmptyStickerSlot player={player} />
              )}
            </div>
          ))}
        </div>
      </section>
      {visiblePlayers.length === 0 ? (
        <div className="mt-4 rounded-lg border border-green-900/10 bg-[#fbf7ea] p-6 text-center shadow-sm">
          <p className="text-lg font-black text-green-950">{owned.length === 0 ? "Your album is waiting." : "No sticker spaces match those filters."}</p>
          <p className="mt-1 text-sm font-semibold text-green-900/60">
            {owned.length === 0 ? "Log activity or open packs to add your first player stickers." : "Try clearing a filter or choosing another country page."}
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

function EmptyStickerSlot({ player }: { player: Player }) {
  const flag = flagUrl(player.nation);

  return (
    <div className="sticker-missing flex min-h-64 flex-col rounded-lg border-2 border-dashed border-green-900/20 bg-white/35 p-4 text-green-950/45">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-green-900/10 pb-2">
        <span className="text-[9px] font-black uppercase tracking-[0.22em]">Empty Sticker Space</span>
        <span className="rounded-sm bg-green-950/5 px-1.5 py-0.5 text-[9px] font-black tabular-nums">#{player.id}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {flag ? <img src={flag} alt="" className="mb-4 h-8 w-12 rounded object-cover opacity-35 grayscale" /> : null}
        <p className="text-xs font-black uppercase tracking-wide">Missing sticker</p>
        <p className="mt-2 text-lg font-black leading-tight text-green-950/55">{player.name}</p>
        <p className="mt-1 text-xs font-bold text-green-900/45">{player.pos} - {player.club}</p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-green-900/10 pt-2 text-[9px] font-black uppercase tracking-wide">
        <span>KMXI 2026</span>
        <span>{player.teamId}</span>
      </div>
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

function positionRank(position: Position) {
  return positions.indexOf(position);
}
