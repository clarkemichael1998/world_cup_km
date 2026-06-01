import { generateStarterState } from "./rewardEngine";
import { squadSlots } from "./squadUtils";
import type { Player, UserState } from "./types";

const storageKey = "km-footy-state-v1";
const revealKey = "km-footy-last-rewards-v1";

export function loadUserState(): UserState {
  if (typeof window === "undefined") return generateStarterState();
  return normalizeState(loadLocalState());
}

export async function loadUserStateAsync(): Promise<UserState> {
  if (typeof window === "undefined") return generateStarterState();

  try {
    const response = await fetch("/api/state", { credentials: "include" });
    if (response.ok) {
      const payload = await response.json();
      const state = normalizeState(payload.state as UserState);
      saveLocalState(state);
      return state;
    }
  } catch {}

  return loadUserState();
}

export function saveUserState(state: UserState) {
  if (typeof window === "undefined") return;
  const normalized = normalizeState(state);
  saveLocalState(normalized);
  fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ state: normalized })
  }).catch(() => {});
}

export function saveRevealPlayers(players: Player[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(revealKey, JSON.stringify(players));
  fetch("/api/reveal", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ playerIds: players.map((player) => player.id) })
  }).catch(() => {});
}

export function loadRevealPlayers(): Player[] {
  if (typeof window === "undefined") return [];
  const saved = window.sessionStorage.getItem(revealKey);
  return saved ? (JSON.parse(saved) as Player[]) : [];
}

export async function loadRevealPlayersAsync(): Promise<Player[]> {
  if (typeof window === "undefined") return [];
  try {
    const response = await fetch("/api/reveal", { credentials: "include" });
    if (response.ok) {
      const payload = await response.json();
      const players = payload.players as Player[];
      window.sessionStorage.setItem(revealKey, JSON.stringify(players));
      return players;
    }
  } catch {}
  return loadRevealPlayers();
}

function loadLocalState() {
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) {
    const starterState = generateStarterState();
    saveLocalState(starterState);
    return starterState;
  }

  try {
    return JSON.parse(saved) as UserState;
  } catch {
    const starterState = generateStarterState();
    saveLocalState(starterState);
    return starterState;
  }
}

function saveLocalState(state: UserState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function normalizeState(state: UserState): UserState {
  const validSlots = new Set<string>(squadSlots);
  const squad = Object.fromEntries(Object.entries(state.squad ?? {}).filter(([slot]) => validSlots.has(slot)));
  return {
    totalKm: Number(state.totalKm ?? 0),
    kmBalance: Number(state.kmBalance ?? 0),
    ownedPlayerIds: state.ownedPlayerIds ?? [],
    duplicateCounts: state.duplicateCounts ?? {},
    squad
  };
}
