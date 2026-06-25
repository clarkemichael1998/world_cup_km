import { getAdminUsernames } from "@/lib/server/admin";
import { getDb } from "@/lib/server/db";
import { cupThemes } from "@/lib/cupLegends";

const cupSchedules = [
  ["2026-06-26", "2026-06-27", "2026-06-28", "2026-06-29", "2026-06-30"],
  ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"],
  ["2026-07-06", "2026-07-07", "2026-07-09", "2026-07-10", "2026-07-11"],
  ["2026-07-12", "2026-07-14", "2026-07-15", "2026-07-18", "2026-07-19"]
];
const restDates = ["2026-07-08", "2026-07-13", "2026-07-16", "2026-07-17"];
const roundLabels = ["Play-off", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];

// Visual theming (colours, motifs, the legend card itself) lives in the
// shared lib/cupLegends.ts module, importable from both server and client.

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
  locked: boolean;
  unlocksOn: string | null;
  rounds: Array<{ day: number; date: string; label: string }>;
  matches: CupMatch[];
};

function getLondonToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

export function getCupHubData() {
  const participants = getCupParticipants();
  const today = getLondonToday();
  const cups = cupSchedules.map((dates, index) => {
    const cup = buildCup(index + 1, dates, participants);
    // Each cup (after the first) stays locked until the previous cup begins,
    // so the next theme/draw is a surprise rather than visible from day one.
    const unlocksOn = index === 0 ? null : cupSchedules[index - 1][0];
    const locked = unlocksOn !== null && today < unlocksOn;
    return { ...cup, locked, unlocksOn };
  });
  return {
    participants,
    cups,
    restDates,
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
      { place: "Cup winner", reward: "35 stickers plus that cup's Cup Legend card" }
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

function buildCup(id: number, dates: string[], participants: string[]): Omit<CupDefinition, "locked" | "unlocksOn"> {
  const shuffled = deterministicShuffle(participants, id * 2026);
  const rounds = roundLabels.map((label, index) => ({ day: index + 1, date: dates[index], label }));
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

  const theme = cupThemes[id - 1];
  return {
    id,
    name: theme.cupName,
    startDate: rounds[0].date,
    endDate: rounds[4].date,
    // Deliberately no rating here — the exact stat stays a surprise for
    // whoever wins the cup; see PlayerCard's hideRating preview.
    prize: `${theme.legend} Cup Legend Card`,
    runnerUpPrize: "30 stickers plus guaranteed Icon",
    legend: theme.legend,
    country: theme.country,
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
