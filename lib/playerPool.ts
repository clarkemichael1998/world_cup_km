import players from "@/data/players.json";
import type { Player } from "@/lib/types";

export const basePlayerPool = players as Player[];

export async function loadPlayerPool(): Promise<Player[]> {
  try {
    const response = await fetch("/api/players", { credentials: "include" });
    if (!response.ok) return basePlayerPool;
    const data = (await response.json()) as { players?: Player[] };
    return Array.isArray(data.players) && data.players.length > 0 ? data.players : basePlayerPool;
  } catch {
    return basePlayerPool;
  }
}
