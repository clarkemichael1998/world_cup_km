"use client";

import { useEffect, useMemo, useState } from "react";
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
    if (playerId) {
      squad[slot] = playerId;
    } else {
      delete squad[slot];
    }
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
    const selectedCount = Object.keys(updated.squad).length;
    setLockNotice(`Auto-picked ${selectedCount}/11 players from nations playing on ${lockStatus.lockDate}.`);
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
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <PageTitle title="Squad" subtitle={`${selectedPlayers.length}/11 selected${rating ? ` - Average ${rating.toFixed(1)}` : ""}`} />
        <div className="mb-4 flex flex-wrap gap-2 self-start md:mb-8 md:justify-end">
          <button className="rounded-md bg-boot px-4 py-2 text-sm font-black text-white hover:bg-red-700" onClick={autoPick}>
            Auto-pick Best XI
          </button>
          <button
            className="rounded-md bg-pitch px-4 py-2 text-sm font-black text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={autoPickPlayingToday}
            disabled={!lockStatus || lockStatus.upcomingFixtures.length === 0}
            title={!lockStatus || lockStatus.upcomingFixtures.length === 0 ? "No fixtures loaded for the lock date." : "Pick the best XI from nations playing on the lock date."}
          >
            Auto-pick Playing Today
          </button>
        </div>
      </div>

      {lockStatus && (
        <section className={`mb-4 rounded-lg border p-5 shadow-sm ${lockStatus.isLocked ? "border-amber-300 bg-amber-50" : "border-green-900/10 bg-white"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${lockStatus.isLocked ? "bg-amber-200 text-amber-950" : "bg-green-100 text-green-800"}`}>
                {lockStatus.isLocked ? "Locked" : "Unlocked"}
              </span>
              <p className="text-sm font-black uppercase tracking-wide text-green-900/60">
                ⚽ Next Lock — {lockStatus.lockDate}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-green-900/50">
                Locks {new Date(lockStatus.lockAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })} UK time
              </p>
            </div>
            <button
              onClick={toggleLock}
              disabled={lockBusy}
              className={`rounded-md px-5 py-2 text-sm font-black text-white transition disabled:opacity-50 ${lockStatus.isLocked ? "bg-amber-600 hover:bg-amber-700" : "bg-pitch hover:bg-green-800"}`}
            >
              {lockBusy ? "..." : lockStatus.isLocked ? "🔒 Locked — Click to Unlock" : "🔓 Lock Squad for This Day"}
            </button>
          </div>

          {lockNotice ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
              {lockNotice}
              {lockStatus.isLocked ? (
                <span className="block text-xs font-semibold text-emerald-800/70">
                  Unlocks {new Date(lockStatus.unlockAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })} UK time.
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <LockSummary label="Playing Today" value={`${selectedPlayingCount}/${selectedPlayers.length || 11}`} />
            <LockSummary label="Bench Risks" value={String(selectedBenchRisks)} />
            <LockSummary label="Fixtures Covered" value={`${coveredFixtures}/${lockStatus.upcomingFixtures.length}`} />
          </div>

          {lockStatus.isLocked && lockStatus.lockedPlayers.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-wide text-green-900/50 mb-2">Locked XI</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {lockStatus.lockedPlayers.map(({ slot, player }) => (
                  <div key={slot} className="rounded-md bg-green-950/5 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-green-900/50">{slot}</p>
                    <p className="mt-0.5 truncate text-sm font-black text-green-950">{player.name}</p>
                    <p className="truncate text-xs font-semibold text-green-900/60">{player.nation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lockStatus.upcomingFixtures.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-wide text-green-900/50 mb-2">Fixtures on {lockStatus.lockDate}</p>
              <div className="flex flex-wrap gap-2">
                {lockStatus.upcomingFixtures.map((f) => (
                  <div key={f.matchId} className="rounded-md border border-green-900/10 bg-green-950/5 px-3 py-2 text-xs font-bold text-green-950">
                    {f.homeTeam} vs {f.awayTeam}
                    {f.winner && <span className="ml-2 text-green-700"> — {f.winner} win</span>}
                    {f.status === "FINISHED" && !f.winner && <span className="ml-2 text-green-900/50">Draw</span>}
                  </div>
                ))}
              </div>
              {lockStatus.upcomingFixtures.length === 0 && (
                <p className="text-xs font-semibold text-green-900/50">No fixtures listed for this date yet.</p>
              )}
            </div>
          )}
          {lockStatus.upcomingFixtures.length === 0 && (
            <p className="mt-3 text-xs font-semibold text-green-900/50">No fixtures listed for {lockStatus.lockDate} yet.</p>
          )}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg bg-pitch p-3 text-white shadow-sm">
          <div className="relative overflow-hidden rounded-md border border-white/20 bg-green-950/25 p-3">
            <div className="pointer-events-none absolute inset-4 rounded-[50%] border border-white/15" />
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-white/10" />

            <div className="relative space-y-2">
              {formationRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[28px_1fr] items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-wide text-green-100/70">{row.label}</p>
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
              <div key={item.position} className="rounded-md bg-white/10 px-2 py-1 text-center text-xs font-black">
                <p>{item.position}</p>
                <p className="text-green-100/75">
                  {item.selected}/{item.owned}
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm">
          {activeSlot && activePosition ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-green-900/60">Swap {slotLabel(activeSlot)}</p>
                  <p className="mt-1 text-2xl font-black text-green-950">{activePosition}</p>
                </div>
                {activePlayer ? <RatingBadge player={activePlayer} /> : null}
              </div>

              {activePlayer ? (
                <div className="mt-3 rounded-md bg-green-950/5 p-3">
                  <div className="flex items-center gap-2">
                    <Flag nation={activePlayer.nation} />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-green-950">{activePlayer.name}</p>
                      <p className="truncate text-sm font-bold text-green-900/70">{activePlayer.nation}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-green-950">
                    <Detail label="Club" value={activePlayer.club} />
                    <Detail label="DOB" value={activePlayer.dob} />
                    <Detail label="Caps" value={activePlayer.caps ?? "Unknown"} />
                    <Detail label="Goals" value={activePlayer.goals ?? "Unknown"} />
                  </div>
                  <button className="mt-3 rounded-md bg-green-950/10 px-3 py-2 text-xs font-black text-green-950 hover:bg-green-950/15" onClick={() => updateSlot(activeSlot)}>
                    Clear slot
                  </button>
                </div>
              ) : (
                <p className="mt-3 rounded-md bg-green-950/5 p-3 text-sm font-bold text-green-900/70">Choose a player for this slot.</p>
              )}

              <input className="mt-4 w-full rounded-md border border-green-900/20 px-3 py-2 text-sm font-semibold" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${activePosition} players`} />

              <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {benchPlayers.map((player) => (
                  <button key={player.id} className={`w-full rounded-md border px-3 py-2 text-left hover:border-green-800 ${player.id === activePlayer?.id ? "border-green-900 bg-green-950 text-white" : "border-green-900/10 bg-white text-green-950"}`} onClick={() => updateSlot(activeSlot, player.id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <Flag nation={player.nation} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{player.name}</p>
                          <p className="truncate text-xs font-semibold opacity-75">
                            {player.nation} - {player.club}
                          </p>
                        </div>
                        {playingNations.has(player.nation) ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">Today</span> : null}
                      </div>
                      <span className="rounded-md bg-gold px-2 py-1 text-xs font-black text-green-950">{player.rating}</span>
                    </div>
                  </button>
                ))}
                {benchPlayers.length === 0 ? <p className="rounded-md bg-green-950/5 p-3 text-sm font-bold text-green-900/70">No available {activePosition} players match that search.</p> : null}
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-40 items-center justify-center rounded-md bg-green-950/5 p-4 text-center text-sm font-bold text-green-900/70">Click a squad slot to see player details and swap options.</div>
          )}
        </aside>
      </section>
    </div>
  );
}

function LockSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-green-950/5 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-green-900/50">{label}</p>
      <p className="mt-0.5 text-lg font-black text-green-950">{value}</p>
    </div>
  );
}

function SquadToken({ slot, selected, active, playingToday, onClick }: { slot: SquadSlot; selected?: Player; active: boolean; playingToday: boolean; onClick: () => void }) {
  const rating = selected?.rating ?? 0;
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
      <div
        className="mt-1 h-1 overflow-hidden rounded-full bg-green-950/10"
        role="progressbar"
        aria-valuenow={selected?.rating ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={selected ? `${selected.name} rating` : "No player"}
      >
        <div className={`h-full rounded-full bg-gradient-to-r ${ratingTone}`} style={{ width: `${selected ? Math.max(8, selected.rating) : 0}%` }} />
      </div>
    </button>
  );
}

function RatingBadge({ player }: { player: Player }) {
  return (
    <div className="rounded-md bg-gold px-3 py-2 text-center text-green-950">
      <p className="text-2xl font-black leading-none">{player.rating}</p>
      <p className="text-[11px] font-black uppercase">{player.rarity}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white px-2 py-1">
      <p className="text-[10px] font-black uppercase tracking-wide text-green-900/55">{label}</p>
      <p className="mt-0.5 truncate">{value}</p>
    </div>
  );
}

function Flag({ nation, compact = false }: { nation: string; compact?: boolean }) {
  const url = flagUrl(nation);
  const className = compact ? "h-3.5 w-5" : "h-5 w-7";

  if (!url) {
    return <span className={`inline-flex ${className} items-center justify-center rounded-sm bg-green-950/10 text-[9px] font-black`}>{nation.slice(0, 2).toUpperCase()}</span>;
  }

  return <img className={`${className} shrink-0 rounded-sm object-cover shadow-sm`} src={url} alt={`${nation} flag`} />;
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
  }).catch(() => {
    // Login is optional while browsing locally; the Live page will prompt for it.
  });
}

function getFixtureNations(lockStatus: LockStatus) {
  return new Set(lockStatus.upcomingFixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]));
}

function autoPickBestXIFromNations(state: UserState, nations: Set<string>, playerPool: Player[]): UserState {
  const owned = getOwnedPlayers(state, playerPool).filter((player) => nations.has(player.nation));
  const used = new Set<number>();
  const squad: UserState["squad"] = {};

  for (const slot of squadSlots) {
    const pick = owned
      .filter((player) => canPlaySlot(player, slot) && !used.has(player.id))
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))[0];

    if (pick) {
      used.add(pick.id);
      squad[slot] = pick.id;
    }
  }

  return { ...state, squad };
}
