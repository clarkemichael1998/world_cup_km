import players from "@/data/players.json";
import type { ActivityType, Player, Position, Rarity, SquadSlot, UserState } from "./types";

export const allPlayers = players as Player[];

const odds: Array<{ rarity: Rarity; ceiling: number }> = [
  { rarity: "clowns", ceiling: 0.01 },
  { rarity: "common", ceiling: 0.70 },
  { rarity: "rare", ceiling: 0.95 },
  { rarity: "epic", ceiling: 0.988 },
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
  return getRandomPlayerFromPool(allPlayers, rarity);
}

export function getRandomPlayerFromPool(playerPool: Player[], rarity = rollRarity()): Player {
  const pool = playerPool.filter((player) => player.rarity === rarity);
  const fallbackPool = pool.length > 0 ? pool : allPlayers;
  return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
}

export const DEFAULT_ACTIVITY_MULTIPLIER = 1.25;

export const activityDefinitions: Record<ActivityType, { label: string; unit: "km" | "minutes"; creditsPerUnit: number; maxPerLog: number }> = {
  walk: { label: "Walk", unit: "km", creditsPerUnit: 1, maxPerLog: 50 },
  run: { label: "Run", unit: "km", creditsPerUnit: 1, maxPerLog: 50 },
  cycle: { label: "Cycle", unit: "km", creditsPerUnit: 1 / 3, maxPerLog: 150 },
  strength: { label: "Strength workout", unit: "minutes", creditsPerUnit: 1 / 10, maxPerLog: 180 },
  sport: { label: "Sport session", unit: "minutes", creditsPerUnit: 1 / 10, maxPerLog: 240 },
  mobility: { label: "Yoga / mobility", unit: "minutes", creditsPerUnit: 1 / 30, maxPerLog: 240 }
};

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && value in activityDefinitions;
}

export function calculateActivityCredits(activityType: ActivityType, amount: number) {
  return Number((amount * activityDefinitions[activityType].creditsPerUnit).toFixed(2));
}

export function calculateRewards(activityCredits: number, kmBalance: number, multiplier = 1) {
  const combined = activityCredits * multiplier + kmBalance;
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
        (["common", "rare"] as Rarity[]).includes(player.rarity) &&
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
