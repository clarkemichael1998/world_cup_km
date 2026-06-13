import { getAllPlayers, getDb, awardGoalBoost, getMatchedGoalScorers, getMatchedAssistScorers, lockSquadForDate, claimBoostAnnouncement, createAdminChatMessage } from "./db";
import { getProviderStatus, type ProviderStatus } from "./fixtures";
import { GOAL_BOOST_BY_RARITY, ASSIST_BOOST_BY_RARITY, getPlayerById } from "./goalScorers";
import type { Player, SquadSlot } from "@/lib/types";

const tournamentStart = "2026-06-11";
const tournamentEnd = "2026-07-19";
const creditValue = 1;
const LOCK_HOUR = 15; // 3pm UK time

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
    ensureCurrentWindowLock(userId, now);
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
    settleUserLive(row.id);
  }
  return { usersSettled: rows.length };
}

// Settle entry point for any authenticated request: auto-locks the current
// window from the draft squad if the user never pressed Lock, then settles.
export function settleUserLive(userId: number, now = new Date()) {
  const window = londonLockWindow(now);
  const tournamentActive = window.lockDate >= tournamentStart && window.lockDate <= tournamentEnd;
  if (!tournamentActive) return;
  ensureCurrentWindowLock(userId, now);
  settleUserLiveAwards(userId);
}

// The matchday that finished most recently — its winner gets the news-reel prize.
export function getPreviousMatchday(now = new Date()): string {
  return addDays(londonLockWindow(now).lockDate, -1);
}

function ensureCurrentWindowLock(userId: number, now: Date) {
  const window = londonLockWindow(now);
  const database = getDb();
  const existing = database.prepare("SELECT id FROM locked_squads WHERE user_id = ? AND lock_date = ?").get(userId, window.lockDate);
  if (existing) return;
  // Auto-lock from the draft squad. locked_at is the auto-lock creation time
  // (not the 3pm window start), so matches that kicked off before the user
  // first showed up today cannot be claimed by editing the draft afterwards.
  const lockedAt = now > window.lockAt ? now : window.lockAt;
  lockSquadForDate(userId, window.lockDate, lockedAt.toISOString(), window.unlockAt.toISOString());
}

function settleUserLiveAwards(userId: number) {
  const database = getDb();
  // Cheap change-detection: skip the full rescan unless results, scorer
  // resolutions, or this user's locked squads changed since the last settle.
  const settleKey = computeSettleKey(database, userId);
  const row = database.prepare("SELECT live_settle_key FROM user_state WHERE user_id = ?").get(userId) as { live_settle_key: string | null } | undefined;
  if (row?.live_settle_key === settleKey) return;

  awardResultCredits(userId);
  awardGoalBoosts(userId);
  database.prepare("UPDATE user_state SET live_settle_key = ? WHERE user_id = ?").run(settleKey, userId);
}

function computeSettleKey(database: ReturnType<typeof getDb>, userId: number): string {
  const fixtures = database
    .prepare("SELECT COUNT(*) AS c, COALESCE(MAX(updated_at), '') AS m FROM fixture_results WHERE status = 'FINISHED'")
    .get() as { c: number; m: string };
  const goals = database
    .prepare("SELECT COUNT(*) AS c, COALESCE(SUM(id), 0) AS s, COALESCE(SUM(goal_count), 0) AS n FROM goal_scorers WHERE status = 'matched' AND player_id IS NOT NULL")
    .get() as { c: number; s: number; n: number };
  const assists = database
    .prepare("SELECT COUNT(*) AS c, COALESCE(SUM(id), 0) AS s, COALESCE(SUM(assist_count), 0) AS n FROM assist_scorers WHERE status = 'matched' AND player_id IS NOT NULL")
    .get() as { c: number; s: number; n: number };
  const squads = database
    .prepare("SELECT id, locked_at, unlock_at FROM locked_squads WHERE user_id = ? ORDER BY id")
    .all(userId) as Array<{ id: number; locked_at: string; unlock_at: string }>;
  const squadPlayers = database
    .prepare(
      `SELECT lsp.locked_squad_id, lsp.slot, lsp.player_id
       FROM locked_squad_players lsp
       JOIN locked_squads ls ON ls.id = lsp.locked_squad_id
       WHERE ls.user_id = ?
       ORDER BY lsp.locked_squad_id, lsp.slot`
    )
    .all(userId) as Array<{ locked_squad_id: number; slot: string; player_id: number }>;
  const squadSignature = [
    ...squads.map((squad) => `${squad.id}@${squad.locked_at}-${squad.unlock_at}`),
    ...squadPlayers.map((player) => `${player.locked_squad_id}.${player.slot}.${player.player_id}`)
  ].join(",");
  // Version prefix: bump to force a one-time re-settle for all users after a
  // settlement-logic change (e.g. boosts now apply to draws/losses).
  return `v3|f${fixtures.c}@${fixtures.m}|g${goals.c}.${goals.s}.${goals.n}|a${assists.c}.${assists.s}.${assists.n}|s${squadSignature}`;
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

  database.exec("BEGIN IMMEDIATE");
  try {
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
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function awardGoalBoosts(userId: number) {
  const database = getDb();

  // Scan ALL past locked squads for this user so retroactive admin resolutions are applied
  const allLocked = database
    .prepare("SELECT id, locked_at, unlock_at FROM locked_squads WHERE user_id = ?")
    .all(userId) as Array<{ id: number; locked_at: string; unlock_at: string }>;

  for (const locked of allLocked) {
    // Boosts apply for goals/assists in any FINISHED match — a draw or loss
    // still counts (verified is only set for wins, so don't require it here).
    const matches = database
      .prepare("SELECT match_id FROM fixture_results WHERE status = 'FINISHED' AND kickoff_at >= ? AND kickoff_at < ?")
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
        if (boostPerGoal !== 0 && awardGoalBoost(userId, playerId, match.match_id, boostPerGoal * goalCount)) {
          announceBoost(match.match_id, player, boostPerGoal * goalCount, goalCount, "goal");
        }
      }

      const assisters = getMatchedAssistScorers(match.match_id);
      for (const { playerId, assistCount } of assisters) {
        if (!lockedPlayerIds.has(playerId)) continue;
        const player = getPlayerById(playerId);
        if (!player) continue;
        const boostPerAssist = ASSIST_BOOST_BY_RARITY[player.rarity] ?? 0;
        if (boostPerAssist !== 0 && awardGoalBoost(userId, playerId, `${match.match_id}:assist`, boostPerAssist * assistCount)) {
          announceBoost(match.match_id, player, boostPerAssist * assistCount, assistCount, "assist");
        }
      }
    }
  }
}

// Announced once game-wide per (match, player, event) — the boost amount is
// rarity-based and identical for every user who locked the player. The "⚡UPGRADE"
// / "🤡CLOWN" markers are detected by the chat to give these their own styling.
function announceBoost(matchId: string, player: Player, boost: number, count: number, type: "goal" | "assist") {
  if (!claimBoostAnnouncement(matchId, player.id, type)) return;
  const feat = featPhrase(count, type);
  const base = player.rating;
  const after = base + boost;
  if (boost > 0) {
    createAdminChatMessage(`⚡ UPGRADE · ${player.name} ${feat}! +${boost} on his card: ${base} → ${after} 📈`);
  } else {
    createAdminChatMessage(`🤡 CLOWN TAX · ${player.name} ${feat} — ${boost} on his card: ${base} → ${after} 📉`);
  }
}

function featPhrase(count: number, type: "goal" | "assist"): string {
  if (type === "goal") {
    if (count === 1) return "scored";
    if (count === 2) return "bagged a brace";
    if (count === 3) return "scored a hat-trick";
    return `scored ${count}`;
  }
  if (count === 1) return "grabbed an assist";
  if (count === 2) return "laid on two assists";
  if (count === 3) return "set up three goals";
  return `set up ${count} goals`;
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
  const lockDate = currentMinutes >= LOCK_HOUR * 60 ? today : addDays(today, -1);
  const nextDate = addDays(lockDate, 1);

  return {
    lockDate,
    lockAt: zonedLondonDate(lockDate, LOCK_HOUR),
    unlockAt: zonedLondonDate(nextDate, LOCK_HOUR)
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
