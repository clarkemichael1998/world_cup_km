import type { DatabaseSync } from "node:sqlite";
import { getAdminUsernames } from "@/lib/server/admin";
import { awardPlayersInTransaction, createAdminChatMessage, getAllPlayers, getCupDraw, getCupMatchOverrides, getDb, setCupDraw } from "@/lib/server/db";
import { compareDailyScores, getDailyScore, isMatchdayOpen, isMatchdaySettled } from "@/lib/server/dailyScoring";
import { cupThemes, getCupLegendPlayer } from "@/lib/cupLegends";

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

export type MyCupStatus = {
  cupId: number;
  cupName: string;
  state: "champion" | "through" | "live" | "upcoming" | "eliminated";
  round: string;
  roundDate: string;
  opponent: string | null;
  myScore: number | null;
  opponentScore: number | null;
};

export type CupRewardSettlement = {
  cupId: number;
  cupName: string;
  rewardKey: string;
  rewardLabel: string;
  username: string;
  packCredits: number;
  iconAwarded: boolean;
  legendAwarded: boolean;
  applied: boolean;
};

// A player's current position across every unlocked cup — used by the home
// page so it's obvious who you're facing, your live score, and when your
// next deadline is, without digging into the bracket.
export function getMyCupStatuses(username: string): MyCupStatus[] {
  const data = getCupHubData();
  const results: MyCupStatus[] = [];

  for (const cup of data.cups) {
    if (cup.locked) continue;
    const myMatches = cup.matches.filter((match) => match.home === username || match.away === username).sort((a, b) => a.day - b.day);
    if (myMatches.length === 0) continue;

    const last = myMatches[myMatches.length - 1];
    const isHome = last.home === username;
    const opponentName = isHome ? last.away : last.home;
    const opponent = opponentName === "TBD" || opponentName === "Bye" ? null : opponentName;
    const myScore = isHome ? last.homeScore : last.awayScore;
    const opponentScore = isHome ? last.awayScore : last.homeScore;
    const isFinalRound = last.round === "final";

    let state: MyCupStatus["state"];
    let round = last.label;
    let roundDate = last.date;

    if (last.status === "decided" || last.status === "bye") {
      if (last.winner !== username) {
        state = "eliminated";
      } else if (isFinalRound) {
        state = "champion";
      } else {
        state = "through";
        const next = cup.rounds.find((r) => r.day === last.day + 1);
        if (next) {
          round = next.label;
          roundDate = next.date;
        }
      }
    } else if (last.status === "live") {
      state = "live";
    } else {
      state = "upcoming";
    }

    results.push({ cupId: cup.id, cupName: cup.name, state, round, roundDate, opponent, myScore, opponentScore });
  }

  return results;
}

export function settleCupRewards(cupId?: number): { awarded: CupRewardSettlement[]; alreadyAwarded: CupRewardSettlement[] } {
  const db = getDb();
  const participants = getCupParticipants(db);
  const userByUsername = new Map(participants.map((participant) => [participant.username, participant]));
  const awarded: CupRewardSettlement[] = [];
  const alreadyAwarded: CupRewardSettlement[] = [];

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [index, dates] of cupSchedules.entries()) {
      if (cupId !== undefined && index + 1 !== cupId) continue;
      const cup = buildCup(db, index + 1, dates, participants);
      const final = cup.matches.find((match) => match.round === "final");

      for (const match of cup.matches) {
        if (!isSettledMatch(match)) continue;

        if (match.id === "playoff" && match.winner) {
          pushSettlement(db, cup, match.winner, "playoff-winner", "Play-off winner", 10, null, awarded, alreadyAwarded, userByUsername);
        }

        if (match.round === "quarter-finals") {
          const loser = getMatchLoser(match);
          if (loser) pushSettlement(db, cup, loser, `qf-elim-${match.id}`, "Quarter-final elimination", 15, null, awarded, alreadyAwarded, userByUsername);
        }

        if (match.round === "semi-finals") {
          const loser = getMatchLoser(match);
          if (loser) pushSettlement(db, cup, loser, `sf-elim-${match.id}`, "Semi-final elimination", 25, null, awarded, alreadyAwarded, userByUsername);
        }
      }

      if (final && isSettledMatch(final) && final.winner) {
        const runnerUp = getMatchLoser(final);
        if (runnerUp) pushSettlement(db, cup, runnerUp, "runner-up", "Runner-up", 30, "icon", awarded, alreadyAwarded, userByUsername);
        pushSettlement(db, cup, final.winner, "winner", "Cup winner", 35, "legend", awarded, alreadyAwarded, userByUsername);
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  for (const row of awarded) {
    const extras = row.legendAwarded ? ` and the ${row.cupName} Legend card` : row.iconAwarded ? " and a guaranteed Icon card" : "";
    createAdminChatMessage(`🏆 ${row.cupName}: ${row.username} awarded ${row.packCredits} pack credits${extras} for ${row.rewardLabel}.`);
  }

  return { awarded, alreadyAwarded };
}

export function reverseCupRewardSettlement(cupId: number, createdDate: string, reason: string) {
  const db = getDb();
  const cleanReason = reason.trim().slice(0, 240) || "Cup reward settlement reversed by admin.";
  const rows = db
    .prepare(
      `SELECT cre.id, cre.cup_name, cre.user_id, users.username, cre.reward_key, cre.reward_label, cre.pack_credit_count
       FROM cup_reward_events cre
       JOIN users ON users.id = cre.user_id
       WHERE cre.cup_id = ?
         AND date(cre.created_at) = ?
         AND cre.reversed_at IS NULL
       ORDER BY cre.id`
    )
    .all(cupId, createdDate) as Array<{
      id: number;
      cup_name: string;
      user_id: number;
      username: string;
      reward_key: string;
      reward_label: string;
      pack_credit_count: number;
    }>;

  let creditsReversed = 0;
  let cardsReversed = 0;
  const users = new Set<string>();
  const cupName = rows[0]?.cup_name ?? cupThemes[cupId - 1]?.cupName ?? `Cup ${cupId}`;

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) {
      users.add(row.username);
      if (row.pack_credit_count > 0) {
        db.prepare("UPDATE users SET reward_credits = reward_credits - ? WHERE id = ?").run(row.pack_credit_count, row.user_id);
        creditsReversed += row.pack_credit_count;
      }

      const awards = db
        .prepare("SELECT id, player_id FROM card_awards WHERE source = 'cup_reward' AND source_id = ? ORDER BY position, id")
        .all(row.id) as Array<{ id: number; player_id: number }>;
      for (const award of awards) {
        removeOneOwnedPlayer(db, row.user_id, award.player_id);
        db.prepare("DELETE FROM card_awards WHERE id = ?").run(award.id);
        cardsReversed += 1;
      }

      db.prepare("UPDATE cup_reward_events SET reversed_at = CURRENT_TIMESTAMP, reversal_reason = ? WHERE id = ?").run(cleanReason, row.id);
    }

    db
      .prepare(
        `UPDATE chat_messages
         SET message = ?
         WHERE date(created_at) = ?
           AND message LIKE ?`
      )
      .run(`[Cup reward reversed] ${cupName} award message removed. Reason: ${cleanReason}`, createdDate, `%${cupName}:%awarded%`);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  if (rows.length > 0) {
    createAdminChatMessage(
      `${cupName} reward correction: reversed ${rows.length} reward row${rows.length === 1 ? "" : "s"} from ${createdDate}, removing ${creditsReversed} pack credits and ${cardsReversed} card award${cardsReversed === 1 ? "" : "s"}.`
    );
  }

  return {
    cupId,
    cupName,
    createdDate,
    reversedCount: rows.length,
    creditsReversed,
    cardsReversed,
    users: Array.from(users).sort()
  };
}

function removeOneOwnedPlayer(db: DatabaseSync, userId: number, playerId: number) {
  const owned = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(userId, playerId) as { duplicate_count: number } | undefined;
  if (!owned) return;
  if (owned.duplicate_count > 0) {
    db.prepare("UPDATE user_players SET duplicate_count = duplicate_count - 1 WHERE user_id = ? AND player_id = ?").run(userId, playerId);
  } else {
    db.prepare("DELETE FROM user_players WHERE user_id = ? AND player_id = ?").run(userId, playerId);
  }
}

function isSettledMatch(match: CupMatch) {
  return (match.status === "decided" || match.status === "bye") && Boolean(match.winner);
}

function getMatchLoser(match: CupMatch) {
  if (!match.winner) return null;
  if (match.home === match.winner) return isRealPlayerName(match.away) ? match.away : null;
  if (match.away === match.winner) return isRealPlayerName(match.home) ? match.home : null;
  return null;
}

function isRealPlayerName(value: string) {
  return value !== "TBD" && value !== "Bye";
}

function pushSettlement(
  db: DatabaseSync,
  cup: Omit<CupDefinition, "locked" | "unlocksOn">,
  username: string,
  rewardKey: string,
  rewardLabel: string,
  packCredits: number,
  cardPrize: "icon" | "legend" | null,
  awarded: CupRewardSettlement[],
  alreadyAwarded: CupRewardSettlement[],
  userByUsername: Map<string, Participant>
) {
  const user = userByUsername.get(username);
  if (!user) return;

  const cardIds = getCupPrizeCardIds(cup.id, cardPrize);
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO cup_reward_events (
        cup_id, cup_name, user_id, reward_key, reward_label,
        pack_credit_count, icon_count, legend_player_id, card_award_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      cup.id,
      cup.name,
      user.id,
      rewardKey,
      rewardLabel,
      packCredits,
      cardPrize === "icon" ? cardIds.length : 0,
      cardPrize === "legend" ? cardIds[0] ?? null : null,
      cardIds.length
    );

  const row: CupRewardSettlement = {
    cupId: cup.id,
    cupName: cup.name,
    rewardKey,
    rewardLabel,
    username,
    packCredits,
    iconAwarded: cardPrize === "icon" && cardIds.length > 0,
    legendAwarded: cardPrize === "legend" && cardIds.length > 0,
    applied: result.changes > 0
  };

  if (result.changes === 0) {
    alreadyAwarded.push(row);
    return;
  }

  const sourceId = Number(result.lastInsertRowid);
  if (packCredits > 0) db.prepare("UPDATE users SET reward_credits = reward_credits + ? WHERE id = ?").run(packCredits, user.id);
  if (cardIds.length > 0) awardPlayersInTransaction(db, user.id, cardIds, "cup_reward", sourceId);
  awarded.push(row);
}

function getCupPrizeCardIds(cupId: number, cardPrize: "icon" | "legend" | null) {
  if (!cardPrize) return [];
  if (cardPrize === "legend") {
    const legend = getCupLegendPlayer(cupId);
    return legend ? [legend.id] : [];
  }
  const icons = getAllPlayers().filter((player) => player.rarity === "icon" && !player.cupId);
  if (icons.length === 0) return [];
  const index = Math.floor(Math.random() * icons.length);
  return [icons[index].id];
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
  const today = getLondonToday();
  const startDate = dates[0];

  // Freeze the bracket draw once a cup has started so new/removed users
  // never cause rerandomisation on redeploy.
  let shuffled: Participant[];
  const storedDraw = getCupDraw(id);
  if (storedDraw) {
    const byUsername = new Map(participants.map((p) => [p.username, p]));
    shuffled = storedDraw.map((u) => byUsername.get(u)).filter((p): p is Participant => p !== undefined);
    // Any participant not in the frozen draw (joined after cup started) appended at end
    const storedSet = new Set(storedDraw);
    for (const p of participants) {
      if (!storedSet.has(p.username)) shuffled.push(p);
    }
  } else if (today >= startDate) {
    shuffled = deterministicShuffle(participants, id * 2026);
    setCupDraw(id, shuffled.map((p) => p.username));
  } else {
    shuffled = deterministicShuffle(participants, id * 2026);
  }

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
    matches: resolveBracket(db, matches, participants, id)
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
function resolveBracket(db: DatabaseSync, matches: BuildMatch[], participants: Participant[], cupId: number): CupMatch[] {
  const decided = new Map<string, { username: string; userId: number }>();
  const results = new Map<string, CupMatch>();
  const overrideRows = getCupMatchOverrides(cupId);
  const overrideMap = new Map(overrideRows.map((r) => [r.match_id, r]));
  const byUsername = new Map(participants.map((p) => [p.username, p]));

  for (const match of matches) {
    let home = resolveSide(match.homeSource, decided);
    let away = resolveSide(match.awaySource, decided);

    // Apply any admin-set participant overrides for this match
    const ov = overrideMap.get(match.id);
    if (ov) {
      if (ov.home_username) {
        const p = byUsername.get(ov.home_username);
        home = p ? { display: p.username, userId: p.id, isBye: false } : { display: ov.home_username, userId: null, isBye: false };
      }
      if (ov.away_username) {
        const p = byUsername.get(ov.away_username);
        away = p ? { display: p.username, userId: p.id, isBye: false } : { display: ov.away_username, userId: null, isBye: false };
      }
    }

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

    // Apply force_winner override — ensures the correct winner is recorded
    // even if bracket path was scrambled by a reseeding incident. If the
    // forced winner isn't currently one of the resolved sides, substitute
    // them into the home slot so the UI highlights them correctly.
    if (ov?.force_winner) {
      const fw = byUsername.get(ov.force_winner);
      if (fw) {
        if (home.display !== fw.username && away.display !== fw.username) {
          home = { display: fw.username, userId: fw.id, isBye: false };
        }
        winner = { username: fw.username, userId: fw.id };
        if (status === "scheduled") status = "decided";
      }
    }

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
