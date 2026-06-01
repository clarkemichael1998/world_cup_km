export type Position = "GK" | "DF" | "MF" | "FW";

export type Rarity = "clowns" | "common" | "rare" | "epic" | "legend" | "icon";

export type SquadSlot = "GK" | "DF1" | "DF2" | "DF3" | "DF4" | "MF1" | "MF2" | "MF3" | "FW1" | "FW2" | "FW3";

export type Player = {
  id: number;
  slug: string;
  name: string;
  sortName: string;
  club: string;
  nation: string;
  pos: Position;
  rating: number;
  rarity: Rarity;
  wiki: string | null;
  dob: string;
  caps: number | null;
  goals: number | null;
  clubWiki: string | null;
  clubCountry: string;
  teamId: string;
};

export type UserState = {
  totalKm: number;
  kmBalance: number;
  ownedPlayerIds: number[];
  duplicateCounts: Record<number, number>;
  squad: Partial<Record<SquadSlot, number>>;
};
