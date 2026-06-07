import { getAllPlayers, getDb, awardGoalBoost, getMatchedGoalScorers, getMatchedAssistScorers } from "./db";
import { getProviderStatus, type ProviderStatus } from "./fixtures";
import { GOAL_BOOST_BY_RARITY, ASSIST_BOOST_BY_RARITY, getPlayerById } from "./goalScorers";
import type { Player, SquadSlot } from "@/lib/types";

const tournamentStart = "2026-06-11";
const tournamentEnd = "2026-07-19";
const creditValue = 3;

export type LiveStatus = {
  tournamentActive: boolean;
  now: string;
  lockDate: string;
  lockAt: string;
  unlockAt: string;
  locked: boolean;
  rewardCredits: number;
  providerStatus: ProviderStatus;
  lockedSquad: Array<{ slot: SquadSlot; player: Player }>;
  finishedMatches: Array<{ matchId: string; homeTeam: string; awayTeam: string; winner: string | null; matchDate: string; verified: boolean }>;
  rewardEvents: Array<{ matchId: string; playerId: number; playerName: string; nation: string; credits: number }>;
  goalBoostEvents: Array<{ matchId: string; playerId: number; playerName: string; boostAmount: number }>;
  leaderboard: Array<{ username: string; averageRating: number; selectedCount: number }>;
};

export function getLiveStatus(userId: number, now = new Date()): LiveStatus {
  const window = londonLockWindow(now);
  const database = getDb();
  const playerMap = new Map<number, Player>(getAllPlayers().map((p) => [p.id, p]));
  const tournamentActive = window.lockDate >= tournamentStart && window.lockDate <= tournamentEnd;
  if (tournamentActive) {
    settleUserLiveAwards(userId);
  }

  const locked = database.prepare("SELECT id FROM locked_squads WHERE user_id = ? AND lock_date = ?").get(userId, window.lockDate) as { id: number } | undefined;
  const lockedRows = locked
    ? (database.prepare("SELECT slot, player_id FROM locked_squad_players WHERE locked_squad_id = ? ORDER BY slot").all(locked.id) as Array<{ slot: SquadSlot; player_id: number }>)
    : [];
  const lockedSquad = lockedRows
    .map((row) => ({ slot: row.slot, player: playerMap.get(row.player_id) }))
    .filter((row): row is { slot: SquadSlot; player: Player } => Boolean(row.player));

  const matches = database
    .prepare("SELECT match_id, match_date, home_team, away_team, winner, verified FROM fixture_results WHERE status = 'FINISHED' AND kickoff_at >= ? AND kickoff_at < ? ORDER BY kickoff_at")
    .all(window.lockAt.toISOString(), window.unlockAt.toISOString()) as Array<{ match_id: string; match_date: string; home_team: string; away_team: string; winner: string | null; verified: number }>;

  const rewardEvents = database
    .prepare("SELECT match_id, player_id, credits FROM reward_events WHERE user_id = ? AND locked_squad_id = ? ORDER BY created_at DESC")
    .all(userId, locked?.id ?? 0) as Array<{ match_id: string; player_id: number; credits: number }>;

  const goalBoostRows = database
    .prepare("SELECT player_id, match_id, boost_amount FROM goal_boosts WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Array<{ player_id: number; match_id: string; boost_amount: number }>;

  return {
    tournamentActive,
    now: now.toISOString(),
    lockDate: window.lockDate,
    lockAt: window.lockAt.toISOString(),
    unlockAt: window.unlockAt.toISOString(),
    locked: Boolean(locked),
    rewardCredits: ((database.prepare("SELECT reward_credits FROM users WHERE id = ?").get(userId) as { reward_credits: number })?.reward_credits ?? 0),
    providerStatus: getProviderStatus(),
    lockedSquad,
    finishedMatches: matches.map((match) => ({
      matchId: match.match_id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      winner: match.winner,
      matchDate: match.match_date,
      verified: match.verified === 1
    })),
    rewardEvents: rewardEvents.map((event) => {
      const player = playerMap.get(event.player_id);
      return {
        matchId: event.match_id,
        playerId: event.player_id,
        playerName: player?.name ?? `Player ${event.player_id}`,
        nation: player?.nation ?? "Unknown",
        credits: event.credits
      };
    }),
    goalBoostEvents: goalBoostRows.map((row) => {
      const player = playerMap.get(row.player_id);
      return {
        matchId: row.match_id,
        playerId: row.player_id,
        playerName: player?.name ?? `Player ${row.player_id}`,
        boostAmount: row.boost_amount
      };
    }),
    leaderboard: getBestOwnedSquadLeaderboard(playerMap)
  };
}

export function settleAllLiveAwards() {
  const rows = getDb().prepare("SELECT id FROM users").all() as Array<{ id: number }>;
  for (const row of rows) {
    settleUserLiveAwards(row.id);
  }
  return { usersSettled: rows.length };
}

function settleUserLiveAwards(userId: number) {
  awardResultCredits(userId);
  awardGoalBoosts(userId);
}

function getBestOwnedSquadLeaderboard(playerMap: Map<number, Player>) {
  const rows = getDb()
    .prepare(
      `SELECT users.username, user_players.player_id
       FROM user_players
       JOIN users ON users.id = user_players.user_id`
    )
    .all() as Array<{ username: string; player_id: number }>;
  const byUser = new Map<string, number[]>();

  for (const row of rows) {
    const list = byUser.get(row.username) ?? [];
    list.push(row.player_id);
    byUser.set(row.username, list);
  }

  return Array.from(byUser.entries())
    .map(([username, ids]) => {
      const bestXi = pickBestFormation(ids, playerMap);
      const ratings = bestXi.map((player) => player.rating);
      return {
        username,
        selectedCount: bestXi.length,
        averageRating: ratings.length > 0 ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : 0
      };
    })
    .sort((a, b) => b.averageRating - a.averageRating || b.selectedCount - a.selectedCount || a.username.localeCompare(b.username))
    .slice(0, 20);
}

function pickBestFormation(playerIds: number[], playerMap: Map<number, Player>) {
  const owned = playerIds
    .map((id) => playerMap.get(id))
    .filter((player): player is Player => Boolean(player));
  const used = new Set<number>();
  const requiredPositions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
  const picked: Player[] = [];

  for (const position of requiredPositions) {
    const player = owned
      .filter((candidate) => candidate.pos === position && !used.has(candidate.id))
      .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))[0];
    if (player) {
      used.add(player.id);
      picked.push(player);
    }
  }

  return picked;
}

function awardResultCredits(userId: number) {
  const database = getDb();
  const allLocked = database
    .prepare("SELECT id, locked_at, unlock_at FROM locked_squads WHERE user_id = ?")
    .all(userId) as Array<{ id: number; locked_at: string; unlock_at: string }>;

  const insertReward = database.prepare("INSERT OR IGNORE INTO reward_events (user_id, locked_squad_id, match_id, player_id, credits) VALUES (?, ?, ?, ?, ?)");
  const incrementUser = database.prepare("UPDATE users SET reward_credits = reward_credits + ? WHERE id = ?");

  for (const locked of allLocked) {
    const matches = database
      .prepare("SELECT match_id, winner FROM fixture_results WHERE status = 'FINISHED' AND verified = 1 AND winner IS NOT NULL AND kickoff_at >= ? AND kickoff_at < ?")
      .all(locked.locked_at, locked.unlock_at) as Array<{ match_id: string; winner: string }>;
    const lockedPlayers = database.prepare("SELECT player_id, nation FROM locked_squad_players WHERE locked_squad_id = ?").all(locked.id) as Array<{ player_id: number; nation: string }>;

    for (const match of matches) {
      for (const player of lockedPlayers) {
        if (player.nation !== match.winner) continue;
        const result = insertReward.run(userId, locked.id, match.match_id, player.player_id, creditValue);
        if (result.changes > 0) incrementUser.run(creditValue, userId);
      }
    }
  }
}

function awardGoalBoosts(userId: number) {
  const database = getDb();

  // Scan ALL past locked squads for this user so retroactive admin resolutions are applied
  const allLocked = database
    .prepare("SELECT id, locked_at, unlock_at FROM locked_squads WHERE user_id = ?")
    .all(userId) as Array<{ id: number; locked_at: string; unlock_at: string }>;

  for (const locked of allLocked) {
    const matches = database
      .prepare("SELECT match_id FROM fixture_results WHERE status = 'FINISHED' AND verified = 1 AND kickoff_at >= ? AND kickoff_at < ?")
      .all(locked.locked_at, locked.unlock_at) as Array<{ match_id: string }>;

    const lockedPlayerIds = new Set(
      (database.prepare("SELECT player_id FROM locked_squad_players WHERE locked_squad_id = ?").all(locked.id) as Array<{ player_id: number }>).map((r) => r.player_id)
    );

    for (const match of matches) {
      const scorers = getMatchedGoalScorers(match.match_id);
      for (const { playerId, goalCount } of scorers) {
        if (!lockedPlayerIds.has(playerId)) continue;
        const player = getPlayerById(playerId);
        if (!player) continue;
        const boostPerGoal = GOAL_BOOST_BY_RARITY[player.rarity] ?? 0;
        if (boostPerGoal !== 0) awardGoalBoost(userId, playerId, match.match_id, boostPerGoal * goalCount);
      }

      const assisters = getMatchedAssistScorers(match.match_id);
      for (const { playerId, assistCount } of assisters) {
        if (!lockedPlayerIds.has(playerId)) continue;
        const player = getPlayerById(playerId);
        if (!player) continue;
        const boostPerAssist = ASSIST_BOOST_BY_RARITY[player.rarity] ?? 0;
        if (boostPerAssist !== 0) awardGoalBoost(userId, playerId, `${match.match_id}:assist`, boostPerAssist * assistCount);
      }
    }
  }
}

function londonLockWindow(now: Date) {
  const londonParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const parts = Object.fromEntries(londonParts.map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const lockDate = currentMinutes >= 11 * 60 ? today : addDays(today, -1);
  const nextDate = addDays(lockDate, 1);

  return {
    lockDate,
    lockAt: zonedLondonDate(lockDate, 11),
    unlockAt: zonedLondonDate(nextDate, 11)
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function zonedLondonDate(date: string, hour: number) {
  const utcGuess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false
    }).format(utcGuess)
  );
  const offsetHours = londonHour - hour;
  return new Date(utcGuess.getTime() - offsetHours * 60 * 60 * 1000);
}
