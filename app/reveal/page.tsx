"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flagUrl } from "@/lib/flags";
import { loadRevealPlayersAsync, loadUserStateAsync } from "@/lib/storage";
import type { Player, UserState } from "@/lib/types";

// 0 = sealed  1 = rating  2 = player  3 = full card
type Stage = 0 | 1 | 2 | 3;

const rarityGlow: Record<Player["rarity"], string> = {
  clowns:    "rgba(248,113,113,0.6)",
  common:    "rgba(148,163,184,0.5)",
  rare:      "rgba(56,189,248,0.55)",
  epic:      "rgba(192,132,252,0.6)",
  legend:    "rgba(251,191,36,0.65)",
  icon:      "rgba(255,255,255,0.7)",
  dangerous: "rgba(239,68,68,0.9)"
};

const rarityGrad: Record<Player["rarity"], string> = {
  clowns:    "from-red-700 via-red-900 to-slate-900",
  common:    "from-slate-700 via-slate-800 to-slate-900",
  rare:      "from-sky-700 via-sky-900 to-slate-900",
  epic:      "from-fuchsia-700 via-purple-900 to-slate-900",
  legend:    "from-amber-500 via-amber-800 to-slate-900",
  icon:      "from-zinc-400 via-zinc-700 to-zinc-950",
  dangerous: "from-red-600 via-red-950 to-black"
};

const rarityLabel: Record<Player["rarity"], string> = {
  clowns:    "Clowns",
  common:    "Common",
  rare:      "Rare",
  epic:      "Epic",
  legend:    "Legend",
  icon:      "Icon",
  dangerous: "Dangerous"
};

export default function RevealPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [state, setState] = useState<UserState | null>(null);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>(0);
  const [showSummary, setShowSummary] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRevealPlayersAsync().then(setPlayers);
    loadUserStateAsync().then(setState);
  }, []);

  const current = players[index];
  const isLast = index >= players.length - 1;
  const isFinal = stage === 3;

  function advance() {
    if (stage < 3) {
      setStage((s) => (s + 1) as Stage);
      setAnimKey((k) => k + 1);
    } else if (!isLast) {
      setIndex((i) => i + 1);
      setStage(0);
      setAnimKey((k) => k + 1);
    } else {
      setShowSummary(true);
    }
  }

  if (players.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-black text-green-950">No rewards waiting.</p>
        <Link className="rounded-md bg-pitch px-6 py-3 font-black text-white hover:bg-green-800" href="/add-km">
          Log activity
        </Link>
      </div>
    );
  }

  if (!current) return null;

  if (showSummary) {
    return <RevealSummary players={players} state={state} />;
  }

  return (
    <div
      ref={containerRef}
      className="flex min-h-[calc(100svh-8rem)] flex-col items-center justify-between gap-4 select-none"
      onClick={isFinal && isLast ? undefined : advance}
    >
      {/* Progress dots */}
      <div className="flex w-full items-center justify-between pt-2">
        <div className="flex gap-1.5">
          {players.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < index ? "w-3 bg-green-950/30" : i === index ? "w-5 bg-pitch" : "w-3 bg-green-950/15"
              }`}
            />
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">
          {index + 1} / {players.length}
        </p>
      </div>

      {/* Card area */}
      <div className="flex flex-1 w-full max-w-sm flex-col items-center justify-center">
        {stage === 0 && <SealedCard key={animKey} />}
        {stage === 1 && <RatingCard key={animKey} player={current} />}
        {stage === 2 && <PlayerNameCard key={animKey} player={current} />}
        {stage === 3 && <FullCard key={animKey} player={current} />}
      </div>

      {/* Tap hint / action */}
      <div className="pb-2 text-center">
        {isFinal && isLast ? (
          <button
            className="inline-flex rounded-md bg-pitch px-6 py-3 font-black text-white hover:bg-green-800"
            onClick={(e) => {
              e.stopPropagation();
              setShowSummary(true);
            }}
          >
            View summary
          </button>
        ) : (
          <p className="animate-pulse text-xs font-bold uppercase tracking-widest text-green-900/40">
            {stage === 0 ? "Tap to open" : stage === 3 ? "Tap for next card" : "Tap to reveal"}
          </p>
        )}
      </div>
    </div>
  );
}

function RevealSummary({ players, state }: { players: Player[]; state: UserState | null }) {
  const best = [...players].sort((a, b) => b.rating - a.rating)[0];
  const rarityCounts = players.reduce<Record<Player["rarity"], number>>((acc, player) => {
    acc[player.rarity] = (acc[player.rarity] ?? 0) + 1;
    return acc;
  }, {} as Record<Player["rarity"], number>);
  const duplicateTotal = state
    ? players.filter((player) => (state.duplicateCounts[player.id] ?? 0) > 0).length
    : 0;
  const newTotal = Math.max(0, players.length - duplicateTotal);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center">
      <section className="rounded-lg border border-green-900/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">Opening Summary</p>
        <h1 className="mt-1 text-3xl font-black text-green-950">{players.length} sticker{players.length === 1 ? "" : "s"} revealed</h1>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryStat label="New Stickers" value={String(newTotal)} />
          <SummaryStat label="Duplicates" value={String(duplicateTotal)} />
          <SummaryStat label="Best Pull" value={best ? `${best.rating} ${best.name}` : "--"} />
        </div>

        <div className="mt-5 rounded-lg bg-green-950/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">Rarity Breakdown</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(rarityLabel).map(([rarity, label]) => {
              const count = rarityCounts[rarity as Player["rarity"]] ?? 0;
              if (count === 0) return null;
              return (
                <span key={rarity} className="rounded-md bg-white px-3 py-2 text-sm font-black text-green-950 shadow-sm">
                  {label}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {best ? (
          <div className="mt-5 rounded-lg border border-green-900/10 bg-green-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">Best Pull</p>
            <p className="mt-1 text-xl font-black text-green-950">{best.name}</p>
            <p className="text-sm font-bold text-green-900/70">{best.rating} {rarityLabel[best.rarity]} - {best.nation} - {best.club}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-md bg-pitch px-5 py-3 font-black text-white hover:bg-green-800" href="/collection">
            Go to collection
          </Link>
          <Link className="rounded-md bg-green-950/10 px-5 py-3 font-black text-green-950 hover:bg-green-950/15" href="/squad">
            Update squad
          </Link>
        </div>
      </section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-green-950/5 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-green-900/50">{label}</p>
      <p className="mt-1 break-words text-lg font-black text-green-950">{value}</p>
    </div>
  );
}

function SealedCard() {
  return (
    <div className="animate-reveal-scale-in w-full rounded-2xl bg-gradient-to-br from-green-900 via-pitch to-green-950 p-1 shadow-2xl">
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 gap-6 p-8">
        <p className="text-xs font-black uppercase tracking-[0.4em] text-green-100/50">KMXI</p>
        <div className="animate-reveal-shake flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/20 bg-white/10 text-5xl font-black text-white/60">
          ?
        </div>
        <p className="text-sm font-bold text-green-50/50">Your card is waiting…</p>
      </div>
    </div>
  );
}

function RatingCard({ player }: { player: Player }) {
  const glow = rarityGlow[player.rarity];
  const grad = rarityGrad[player.rarity];

  return (
    <div
      className={`animate-reveal-scale-in w-full rounded-2xl bg-gradient-to-br ${grad} p-1 shadow-2xl animate-reveal-glow`}
      style={{ "--glow-color": glow } as React.CSSProperties}
    >
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-white/10 bg-black/20 gap-4 p-8">
        <p className="animate-reveal-slide-up text-xs font-black uppercase tracking-[0.4em] text-white/50" style={{ animationDelay: "0.1s" }}>
          {rarityLabel[player.rarity]}
        </p>
        <p className="animate-reveal-pop text-[96px] font-black leading-none text-white" style={{ animationDelay: "0.15s" }}>
          {player.rating}
        </p>
        <p className="animate-reveal-slide-up rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-black text-white/70" style={{ animationDelay: "0.25s" }}>
          {player.pos}
        </p>
      </div>
    </div>
  );
}

function PlayerNameCard({ player }: { player: Player }) {
  const glow = rarityGlow[player.rarity];
  const grad = rarityGrad[player.rarity];
  const flag = flagUrl(player.nation);

  return (
    <div
      className={`animate-reveal-scale-in w-full rounded-2xl bg-gradient-to-br ${grad} p-1 shadow-2xl animate-reveal-glow`}
      style={{ "--glow-color": glow } as React.CSSProperties}
    >
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-white/10 bg-black/20 gap-5 p-8 text-center">
        <div className="animate-reveal-slide-up flex items-center gap-3" style={{ animationDelay: "0.05s" }}>
          {flag && <img src={flag} alt={player.nation} className="h-7 w-10 rounded object-cover shadow" />}
          <p className="text-sm font-bold uppercase tracking-wide text-white/60">{player.nation}</p>
        </div>
        <p className="animate-reveal-pop text-4xl font-black leading-tight text-white" style={{ animationDelay: "0.1s" }}>
          {player.name}
        </p>
        <p className="animate-reveal-slide-up text-base font-bold text-white/60" style={{ animationDelay: "0.2s" }}>
          {player.club}
        </p>
        <div className="animate-reveal-slide-up flex items-center gap-3" style={{ animationDelay: "0.28s" }}>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-black text-white/70">{player.pos}</span>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-black text-white">{player.rating}</span>
        </div>
      </div>
    </div>
  );
}

function FullCard({ player }: { player: Player }) {
  const glow = rarityGlow[player.rarity];
  const grad = rarityGrad[player.rarity];
  const flag = flagUrl(player.nation);

  return (
    <div
      className={`animate-reveal-pop w-full rounded-2xl bg-gradient-to-br ${grad} p-1 shadow-2xl animate-reveal-glow`}
      style={{ "--glow-color": glow } as React.CSSProperties}
    >
      <div className="flex min-h-[420px] flex-col rounded-xl border border-white/10 bg-black/20 p-5 gap-4">
        <div className="flex justify-center">
          <span className="rounded-full border border-white/20 bg-white/15 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
            New signing
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{rarityLabel[player.rarity]}</p>
            <p className="mt-0.5 text-2xl font-black leading-tight text-white">{player.name}</p>
          </div>
          <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-center border border-white/10">
            <p className="text-3xl font-black leading-none text-white">{player.rating}</p>
            <p className="mt-0.5 text-xs font-black text-white/60">{player.pos}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CardDetail label="Nation" flag={flag} value={player.nation} />
          <CardDetail label="Club" value={player.club} href={player.clubWiki} />
          <CardDetail label="DOB" value={player.dob} />
          <CardDetail label="Caps" value={player.caps !== null ? String(player.caps) : "Unknown"} />
          <CardDetail label="Goals" value={player.goals !== null ? String(player.goals) : "Unknown"} />
          {player.wiki && (
            <a
              href={player.wiki}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center rounded-lg bg-white/10 px-2 py-2 text-xs font-black text-white/70 hover:bg-white/15"
              onClick={(e) => e.stopPropagation()}
            >
              Wikipedia ↗
            </a>
          )}
        </div>
        <div className="mt-auto rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Added to collection</p>
          <p className="mt-0.5 text-xs font-bold text-white/75">{player.nation} · {player.club}</p>
        </div>
      </div>
    </div>
  );
}

function CardDetail({ label, value, href, flag }: { label: string; value: string; href?: string | null; flag?: string | null }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/40">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        {flag && <img src={flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />}
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="truncate text-xs font-bold text-white/80 underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
            {value}
          </a>
        ) : (
          <p className="truncate text-xs font-bold text-white/80">{value}</p>
        )}
      </div>
    </div>
  );
}
