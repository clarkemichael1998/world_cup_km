"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { buttonClasses } from "@/components/Button";
import { PageTitle } from "@/components/PageTitle";
import { autoPickBestXI, calculateSquadRating, canPlaySlot, getOwnedPlayers, getPlayer, slotAllowedPositions, squadSlots } from "@/lib/squadUtils";
import { loadUserStateAsync, saveUserState } from "@/lib/storage";
import { flagUrl } from "@/lib/flags";
import { basePlayerPool, loadPlayerPool } from "@/lib/playerPool";
import type { Player, Position, SquadSlot, UserState } from "@/lib/types";

type LockStatus = {
  lockDate: string;
  lockAt: string;
  unlockAt: string;
  isLocked: boolean;
  lockedPlayers: Array<{ slot: string; player: { id: number; name: string; nation: string; rating: number } }>;
  upcomingFixtures: Array<{ matchId: string; homeTeam: string; awayTeam: string; kickoffAt: string; status: string; winner: string | null }>;
};

const formationRows: Array<{ label: string; slots: SquadSlot[] }> = [
  { label: "FW", slots: ["FW1", "FW2", "FW3"] },
  { label: "MF", slots: ["MF1", "MF2", "MF3"] },
  { label: "DF", slots: ["DF1", "DF2", "DF3", "DF4"] },
  { label: "GK", slots: ["GK"] }
];

const positionOrder: Position[] = ["GK", "DF", "MF", "FW"];

export default function SquadPage() {
  const [state, setState] = useState<UserState | null>(null);
  const [activeSlot, setActiveSlot] = useState<SquadSlot | null>(null);
  const [query, setQuery] = useState("");
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockNotice, setLockNotice] = useState("");
  const [lockExpanded, setLockExpanded] = useState(false);
  const [playerPool, setPlayerPool] = useState<Player[]>(basePlayerPool);

  useEffect(() => {
    loadUserStateAsync().then((loaded) => {
      setState(loaded);
      syncDraftSquad(loaded.squad);
    });
    loadPlayerPool().then(setPlayerPool);
    loadLockStatus();
  }, []);

  async function loadLockStatus() {
    try {
      const r = await fetch("/api/squad/lock", { credentials: "include" });
      if (r.ok) setLockStatus(await r.json());
    } catch { /* not logged in */ }
  }

  async function toggleLock() {
    if (!lockStatus) return;
    setLockBusy(true);
    try {
      const method = lockStatus.isLocked ? "DELETE" : "POST";
      const r = await fetch("/api/squad/lock", { method, credentials: "include" });
      if (r.ok) {
        const payload = (await r.json().catch(() => ({}))) as { message?: string };
        setLockNotice(payload.message ?? (method === "POST" ? "Your XI is locked." : "Your XI is unlocked."));
        await loadLockStatus();
      }
    } finally {
      setLockBusy(false);
    }
  }

  function updateSlot(slot: SquadSlot, playerId?: number) {
    if (!state) return;
    const squad = { ...state.squad };
    if (playerId) { squad[slot] = playerId; } else { delete squad[slot]; }
    const updated = { ...state, squad };
    setState(updated);
    saveUserState(updated);
    syncDraftSquad(squad);
  }

  function autoPick() {
    if (!state) return;
    const updated = autoPickBestXI(state, playerPool);
    setState(updated);
    saveUserState(updated);
    syncDraftSquad(updated.squad);
  }

  function autoPickPlayingToday() {
    if (!state || !lockStatus) return;
    const playingNations = getFixtureNations(lockStatus);
    if (playingNations.size === 0) {
      setLockNotice(`No fixtures listed for ${lockStatus.lockDate}, so there are no playing nations to auto-pick from.`);
      return;
    }
    const updated = autoPickBestXIFromNations(state, playingNations, playerPool);
    setState(updated);
    saveUserState(updated);
    syncDraftSquad(updated.squad);
    const playingCount = Object.values(updated.squad).filter((id) => {
      const player = getPlayer(id, playerPool);
      return player && playingNations.has(player.nation);
    }).length;
    const selectedCount = Object.keys(updated.squad).length;
    setLockNotice(`Prioritised ${playingCount} player${playingCount === 1 ? "" : "s"} from nations playing on ${lockStatus.lockDate}, then filled the rest of your best XI (${selectedCount}/11).`);
  }

  const owned = state ? getOwnedPlayers(state, playerPool) : [];
  const rating = state ? calculateSquadRating(state, playerPool) : 0;
  const playingNations = lockStatus ? getFixtureNations(lockStatus) : new Set<string>();
  const selectedIds = new Set(Object.values(state?.squad ?? {}));
  const selectedPlayers = squadSlots.map((slot) => getPlayer(state?.squad[slot], playerPool)).filter((player): player is Player => Boolean(player));
  const selectedPlayingCount = selectedPlayers.filter((player) => playingNations.has(player.nation)).length;
  const selectedBenchRisks = selectedPlayers.length - selectedPlayingCount;
  const coveredFixtures = lockStatus
    ? lockStatus.upcomingFixtures.filter((fixture) => selectedPlayers.some((player) => player.nation === fixture.homeTeam || player.nation === fixture.awayTeam)).length
    : 0;
  const activePosition = activeSlot ? slotAllowedPositions(activeSlot)[0] : null;
  const activePlayer = activeSlot ? getPlayer(state?.squad[activeSlot], playerPool) : undefined;
  const positionCounts = positionOrder.map((position) => ({
    position,
    selected: selectedPlayers.filter((player) => player.pos === position).length,
    owned: owned.filter((player) => player.pos === position).length
  }));
  const benchPlayers = useMemo(() => {
    if (!activeSlot) return [];
    const normalized = query.trim().toLowerCase();
    return owned
      .filter((player) => {
        const isCurrentSelection = player.id === activePlayer?.id;
        const matchesSlot = canPlaySlot(player, activeSlot) || isCurrentSelection;
        const isAvailable = !selectedIds.has(player.id) || isCurrentSelection;
        const matchesQuery = !normalized || `${player.name} ${player.nation} ${player.club}`.toLowerCase().includes(normalized);
        return matchesSlot && isAvailable && matchesQuery;
      })
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  }, [activePlayer?.id, activeSlot, owned, query, selectedIds]);

  return (
    <div>
      <PageTitle
        title="Build Your XI"
        subtitle={`4-3-3 formation · ${selectedPlayers.length}/11 selected${rating ? ` · ${rating.toFixed(1)} avg rating` : ""}`}
      />

      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={autoPick}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-black text-white/85 transition hover:bg-white/15"
          >
            Auto-pick Best XI
          </button>
          <button
            onClick={autoPickPlayingToday}
            disabled={!lockStatus || lockStatus.upcomingFixtures.length === 0}
            title={!lockStatus || lockStatus.upcomingFixtures.length === 0 ? "No fixtures loaded for the lock date." : "Pick the best XI from nations playing on the lock date."}
            className="rounded-lg bg-amber-400/15 px-4 py-2 text-sm font-black text-amber-300 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Auto-pick Playing Today
          </button>
        </div>
        <Link href="/matchday-guide" className={buttonClasses("outline", "md")}>
          Matchday Guide
        </Link>
      </div>

      {/* Lock panel */}
      {lockStatus ? (
        <section className={`mb-4 overflow-hidden rounded-xl border shadow-sm transition-colors ${lockStatus.isLocked ? "border-amber-400/30 bg-amber-950/20" : "border-white/10 bg-white/6"}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <Badge tone={lockStatus.isLocked ? "amber" : "green"} className="shrink-0">
              {lockStatus.isLocked ? "🔒 Locked" : "Unlocked"}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">
                Lock deadline{" "}
                <span className={lockStatus.isLocked ? "text-amber-300" : "text-amber-400"}>
                  {new Date(lockStatus.lockAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
                </span>
              </p>
              <p className="mt-0.5 text-xs font-semibold text-white/45">
                {selectedPlayingCount}/{selectedPlayers.length || 11} playing · {coveredFixtures}/{lockStatus.upcomingFixtures.length} fixtures covered
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleLock}
                disabled={lockBusy}
                className={`rounded-lg px-4 py-1.5 text-xs font-black text-white transition disabled:opacity-50 ${lockStatus.isLocked ? "bg-amber-600 hover:bg-amber-700" : "bg-pitch hover:bg-green-800"}`}
              >
                {lockBusy ? "…" : lockStatus.isLocked ? "Unlock" : "Lock XI"}
              </button>
              <button
                onClick={() => setLockExpanded((v) => !v)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-black text-white/45 transition hover:bg-white/8 hover:text-white/70"
                aria-expanded={lockExpanded}
              >
                {lockExpanded ? "▲" : "▼"}
              </button>
            </div>
          </div>

          {lockExpanded ? (
            <div className="border-t border-white/8 px-4 pb-4 pt-3">
              {lockNotice ? (
                <div className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20">{lockNotice}</div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <LockStat label="Playing today" value={`${selectedPlayingCount}/${selectedPlayers.length || 11}`} />
                <LockStat label="Bench risks" value={String(selectedBenchRisks)} />
                <LockStat label="Fixtures covered" value={`${coveredFixtures}/${lockStatus.upcomingFixtures.length}`} />
              </div>

              {lockStatus.upcomingFixtures.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/35">Fixtures · {lockStatus.lockDate}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lockStatus.upcomingFixtures.map((f) => (
                      <div
                        key={f.matchId}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ring-1 ${
                          f.winner ? "bg-green-500/10 text-green-200 ring-green-500/20" : "bg-white/6 text-white/70 ring-white/10"
                        }`}
                      >
                        {f.homeTeam} v {f.awayTeam}
                        {f.winner ? <span className="ml-1 font-black text-green-300">— {f.winner}</span> : null}
                        {f.status === "FINISHED" && !f.winner ? <span className="ml-1 text-white/40">draw</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs font-semibold text-white/40">No fixtures listed for {lockStatus.lockDate} yet.</p>
              )}

              {lockStatus.isLocked && lockStatus.lockedPlayers.length > 0 ? (
                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/35">Locked XI</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lockStatus.lockedPlayers.map(({ slot, player }) => (
                      <span key={slot} className="rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 ring-1 ring-amber-400/20">
                        {player.name} <span className="text-amber-300/60">{player.nation}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Pitch + player picker */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Pitch */}
        <div className="rounded-xl bg-gradient-to-b from-emerald-700 via-pitch to-green-900 p-3 text-white shadow-md">
          <div
            className="relative overflow-hidden rounded-lg border border-white/20 p-3"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 26px, rgba(0,0,0,0.05) 26px, rgba(0,0,0,0.05) 52px)" }}
          >
            <div className="pointer-events-none absolute inset-4 rounded-[50%] border border-white/15" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-white/10" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-10 w-24 -translate-x-1/2 rounded-b-md border border-t-0 border-white/15" />
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-10 w-24 -translate-x-1/2 rounded-t-md border border-b-0 border-white/15" />
            <div className="relative space-y-2">
              {formationRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[28px_1fr] items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-green-100/70">{row.label}</p>
                  <div className={`grid gap-2 ${row.slots.length === 1 ? "mx-auto w-36" : row.slots.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
                    {row.slots.map((slot) => (
                      <SquadToken
                        key={slot}
                        slot={slot}
                        selected={getPlayer(state?.squad[slot], playerPool)}
                        active={activeSlot === slot}
                        playingToday={Boolean(getPlayer(state?.squad[slot], playerPool) && playingNations.has(getPlayer(state?.squad[slot], playerPool)!.nation))}
                        onClick={() => setActiveSlot(slot)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {positionCounts.map((item) => (
              <div key={item.position} className="rounded-lg bg-white/10 px-2 py-1.5 text-center text-xs font-black">
                <p>{item.position}</p>
                <p className="text-green-100/70">{item.selected}/{item.owned}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Player picker */}
        <aside className="rounded-xl border border-white/10 bg-white/6 p-4">
          {activeSlot && activePosition ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{slotLabel(activeSlot)}</p>
                  <p className="mt-1 text-2xl font-black text-white">{activePosition}</p>
                </div>
                {activePlayer ? <RatingBadge player={activePlayer} /> : null}
              </div>

              {activePlayer ? (
                <div className="mt-3 rounded-lg bg-white/8 p-3 ring-1 ring-white/10">
                  <div className="flex items-center gap-2.5">
                    <Flag nation={activePlayer.nation} />
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{activePlayer.name}</p>
                      <p className="truncate text-xs font-semibold text-white/55">{activePlayer.nation} · {activePlayer.club}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                    <PlayerStat label="Caps" value={activePlayer.caps ?? "—"} />
                    <PlayerStat label="Goals" value={activePlayer.goals ?? "—"} />
                  </div>
                  <button
                    className="mt-3 w-full rounded-lg bg-white/8 py-1.5 text-xs font-black text-white/55 transition hover:bg-white/12 hover:text-white/80"
                    onClick={() => updateSlot(activeSlot)}
                  >
                    Clear slot
                  </button>
                </div>
              ) : (
                <p className="mt-3 rounded-lg bg-white/6 p-3 text-sm font-semibold text-white/40">Choose a player for this slot.</p>
              )}

              <input
                className="mt-4 w-full rounded-lg border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white placeholder:text-white/30 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/25"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${activePosition} players…`}
              />

              <div className="mt-3 max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
                {benchPlayers.map((player) => {
                  const isSelected = player.id === activePlayer?.id;
                  return (
                    <button
                      key={player.id}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-amber-400/40 bg-amber-950/30 text-white"
                          : "border-white/8 bg-white/5 text-white hover:border-white/15 hover:bg-white/10"
                      }`}
                      onClick={() => updateSlot(activeSlot, player.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Flag nation={player.nation} compact />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">{player.name}</p>
                            <p className="truncate text-[11px] font-semibold text-white/50">{player.nation} · {player.club}</p>
                          </div>
                          {playingNations.has(player.nation) ? (
                            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-300">Today</span>
                          ) : null}
                        </div>
                        <RatingPill rating={player.rating} />
                      </div>
                    </button>
                  );
                })}
                {benchPlayers.length === 0 ? (
                  <p className="rounded-lg bg-white/5 p-3 text-sm font-semibold text-white/40">
                    No available {activePosition} players{query ? " match that search" : ""}.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center p-4 text-center text-sm font-semibold text-white/35">
              Tap a squad slot to swap players.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

function LockStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/6 px-3 py-2.5 ring-1 ring-white/8">
      <p className="text-[10px] font-black uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function SquadToken({ slot, selected, active, playingToday, onClick }: { slot: SquadSlot; selected?: Player; active: boolean; playingToday: boolean; onClick: () => void }) {
  const rating = selected?.rating ?? 0;
  const ratingPercent = selected ? Math.max(8, Math.min(100, (selected.rating / 199) * 100)) : 0;
  const ratingTone = rating >= 90 ? "from-amber-200 to-yellow-500" : rating >= 82 ? "from-fuchsia-200 to-fuchsia-500" : rating >= 74 ? "from-sky-200 to-sky-500" : "from-slate-100 to-slate-300";
  const position = slotAllowedPositions(slot)[0];

  return (
    <button className={`min-w-0 rounded-lg border p-1.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-gold bg-white" : "border-white/30 bg-white/95"}`} onClick={onClick}>
      <div className="flex items-center justify-between gap-1">
        {selected ? <Flag nation={selected.nation} compact /> : <span className="text-[10px] font-black text-green-900/50">--</span>}
        <span className={`rounded px-1 py-0.5 text-[10px] font-black text-green-950 bg-gradient-to-br ${ratingTone}`}>{selected?.rating ?? "--"}</span>
      </div>
      <p className="mt-1 break-words text-[10px] font-black leading-tight text-green-950">{selected?.name ?? slotLabel(slot)}</p>
      <p className="mt-0.5 truncate text-[9px] font-bold text-green-900/70">{selected ? selected.club : position}</p>
      {playingToday ? <p className="mt-0.5 rounded-full bg-emerald-100 px-1 text-center text-[8px] font-black uppercase text-emerald-800">Playing today</p> : null}
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-green-950/10" role="progressbar" aria-valuenow={selected?.rating ?? 0} aria-valuemin={0} aria-valuemax={199} aria-label={selected ? `${selected.name} rating` : "No player"}>
        <div className={`h-full rounded-full bg-gradient-to-r ${ratingTone}`} style={{ width: `${ratingPercent}%` }} />
      </div>
    </button>
  );
}

function RatingBadge({ player }: { player: Player }) {
  return (
    <div className="rounded-lg bg-gold px-3 py-2 text-center text-green-950">
      <p className="text-2xl font-black leading-none">{player.rating}</p>
      <p className="text-[10px] font-black uppercase">{player.rarity}</p>
    </div>
  );
}

function RatingPill({ rating }: { rating: number }) {
  const tone = rating >= 90 ? "bg-amber-400/20 text-amber-300" : rating >= 82 ? "bg-fuchsia-400/15 text-fuchsia-300" : rating >= 74 ? "bg-sky-400/15 text-sky-300" : "bg-white/10 text-white/55";
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-black ${tone}`}>{rating}</span>;
}

function PlayerStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/6 px-2 py-1.5">
      <p className="text-[9px] font-black uppercase tracking-wide text-white/35">{label}</p>
      <p className="mt-0.5 text-xs font-black text-white/80">{value}</p>
    </div>
  );
}

function Flag({ nation, compact = false }: { nation: string; compact?: boolean }) {
  const url = flagUrl(nation);
  const cls = compact ? "h-3.5 w-5" : "h-5 w-7";
  if (!url) return <span className={`inline-flex ${cls} items-center justify-center rounded-sm bg-white/10 text-[9px] font-black text-white/50`}>{nation.slice(0, 2).toUpperCase()}</span>;
  return <img className={`${cls} shrink-0 rounded-sm object-cover shadow-sm`} src={url} alt={`${nation} flag`} />;
}

function slotLabel(slot: SquadSlot) {
  if (slot === "GK") return "Goalkeeper";
  return `${slot.slice(0, 2)} ${slot.slice(2)}`;
}

function syncDraftSquad(squad: Partial<Record<SquadSlot, number>>) {
  fetch("/api/live/sync-squad", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ squad })
  }).catch(() => {});
}

function getFixtureNations(lockStatus: LockStatus) {
  return new Set(lockStatus.upcomingFixtures.flatMap((f) => [f.homeTeam, f.awayTeam]));
}

function autoPickBestXIFromNations(state: UserState, nations: Set<string>, playerPool: Player[]): UserState {
  const owned = getOwnedPlayers(state, playerPool);
  const playing = owned.filter((p) => nations.has(p.nation));
  const used = new Set<number>();
  const squad: UserState["squad"] = {};

  const fillFrom = (pool: Player[]) => {
    for (const slot of squadSlots) {
      if (squad[slot]) continue;
      const pick = pool
        .filter((p) => canPlaySlot(p, slot) && !used.has(p.id))
        .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))[0];
      if (pick) { used.add(pick.id); squad[slot] = pick.id; }
    }
  };

  fillFrom(playing);
  fillFrom(owned);
  return { ...state, squad };
}
