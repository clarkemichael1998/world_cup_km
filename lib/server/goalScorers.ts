import type { Player, Rarity } from "@/lib/types";
import { getAllPlayers, upsertAssistScorer, upsertGoalScorer } from "./db";

export const GOAL_BOOST_BY_RARITY: Record<Rarity, number> = {
  icon: 2,
  legend: 2,
  epic: 3,
  rare: 5,
  common: 10,
  clowns: -5,
  dangerous:  0,
  consistent: 0
};

export const ASSIST_BOOST_BY_RARITY: Record<Rarity, number> = {
  icon: 1,
  legend: 1,
  epic: 2,
  rare: 3,
  common: 5,
  clowns: -3,
  dangerous:  0,
  consistent: 0
};

export function getPlayerById(id: number): Player | undefined {
  return getAllPlayers().find((p) => p.id === id);
}

// Strip diacritics, lowercase, remove non-alpha chars except spaces
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// "K. Mbappé" → {initial: "k", last: "mbappe"}
function parseInitialLast(name: string): { initial: string; last: string } | null {
  const normalized = normalizeName(name);
  const match = normalized.match(/^([a-z])\.\s*(.+)$/) ?? normalized.match(/^([a-z])\s+(.+)$/);
  if (match) return { initial: match[1], last: match[2].trim() };
  return null;
}

function lastName(normalized: string): string {
  const parts = normalized.split(" ");
  return parts[parts.length - 1];
}

// Score how well two normalized names match (0 = no match, higher = better)
function matchScore(raw: string, player: Player): number {
  const rawNorm = normalizeName(raw);
  const playerNorm = normalizeName(player.name);
  const playerLast = lastName(playerNorm);

  // Exact full name
  if (rawNorm === playerNorm) return 100;

  // Full name contained
  if (playerNorm.includes(rawNorm) || rawNorm.includes(playerNorm)) return 80;

  const parsedRaw = parseInitialLast(raw);
  if (parsedRaw) {
    const rawLast = parsedRaw.last;
    const rawInitial = parsedRaw.initial;
    const playerFirst = playerNorm.split(" ")[0];

    // Initial + last name both match
    if (rawLast === playerLast && playerFirst.startsWith(rawInitial)) return 90;

    // Just last name matches with initial hint
    if (rawLast === playerLast) return 60;
  }

  // Last names match exactly
  if (rawNorm === playerLast || lastName(rawNorm) === playerLast) return 70;

  // Last name is contained
  if (playerLast.length >= 4 && rawNorm.includes(playerLast)) return 50;
  if (playerLast.length >= 4 && playerLast.includes(rawNorm)) return 40;

  return 0;
}

export function findBestPlayerMatch(scorerName: string): { player: Player; score: number } | null {
  let best: { player: Player; score: number } | null = null;

  for (const player of getAllPlayers()) {
    const score = matchScore(scorerName, player);
    if (score > 0 && (!best || score > best.score)) {
      best = { player, score };
    }
  }

  // Only auto-match above a confidence threshold
  return best && best.score >= 70 ? best : null;
}

// Process goal scorer names for a match, counting occurrences per scorer
export function processGoalScorers(matchId: string, scorerNames: string[]) {
  const counts = new Map<string, number>();
  for (const name of scorerNames) counts.set(name, (counts.get(name) ?? 0) + 1);

  for (const [name, goalCount] of counts) {
    const match = findBestPlayerMatch(name);
    if (match) {
      upsertGoalScorer(matchId, name, match.player.id, "matched", "auto", goalCount);
    } else {
      upsertGoalScorer(matchId, name, null, "pending", "auto", goalCount);
    }
  }
}

// Process assist names for a match (each assist counts once per goal event)
export function processAssistScorers(matchId: string, assistNames: string[]) {
  const counts = new Map<string, number>();
  for (const name of assistNames) counts.set(name, (counts.get(name) ?? 0) + 1);

  for (const [name, assistCount] of counts) {
    const match = findBestPlayerMatch(name);
    if (match) {
      upsertAssistScorer(matchId, name, match.player.id, "matched", "auto", assistCount);
    } else {
      upsertAssistScorer(matchId, name, null, "pending", "auto", assistCount);
    }
  }
}
