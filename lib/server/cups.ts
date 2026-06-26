import type { DatabaseSync } from "node:sqlite";
import { getAdminUsernames } from "@/lib/server/admin";
import { getDb } from "@/lib/server/db";
import { compareDailyScores, getDailyScore, isMatchdayOpen, isMatchdaySettled } from "@/lib/server/dailyScoring";
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
  id: string;
  round: string;
  day: number;
  date: string;
  label: string;
  home: string;
  away: string;
  /** Each side's total daily score once the match is decided, else null. */
  homeScore: number | null;
  awayScore: number | null;
  /** Username of the decided winner, else null while still scheduled/TBD. */
  winner: string | null;
  status: "scheduled" | "live" | "decided" | "bye";
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
  const db = getDb();
  const participants = getCupParticipants(db);
  const today = getLondonToday();
  const cups = cupSchedules.map((dates, index) => {
    const cup = buildCup(db, index + 1, dates, participants);
    // Each cup (after the first) stays locked until the previous cup begins,
    // so the next theme/draw is a surprise rather than visible from day one.
    const unlocksOn = index === 0 ? null : cupSchedules[index - 1][0];
    const locked = unlocksOn !== null && today < unlocksOn;
    return { ...cup, locked, unlocksOn };
  });
  return {
    participants: participants.map((p) => p.username),
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

type Participant = { id: number; username: string };

function getCupParticipants(db: DatabaseSync): Participant[] {
  const adminUsernames = getAdminUsernames();
  const rows = db.prepare("SELECT id, username FROM users ORDER BY username").all() as Participant[];
  return rows.filter((row) => !adminUsernames.has(row.username.toLowerCase()));
}

// A bracket slot is either a known participant, a bye (no opponent — the
// other side auto-advances), or "whoever wins another specific match".
type SlotSource = { type: "participant"; userId: number; username: string } | { type: "bye" } | { type: "winnerOf"; matchId: string };

type BuildMatch = {
  id: string;
  round: string;
  day: number;
  date: string;
  label: string;
  homeSource: SlotSource;
  awaySource: SlotSource;
};

function slotFor(participant: Participant | undefined): SlotSource {
  return participant ? { type: "participant", userId: participant.id, username: participant.username } : { type: "bye" };
}

function buildCup(db: DatabaseSync, id: number, dates: string[], participants: Participant[]): Omit<CupDefinition, "locked" | "unlocksOn"> {
  const shuffled = deterministicShuffle(participants, id * 2026);
  const rounds = roundLabels.map((label, index) => ({ day: index + 1, date: dates[index], label }));
  const matches: BuildMatch[] = [];

  matches.push({
    id: "playoff",
    round: "play-off",
    day: 1,
    date: rounds[0].date,
    label: "Play-off",
    homeSource: slotFor(shuffled[0]),
    awaySource: slotFor(shuffled[1])
  });

  // R16 slot 0 is "winner of the play-off"; slots 1-15 are the next 15
  // shuffled participants (a bye if the group is smaller than 17).
  const r16Rest = shuffled.slice(2, 17);
  const r16Sources: SlotSource[] = [{ type: "winnerOf", matchId: "playoff" }, ...Array.from({ length: 15 }, (_, i) => slotFor(r16Rest[i]))];
  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `r16-${i + 1}`,
      round: "round-of-16",
      day: 2,
      date: rounds[1].date,
      label: `R16 Match ${i + 1}`,
      homeSource: r16Sources[i * 2],
      awaySource: r16Sources[i * 2 + 1]
    });
  }

  addPlaceholderRound(matches, "quarter-finals", "qf", "r16", 3, rounds[2].date, "Quarter-final", 4);
  addPlaceholderRound(matches, "semi-finals", "sf", "qf", 4, rounds[3].date, "Semi-final", 2);
  addPlaceholderRound(matches, "final", "final", "sf", 5, rounds[4].date, "Final", 1);

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
    matches: resolveBracket(db, matches)
  };
}

function addPlaceholderRound(matches: BuildMatch[], round: string, idPrefix: string, prevIdPrefix: string, day: number, date: string, label: string, count: number) {
  for (let i = 0; i < count; i++) {
    matches.push({
      id: `${idPrefix}-${i + 1}`,
      round,
      day,
      date,
      label: `${label} ${count === 1 ? "" : i + 1}`.trim(),
      homeSource: { type: "winnerOf", matchId: `${prevIdPrefix}-${i * 2 + 1}` },
      awaySource: { type: "winnerOf", matchId: `${prevIdPrefix}-${i * 2 + 2}` }
    });
  }
}

type ResolvedSide = { display: string; userId: number | null; isBye: boolean };

function resolveSide(source: SlotSource, decided: Map<string, { username: string; userId: number }>): ResolvedSide {
  if (source.type === "participant") return { display: source.username, userId: source.userId, isBye: false };
  if (source.type === "bye") return { display: "Bye", userId: null, isBye: true };
  const winner = decided.get(source.matchId);
  return winner ? { display: winner.username, userId: winner.userId, isBye: false } : { display: "TBD", userId: null, isBye: false };
}

// Walks the bracket in round order, deciding each match the moment both
// sides are known real participants and that round's matchday has closed —
// using the exact same daily-score formula as the leaderboard's head-to-head.
// Byes auto-advance immediately without waiting for the date.
function resolveBracket(db: DatabaseSync, matches: BuildMatch[]): CupMatch[] {
  const decided = new Map<string, { username: string; userId: number }>();
  const results = new Map<string, CupMatch>();

  for (const match of matches) {
    const home = resolveSide(match.homeSource, decided);
    const away = resolveSide(match.awaySource, decided);

    let winner: { username: string; userId: number } | null = null;
    let status: CupMatch["status"] = "scheduled";
    let homeScore: number | null = null;
    let awayScore: number | null = null;

    if (home.isBye && !away.isBye && away.userId !== null) {
      winner = { username: away.display, userId: away.userId };
      status = "bye";
    } else if (away.isBye && !home.isBye && home.userId !== null) {
      winner = { username: home.display, userId: home.userId };
      status = "bye";
    } else if (home.userId !== null && away.userId !== null && isMatchdaySettled(match.date)) {
      const homeDaily = getDailyScore(db, home.userId, match.date);
      const awayDaily = getDailyScore(db, away.userId, match.date);
      homeScore = homeDaily.total;
      awayScore = awayDaily.total;
      const cmp = compareDailyScores(homeDaily, awayDaily);
      // Last-resort deterministic tie-break (identical total AND activity)
      // so a match never gets stuck unresolved: lower username wins.
      winner = cmp < 0 || (cmp === 0 && home.display.localeCompare(away.display) <= 0)
        ? { username: home.display, userId: home.userId }
        : { username: away.display, userId: away.userId };
      status = "decided";
    } else if (home.userId !== null && away.userId !== null && isMatchdayOpen(match.date)) {
      // Both sides known AND this date's window is the one currently open —
      // not a future round whose participants just happen to be known
      // already. Show the running score, but don't decide a winner yet.
      homeScore = getDailyScore(db, home.userId, match.date).total;
      awayScore = getDailyScore(db, away.userId, match.date).total;
      status = "live";
    }
    // Otherwise (both known but the window hasn't opened yet, e.g. a future
    // round) stays "scheduled" with no score — it isn't live just because
    // the draw already assigned real names to both slots.

    if (winner) decided.set(match.id, winner);

    results.set(match.id, {
      id: match.id,
      round: match.round,
      day: match.day,
      date: match.date,
      label: match.label,
      home: home.display,
      away: away.display,
      homeScore,
      awayScore,
      winner: winner?.username ?? null,
      status
    });
  }

  return matches.map((match) => results.get(match.id)!);
}

function deterministicShuffle<T>(values: T[], seed: number): T[] {
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
