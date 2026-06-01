import { allPlayers } from "./rewardEngine";
import type { Player, Position, SquadSlot, UserState } from "./types";

export const squadSlots: SquadSlot[] = ["GK", "DF1", "DF2", "DF3", "DF4", "MF1", "MF2", "MF3", "FW1", "FW2", "FW3"];

export function slotAllowedPositions(slot: SquadSlot): Position[] {
  if (slot.startsWith("DF")) return ["DF"];
  if (slot.startsWith("MF")) return ["MF"];
  if (slot.startsWith("FW")) return ["FW"];
  return ["GK"];
}

export function getPlayer(id?: number): Player | undefined {
  return allPlayers.find((player) => player.id === id);
}

export function getOwnedPlayers(state: UserState): Player[] {
  return state.ownedPlayerIds.map(getPlayer).filter((player): player is Player => Boolean(player));
}

export function canPlaySlot(player: Player, slot: SquadSlot): boolean {
  return slotAllowedPositions(slot).includes(player.pos);
}

export function calculateSquadRating(state: UserState): number {
  const selected = squadSlots.map((slot) => getPlayer(state.squad[slot])).filter((player): player is Player => Boolean(player));
  if (selected.length === 0) return 0;
  return Math.round(selected.reduce((sum, player) => sum + player.rating, 0) / selected.length);
}

export function autoPickBestXI(state: UserState): UserState {
  const owned = getOwnedPlayers(state);
  const used = new Set<number>();
  const squad: UserState["squad"] = {};

  for (const slot of squadSlots) {
    const candidates = owned
      .filter((player) => canPlaySlot(player, slot) && !used.has(player.id))
      .sort((a, b) => b.rating - a.rating);
    const pick = candidates[0];
    if (pick) {
      used.add(pick.id);
      squad[slot] = pick.id;
    }
  }

  return { ...state, squad };
}
