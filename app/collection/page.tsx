"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";
import { PageTitle } from "@/components/PageTitle";
import { flagUrl } from "@/lib/flags";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import { getOwnedPlayers } from "@/lib/squadUtils";
import { loadUserStateAsync } from "@/lib/storage";
import type { Player, Position, Rarity, UserState } from "@/lib/types";

const positions: Array<Position | "all"> = ["all", "GK", "DF", "MF", "FW"];

export default function CollectionPage() {
  const [state, setState] = useState<UserState | null>(null);
  const [nation, setNation] = useState("Argentina");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [nationSort, setNationSort] = useState<"alpha" | "closest">("closest");
  const [playerPool, setPlayerPool] = useState<Player[]>(basePlayerPool);
  const [exchanging, setExchanging] = useState(false);
  const [exchangeNotice, setExchangeNotice] = useState("");

  useEffect(() => {
    loadUserStateAsync().then(setState);
    loadPlayerPool().then(setPlayerPool);
  }, []);

  async function exchangeDuplicates() {
    if (exchanging) return;
    setExchanging(true);
    setExchangeNotice("");
    try {
      const response = await fetch("/api/exchange", { method: "POST", credentials: "include" });
      const payload = await response.json();
      if (!response.ok) {
        setExchangeNotice(payload.error ?? "Exchange failed.");
        return;
      }
      setExchangeNotice(`Swapped ${payload.duplicatesSpent} duplicates for ${payload.creditsGained} pack credit${payload.creditsGained === 1 ? "" : "s"}!`);
      const refreshed = await loadUserStateAsync();
      setState(refreshed);
    } finally {
      setExchanging(false);
    }
  }

  const nations = useMemo(() => Array.from(new Set(playerPool.map((player) => player.nation))).sort(), [playerPool]);
  const countryPlayers = useMemo(
    () => playerPool.filter((player) => player.nation === nation).sort((a, b) => positionRank(a.pos) - positionRank(b.pos) || b.rating - a.rating || a.name.localeCompare(b.name)),
    [nation, playerPool]
  );
  const owned = state ? getOwnedPlayers(state, playerPool) : [];
  const ownedIds = new Set(owned.map((player) => player.id));
  const nationProgress = nations.map((item) => {
    const total = playerPool.filter((player) => player.nation === item).length;
    const complete = playerPool.filter((player) => player.nation === item && ownedIds.has(player.id)).length;
    return { nation: item, total, complete, percent: total ? Math.round((complete / total) * 100) : 0 };
  });
  const sortedNationProgress = [...nationProgress].sort((a, b) => {
    if (nationSort === "alpha") return a.nation.localeCompare(b.nation);
    const aDone = a.complete === a.total;
    const bDone = b.complete === b.total;
    if (aDone !== bDone) return aDone ? 1 : -1;
    return b.percent - a.percent || a.total - a.complete - (b.total - b.complete) || a.nation.localeCompare(b.nation);
  });
  const closestIncomplete = sortedNationProgress.find((item) => item.complete > 0 && item.complete < item.total);
  const collectedOnPage = countryPlayers.filter((player) => ownedIds.has(player.id)).length;
  const raritySummary = (["clowns", "common", "rare", "epic", "legend", "icon"] as Rarity[])
    .map((item) => ({ rarity: item, count: countryPlayers.filter((player) => player.rarity === item && ownedIds.has(player.id)).length }))
    .filter((item) => item.count > 0);
  const albumCode = `KMXI-${nation.slice(0, 3).toUpperCase()}-${String(collectedOnPage).padStart(2, "0")}`;
  const selectedFlag = flagUrl(nation);
  const totalDuplicates = state ? Object.values(state.duplicateCounts).reduce((sum, count) => sum + (count ?? 0), 0) : 0;
  const exchangeableCredits = Math.floor(totalDuplicates / 3);

  return (
    <div>
      <PageTitle title="Sticker Album" subtitle={`${owned.length} official KMXI sticker${owned.length === 1 ? "" : "s"} placed in your World Cup 2026 album.`} />

      {totalDuplicates > 0 ? (
        <section className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-amber-800">Duplicate Exchange</p>
              <p className="mt-1 text-sm font-bold text-amber-900">
                You have {totalDuplicates} duplicate{totalDuplicates === 1 ? "" : "s"}. 3 duplicates = 1 pack credit.
                {exchangeableCredits === 0 ? ` ${3 - totalDuplicates} more to your first swap.` : ""}
              </p>
              {exchangeNotice ? <p className="mt-1 text-xs font-black text-amber-800">{exchangeNotice}</p> : null}
            </div>
            <button
              onClick={exchangeDuplicates}
              disabled={exchanging || exchangeableCredits === 0}
              className="rounded-md bg-amber-600 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {exchanging ? "Swapping..." : exchangeableCredits > 0 ? `Swap ${exchangeableCredits * 3} dupes → ${exchangeableCredits} credit${exchangeableCredits === 1 ? "" : "s"}` : "Not enough dupes yet"}
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-amber-700">Lowest-rarity duplicates are spent first — your Icon dupes are safe until the end.</p>
        </section>
      ) : null}

      <section className="mb-5 rounded-lg border border-green-900/10 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-green-900/45">Country Pages</p>
            <p className="text-sm font-bold text-green-950">
              {closestIncomplete ? `${closestIncomplete.nation} is closest: ${closestIncomplete.complete}/${closestIncomplete.total} (${closestIncomplete.percent}%).` : "Pick a nation to browse its full sticker page."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setNationSort("closest")} className={`rounded-md px-2 py-1 text-xs font-black ${nationSort === "closest" ? "bg-pitch text-white" : "bg-green-950/5 text-green-950"}`}>Closest</button>
            <button onClick={() => setNationSort("alpha")} className={`rounded-md px-2 py-1 text-xs font-black ${nationSort === "alpha" ? "bg-pitch text-white" : "bg-green-950/5 text-green-950"}`}>A-Z</button>
          </div>
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {sortedNationProgress.map((item) => {
            return (
              <button
                key={item.nation}
                type="button"
                onClick={() => {
                  setNation(item.nation);
                  setSelectedPlayer(null);
                }}
                className={`shrink-0 rounded-md border px-3 py-2 text-left transition ${
                  nation === item.nation ? "border-pitch bg-pitch text-white shadow-sm" : "border-green-900/10 bg-green-950/5 text-green-950 hover:bg-green-950/10"
                }`}
              >
                <span className="block text-xs font-black">{item.nation}</span>
                <span className={`mt-0.5 block text-[10px] font-bold ${nation === item.nation ? "text-green-50/75" : "text-green-900/50"}`}>{item.complete}/{item.total} · {item.percent}%</span>
                <span className={`mt-1 block h-1.5 w-full overflow-hidden rounded-full ${nation === item.nation ? "bg-white/25" : "bg-green-950/10"}`}>
                  <span className={`block h-full rounded-full ${nation === item.nation ? "bg-white" : "bg-pitch"}`} style={{ width: `${item.percent}%` }} />
                </span>
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
                {collectedOnPage}/{countryPlayers.length} stickers collected.
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

      </section>

      <section className="album-paper relative rounded-lg border border-green-900/10 bg-[#fbf7ea] p-3 shadow-sm md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-green-900/10 pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-green-900/40">Page Spread</p>
            <p className="text-sm font-black text-green-950">{nation} sticker spaces</p>
          </div>
          <div className="rounded-md border border-green-900/10 bg-white/60 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-green-900/50">
            {collectedOnPage}/{countryPlayers.length} filled
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
          {countryPlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => setSelectedPlayer(player)}
              className="sticker-slot group rounded-md border border-dashed border-green-900/20 bg-white/45 p-1.5 text-left shadow-inner transition hover:-translate-y-0.5 hover:border-pitch hover:bg-white/70 hover:shadow-sm"
            >
              {ownedIds.has(player.id) ? (
                <CompactSticker player={player} ratingBoost={state?.ratingBoosts?.[player.id] ?? 0} duplicateCount={state?.duplicateCounts[player.id] ?? 0} />
              ) : (
                <EmptyStickerSlot player={player} compact />
              )}
            </button>
          ))}
        </div>
      </section>
      {owned.length === 0 ? (
        <div className="mt-4 rounded-lg border border-green-900/10 bg-[#fbf7ea] p-6 text-center shadow-sm">
          <p className="text-lg font-black text-green-950">Your album is waiting.</p>
          <p className="mt-1 text-sm font-semibold text-green-900/60">Log activity or open packs to add your first player stickers.</p>
          <Link href="/add-km" className="mt-4 inline-flex rounded-md bg-boot px-5 py-3 text-sm font-black text-white hover:bg-red-700">
            Log Activity
          </Link>
        </div>
      ) : null}

      {selectedPlayer ? (
        <StickerDetails
          player={selectedPlayer}
          owned={ownedIds.has(selectedPlayer.id)}
          duplicateCount={state?.duplicateCounts[selectedPlayer.id] ?? 0}
          ratingBoost={state?.ratingBoosts?.[selectedPlayer.id] ?? 0}
          onClose={() => setSelectedPlayer(null)}
        />
      ) : null}
    </div>
  );
}

function CompactSticker({ player, ratingBoost, duplicateCount }: { player: Player; ratingBoost: number; duplicateCount: number }) {
  const flag = flagUrl(player.nation);
  const effectiveRating = player.rating + ratingBoost;
  const rarityLabel = rarityLabels[player.rarity];
  const rarityMark = rarityMarks[player.rarity];

  return (
    <div className={`compact-sticker ${rarityCardClasses[player.rarity]} flex aspect-[3/4] min-h-32 flex-col rounded-md border-2 p-2 shadow-sm ring-1 ring-green-950/10`}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="rounded bg-black/10 px-1 text-[9px] font-black uppercase">{player.pos}</span>
        <span className="compact-sticker-rating rounded px-1.5 py-0.5 text-[10px] font-black">{effectiveRating}</span>
      </div>
      <div className="mb-1 flex items-center justify-between gap-1 text-[7px] font-black uppercase tracking-wide opacity-70">
        <span>{rarityLabel}</span>
        <span className="compact-sticker-mark inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[8px]">{rarityMark}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {flag ? <img src={flag} alt="" className="mb-1 h-4 w-6 rounded-sm object-cover shadow-sm" /> : null}
        <p className="line-clamp-3 text-[11px] font-black leading-tight">{player.name}</p>
        <p className="mt-1 line-clamp-1 text-[9px] font-bold opacity-65">{player.club}</p>
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-current/15 pt-1 text-[8px] font-black uppercase tracking-wide opacity-55">
        <span>{player.rarity}</span>
        <span>{duplicateCount > 0 ? `x${duplicateCount + 1}` : `#${player.id}`}</span>
      </div>
    </div>
  );
}

function EmptyStickerSlot({ player, compact = false }: { player: Player; compact?: boolean }) {
  const flag = flagUrl(player.nation);

  if (compact) {
    return (
      <div className="sticker-missing flex aspect-[3/4] min-h-32 flex-col rounded-md border-2 border-dashed border-green-900/20 bg-white/35 p-2 text-green-950/45">
        <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wide">
          <span>{player.pos}</span>
          <span>#{player.id}</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {flag ? <img src={flag} alt="" className="mb-2 h-4 w-6 rounded-sm object-cover opacity-35 grayscale" /> : null}
          <p className="text-[9px] font-black uppercase tracking-wide">Missing</p>
          <p className="mt-1 line-clamp-3 text-[11px] font-black leading-tight text-green-950/50">{player.name}</p>
        </div>
      </div>
    );
  }

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

function StickerDetails({
  player,
  owned,
  duplicateCount,
  ratingBoost,
  onClose
}: {
  player: Player;
  owned: boolean;
  duplicateCount: number;
  ratingBoost: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-green-950/50 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-lg bg-[#fbf7ea] p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-green-900/45">Sticker Details</p>
            <p className="text-sm font-bold text-green-950">{owned ? "Collected" : "Still missing from your album"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md bg-green-950/10 px-3 py-1.5 text-sm font-black text-green-950 hover:bg-green-950/15">
            Close
          </button>
        </div>

        {owned ? (
          <PlayerCard player={player} duplicateCount={duplicateCount} ratingBoost={ratingBoost} variant="album" large />
        ) : (
          <EmptyStickerSlot player={player} />
        )}
      </div>
    </div>
  );
}

function positionRank(position: Position) {
  return positions.indexOf(position);
}

const rarityCardClasses: Record<Player["rarity"], string> = {
  clowns: "sticker-clowns",
  common: "sticker-common",
  rare: "sticker-rare",
  epic: "sticker-epic",
  legend: "sticker-legend",
  icon: "sticker-icon"
};

const rarityLabels: Record<Player["rarity"], string> = {
  clowns: "Clowns",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legend: "Legend",
  icon: "Icon"
};

const rarityMarks: Record<Player["rarity"], string> = {
  clowns: "!",
  common: "K",
  rare: "*",
  epic: "◆",
  legend: "★",
  icon: "XI"
};
