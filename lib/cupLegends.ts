import type { Player, Rarity } from "@/lib/types";

// Shared, client-safe cup theme + legend-card data. No server-only imports
// here on purpose — both lib/server/cups.ts and client components (PlayerCard,
// the Cups page, the album grid) need this without pulling in the database.
export type CupTheme = {
  cupId: number;
  cupName: string;
  legend: string;
  country: string;
  /** Tailwind gradient stops, e.g. "from-blue-900 via-blue-600 to-yellow-300" */
  colours: string;
  /** Small chip bg+text, e.g. "bg-yellow-300 text-blue-950" */
  accent: string;
  /** Border colour class, e.g. "border-amber-300" */
  border: string;
  /** Light tint background, e.g. "bg-amber-50" */
  soft: string;
  /** Strong text colour, e.g. "text-amber-700" */
  text: string;
  /** Iconic shirt number, printed on the legend silhouette/card. */
  shirtNumber: number;
  /**
   * Optional real photo, e.g. "/legends/larsson.jpg" under /public. Drop a
   * file at that path and LegendPortrait will use it automatically; until
   * then it falls back to the faceless LegendSilhouette pictogram.
   */
  imagePath: string;
};

export const cupThemes: CupTheme[] = [
  {
    cupId: 1,
    cupName: "Larsson Cup",
    legend: "Henrik Larsson",
    country: "Sweden",
    colours: "from-blue-900 via-blue-600 to-yellow-300",
    accent: "bg-yellow-300 text-blue-950",
    border: "border-amber-300",
    soft: "bg-amber-50",
    text: "text-amber-700",
    shirtNumber: 17,
    imagePath: "/legends/larsson.jpg"
  },
  {
    cupId: 2,
    cupName: "Dalglish Cup",
    legend: "Kenny Dalglish",
    country: "Scotland",
    colours: "from-blue-950 via-sky-700 to-white",
    accent: "bg-white text-blue-950",
    border: "border-sky-300",
    soft: "bg-sky-50",
    text: "text-sky-700",
    shirtNumber: 7,
    imagePath: "/legends/dalglish.jpg"
  },
  {
    cupId: 3,
    cupName: "Maradona Cup",
    legend: "Diego Maradona",
    country: "Argentina",
    colours: "from-sky-300 via-white to-yellow-300",
    accent: "bg-sky-200 text-sky-950",
    border: "border-sky-300",
    soft: "bg-sky-50",
    text: "text-sky-700",
    shirtNumber: 10,
    imagePath: "/legends/maradona.jpg"
  },
  {
    cupId: 4,
    cupName: "Pele Cup",
    legend: "Pele",
    country: "Brazil",
    colours: "from-green-700 via-yellow-300 to-blue-700",
    accent: "bg-yellow-300 text-green-950",
    border: "border-green-300",
    soft: "bg-green-50",
    text: "text-green-700",
    shirtNumber: 10,
    imagePath: "/legends/pele.jpg"
  }
];

const legendRatings: Record<number, number> = { 1: 105, 2: 110, 3: 115, 4: 120 };
const legendDob: Record<number, string> = {
  1: "1971-09-20",
  2: "1951-03-04",
  3: "1960-10-30",
  4: "1940-10-23"
};
// Commonly-cited senior international career figures — exact totals vary
// slightly by source (caps especially), spot-check before relying on them.
const legendCaps: Record<number, number> = { 1: 106, 2: 102, 3: 91, 4: 92 };
const legendGoals: Record<number, number> = { 1: 37, 2: 30, 3: 34, 4: 77 };
const legendWiki: Record<number, string> = {
  1: "https://en.wikipedia.org/wiki/Henrik_Larsson",
  2: "https://en.wikipedia.org/wiki/Kenny_Dalglish",
  3: "https://en.wikipedia.org/wiki/Diego_Maradona",
  4: "https://en.wikipedia.org/wiki/Pel%C3%A9"
};

// Cup Legend player ids live well above the real player pool so they can
// never collide with base players or admin-added late call-ups.
export const CUP_LEGEND_ID_BASE = 90000;

export const cupLegendPlayers: Player[] = cupThemes.map((theme) => ({
  id: CUP_LEGEND_ID_BASE + theme.cupId,
  slug: `cup-legend-${theme.cupId}-${theme.legend.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  name: theme.legend,
  sortName: theme.legend,
  club: `${theme.cupName} Legend`,
  nation: theme.country,
  pos: "FW",
  rating: legendRatings[theme.cupId],
  rarity: "icon" as Rarity,
  wiki: legendWiki[theme.cupId],
  dob: legendDob[theme.cupId],
  caps: legendCaps[theme.cupId],
  goals: legendGoals[theme.cupId],
  clubWiki: null,
  clubCountry: theme.country,
  teamId: `cup-legend-${theme.cupId}`,
  cupId: theme.cupId
}));

export function getCupThemeById(cupId: number | null | undefined): CupTheme | undefined {
  if (!cupId) return undefined;
  return cupThemes.find((theme) => theme.cupId === cupId);
}

export function getCupLegendPlayer(cupId: number): Player | undefined {
  return cupLegendPlayers.find((player) => player.cupId === cupId);
}
