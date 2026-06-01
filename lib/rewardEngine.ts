import players from "@/data/players.json";
import type { Player, Position, Rarity, SquadSlot, UserState } from "./types";

export const allPlayers = players as Player[];

const odds: Array<{ rarity: Rarity; ceiling: number }> = [
  { rarity: "common", ceiling: 0.65 },
  { rarity: "rare", ceiling: 0.9 },
  { rarity: "epic", ceiling: 0.98 },
  { rarity: "legend", ceiling: 0.998 },
  { rarity: "icon", ceiling: 1 }
];

const starterPlan: Array<{ slot: SquadSlot; positions: Position[] }> = [
  { slot: "GK", positions: ["GK"] },
  { slot: "DF1", positions: ["DF"] },
  { slot: "DF2", positions: ["DF"] },
  { slot: "DF3", positions: ["DF"] },
  { slot: "DF4", positions: ["DF"] },
  { slot: "MF1", positions: ["MF"] },
  { slot: "MF2", positions: ["MF"] },
  { slot: "MF3", positions: ["MF"] },
  { slot: "FW1", positions: ["FW"] },
  { slot: "FW2", positions: ["FW"] },
  { slot: "FW3", positions: ["FW"] }
];

export function rollRarity(): Rarity {
  const roll = Math.random();
  return odds.find((item) => roll < item.ceiling)?.rarity ?? "common";
}

export function getRandomPlayerByRarity(rarity = rollRarity()): Player {
  const pool = allPlayers.filter((player) => player.rarity === rarity);
  const fallbackPool = pool.length > 0 ? pool : allPlayers;
  return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
}

export function calculateRewards(distance: number, kmBalance: number) {
  const combined = distance + kmBalance;
  const rewards = Math.floor(combined);
  const newBalance = Number((combined - rewards).toFixed(2));
  return { rewards, newBalance };
}

export function addRewardPlayers(state: UserState, rewardPlayers: Player[]): UserState {
  const ownedPlayerIds = [...state.ownedPlayerIds];
  const duplicateCounts = { ...state.duplicateCounts };

  for (const player of rewardPlayers) {
    if (ownedPlayerIds.includes(player.id)) {
      duplicateCounts[player.id] = (duplicateCounts[player.id] ?? 0) + 1;
    } else {
      ownedPlayerIds.push(player.id);
      duplicateCounts[player.id] = duplicateCounts[player.id] ?? 0;
    }
  }

  return { ...state, ownedPlayerIds, duplicateCounts };
}

export function generateStarterState(): UserState {
  const picked = new Set<number>();
  const squad: UserState["squad"] = {};

  for (const item of starterPlan) {
    const preferred = allPlayers.filter(
      (player) =>
        item.positions.includes(player.pos) &&
        !picked.has(player.id) &&
        ["common", "rare"].includes(player.rarity) &&
        player.rating >= 60 &&
        player.rating <= 74
    );
    const fallback = allPlayers.filter((player) => item.positions.includes(player.pos) && !picked.has(player.id));
    const pool = preferred.length > 0 ? preferred : fallback;
    const player = pool[Math.floor(Math.random() * pool.length)];
    if (player) {
      picked.add(player.id);
      squad[item.slot] = player.id;
    }
  }

  return {
    totalKm: 0,
    kmBalance: 0,
    ownedPlayerIds: Array.from(picked),
    duplicateCounts: Object.fromEntries(Array.from(picked).map((id) => [id, 0])),
    squad
  };
}
