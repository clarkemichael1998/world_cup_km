import { getAdminUsernames } from "@/lib/server/admin";
import { getDb } from "@/lib/server/db";

const cupStarts = ["2026-06-26", "2026-07-01", "2026-07-06", "2026-07-11"];
const roundLabels = ["Play-off", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];
const cupNames = ["Larsson Cup", "Dalglish Cup", "Maradona Cup", "Pele Cup"];
const legendPrizes = ["Henrik Larsson 105", "Kenny Dalglish 110", "Diego Maradona 115", "Pele 120"];
const cupThemes = [
  {
    legend: "Henrik Larsson",
    country: "Sweden",
    colours: "from-blue-900 via-blue-600 to-yellow-300",
    accent: "bg-yellow-300 text-blue-950",
    motif: "braided gold arcs, cold blue floodlights, ruthless movement in the box"
  },
  {
    legend: "Kenny Dalglish",
    country: "Scotland",
    colours: "from-blue-950 via-sky-700 to-white",
    accent: "bg-white text-blue-950",
    motif: "saltire shards, royal blue smoke, old-school finishing instinct"
  },
  {
    legend: "Diego Maradona",
    country: "Argentina",
    colours: "from-sky-300 via-white to-yellow-300",
    accent: "bg-sky-200 text-sky-950",
    motif: "sunburst halos, sky-blue stripes, impossible left-foot chaos"
  },
  {
    legend: "Pele",
    country: "Brazil",
    colours: "from-green-700 via-yellow-300 to-blue-700",
    accent: "bg-yellow-300 text-green-950",
    motif: "samba waves, gold flares, green-and-blue final boss energy"
  }
];

export type CupMatch = {
  round: string;
  day: number;
  date: string;
  label: string;
  home: string;
  away: string;
};

export type CupDefinition = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  prize: string;
  runnerUpPrize: string;
  legend: string;
  country: string;
  colours: string;
  accent: string;
  motif: string;
  rounds: Array<{ day: number; date: string; label: string }>;
  matches: CupMatch[];
};

export function getCupHubData() {
  const participants = getCupParticipants();
  const cups = cupStarts.map((startDate, index) => buildCup(index + 1, startDate, participants));
  return {
    participants,
    cups,
    scoring: [
      { label: "Activity points", value: "1 point per activity credit logged that matchday, capped at 40" },
      { label: "Football points", value: "Nation wins, goals, and assists also score, capped at 40" },
      { label: "Nation win", value: "+2 points per locked player whose nation wins" },
      { label: "Goal / assist boosts", value: "The rating boost amount counts as football points" },
      { label: "Tie-breaker", value: "If scores are level, higher uncapped daily activity wins" }
    ],
    prizes: [
      { place: "Play-off winner", reward: "10 stickers" },
      { place: "Quarter-final elimination", reward: "15 stickers" },
      { place: "Semi-final elimination", reward: "25 stickers" },
      { place: "Runner-up", reward: "30 stickers plus a guaranteed Icon card" },
      { place: "Cup winner", reward: "35 stickers plus that cup's 100+ Cup Legend card" }
    ]
  };
}

function getCupParticipants() {
  const adminUsernames = getAdminUsernames();
  const rows = getDb()
    .prepare("SELECT username FROM users ORDER BY username")
    .all() as Array<{ username: string }>;
  return rows
    .map((row) => row.username)
    .filter((username) => !adminUsernames.has(username.toLowerCase()));
}

function buildCup(id: number, startDate: string, participants: string[]): CupDefinition {
  const shuffled = deterministicShuffle(participants, id * 2026);
  const rounds = roundLabels.map((label, index) => ({ day: index + 1, date: addDays(startDate, index), label }));
  const matches: CupMatch[] = [];

  const playInHome = shuffled[0] ?? "Player 16";
  const playInAway = shuffled[1] ?? "Player 17";
  matches.push({ round: "play-off", day: 1, date: rounds[0].date, label: "Play-off", home: playInHome, away: playInAway });

  const r16Entrants = [`Winner of ${playInHome} v ${playInAway}`, ...shuffled.slice(2, 17)];
  while (r16Entrants.length < 16) r16Entrants.push(`Bye slot ${r16Entrants.length + 1}`);
  for (let i = 0; i < 8; i++) {
    matches.push({
      round: "round-of-16",
      day: 2,
      date: rounds[1].date,
      label: `R16 Match ${i + 1}`,
      home: r16Entrants[i * 2],
      away: r16Entrants[i * 2 + 1]
    });
  }

  addPlaceholderRound(matches, "quarter-finals", 3, rounds[2].date, "Quarter-final", 4);
  addPlaceholderRound(matches, "semi-finals", 4, rounds[3].date, "Semi-final", 2);
  addPlaceholderRound(matches, "final", 5, rounds[4].date, "Final", 1);

  return {
    id,
    name: cupNames[id - 1],
    startDate,
    endDate: rounds[4].date,
    prize: legendPrizes[id - 1],
    runnerUpPrize: "30 stickers plus guaranteed Icon",
    legend: cupThemes[id - 1].legend,
    country: cupThemes[id - 1].country,
    colours: cupThemes[id - 1].colours,
    accent: cupThemes[id - 1].accent,
    motif: cupThemes[id - 1].motif,
    rounds,
    matches
  };
}

function addPlaceholderRound(matches: CupMatch[], round: string, day: number, date: string, label: string, count: number) {
  for (let i = 0; i < count; i++) {
    matches.push({
      round,
      day,
      date,
      label: `${label} ${count === 1 ? "" : i + 1}`.trim(),
      home: `Winner ${previousRoundName(round)} ${i * 2 + 1}`,
      away: `Winner ${previousRoundName(round)} ${i * 2 + 2}`
    });
  }
}

function previousRoundName(round: string) {
  if (round === "quarter-finals") return "R16";
  if (round === "semi-finals") return "QF";
  if (round === "final") return "SF";
  return "Match";
}

function deterministicShuffle(values: string[], seed: number) {
  const items = [...values];
  let state = seed || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
