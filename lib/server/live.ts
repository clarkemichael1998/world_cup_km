import { getAllPlayers, getDb, awardGoalBoost, lockSquadForDate, claimBoostAnnouncement, createAdminChatMessage, getCollectionBoostMapForPlayerIds } from "./db";
import { getProviderStatus, type ProviderStatus } from "./fixtures";
import { GOAL_BOOST_BY_RARITY, ASSIST_BOOST_BY_RARITY, getPlayerById } from "./goalScorers";
import type { Player, SquadSlot } from "@/lib/types";
import { londonLockWindow, londonLockWindowForDate } from "./matchday";

const tournamentStart = "2026-06-11";
const tournamentEnd = "2026-07-19";
// Semis matchday starts 3pm London Jul 12 = 14:00 UTC — double goals/assists from here on
const DOUBLE_POINTS_FROM = "2026-07-12T14:00:00.000Z";
const creditValue = 1;

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
  normalizeLockedSquadWindows();
  const rows = getDb().prepare("SELECT id FROM users").all() as Array<{ id: number }>;
  for (const row of rows) {
    settleUserLive(row.id);
  }
  const reconciledBoosts = reconcileMissingGoalBoosts();
  // Announce only after every eligible user above has been awarded, so the
  // message lists every recipient rather than just whoever was processed first.
  announcePendingBoosts();
  return { usersSettled: rows.length, reconciledBoosts };
}

// Settle entry point for any authenticated request: auto-locks the current
// window from the draft squad if the user never pressed Lock, then settles.
export function settleUserLive(userId: number, now = new Date()) {
  const window = londonLockWindow(now);
  const tournamentActive = window.lockDate >= tournamentStart && window.lockDate <= tournamentEnd;
  if (!tournamentActive) return;
  ensureCurrentWindowLock(userId, now);
  normalizeLockedSquadWindows(userId);
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
  lockSquadForDate(userId, window.lockDate, window.lockAt.toISOString(), window.unlockAt.toISOString());
}

function normalizeLockedSquadWindows(userId?: number) {
  const database = getDb();
  const rows = userId == null
    ? (database.prepare("SELECT id, lock_date, locked_at, unlock_at FROM locked_squads").all() as Array<{ id: number; lock_date: string; locked_at: string; unlock_at: string }>)
    : (database.prepare("SELECT id, lock_date, locked_at, unlock_at FROM locked_squads WHERE user_id = ?").all(userId) as Array<{ id: number; lock_date: string; locked_at: string; unlock_at: string }>);
  const update = database.prepare("UPDATE locked_squads SET locked_at = ?, unlock_at = ? WHERE id = ?");
  for (const row of rows) {
    const window = londonLockWindowForDate(row.lock_date);
    const lockedAt = window.lockAt.toISOString();
    const unlockAt = window.unlockAt.toISOString();
    if (row.locked_at !== lockedAt || row.unlock_at !== unlockAt) update.run(lockedAt, unlockAt, row.id);
  }
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
    .prepare("SELECT id, match_id, player_id, goal_count FROM goal_scorers WHERE status = 'matched' AND player_id IS NOT NULL ORDER BY id")
    .all() as Array<{ id: number; match_id: string; player_id: number; goal_count: number }>;
  const assists = database
    .prepare("SELECT id, match_id, player_id, assist_count FROM assist_scorers WHERE status = 'matched' AND player_id IS NOT NULL ORDER BY id")
    .all() as Array<{ id: number; match_id: string; player_id: number; assist_count: number }>;
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
  const goalSignature = goals.map((goal) => `${goal.id}.${goal.match_id}.${goal.player_id}.${goal.goal_count}`).join(",");
  const assistSignature = assists.map((assist) => `${assist.id}.${assist.match_id}.${assist.player_id}.${assist.assist_count}`).join(",");
  // Version prefix: bump to force a one-time re-settle for all users after a
  // settlement-logic change (e.g. boosts now apply to draws/losses).
  return `v6|f${fixtures.c}@${fixtures.m}|g${goalSignature}|a${assistSignature}|s${squadSignature}`;
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
      const collectionBoosts = getCollectionBoostMapForPlayerIds(ids);
      const bestXi = pickBestFormation(ids, playerMap, collectionBoosts);
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

function pickBestFormation(playerIds: number[], playerMap: Map<number, Player>, collectionBoosts: Map<number, number>) {
  const owned = playerIds
    .map((id) => playerMap.get(id))
    .filter((player): player is Player => Boolean(player));
  const used = new Set<number>();
  const requiredPositions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
  const picked: Player[] = [];

  for (const position of requiredPositions) {
    const player = owned
      .filter((candidate) => candidate.pos === position && !used.has(candidate.id))
      .sort((a, b) => b.rating + (collectionBoosts.get(b.id) ?? 0) - (a.rating + (collectionBoosts.get(a.id) ?? 0)) || a.name.localeCompare(b.name))[0];
    if (player) {
      used.add(player.id);
      picked.push({ ...player, rating: player.rating + (collectionBoosts.get(player.id) ?? 0) });
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
  const goalRows = database
    .prepare(
      `SELECT gs.match_id, gs.player_id, gs.goal_count, fr.kickoff_at
       FROM goal_scorers gs
       JOIN fixture_results fr ON fr.match_id = gs.match_id
       WHERE gs.status = 'matched'
         AND gs.player_id IS NOT NULL
         AND fr.status = 'FINISHED'`
    )
    .all() as Array<{ match_id: string; player_id: number; goal_count: number; kickoff_at: string }>;
  const assistRows = database
    .prepare(
      `SELECT as2.match_id, as2.player_id, as2.assist_count, fr.kickoff_at
       FROM assist_scorers as2
       JOIN fixture_results fr ON fr.match_id = as2.match_id
       WHERE as2.status = 'matched'
         AND as2.player_id IS NOT NULL
         AND fr.status = 'FINISHED'`
    )
    .all() as Array<{ match_id: string; player_id: number; assist_count: number; kickoff_at: string }>;

  for (const locked of allLocked) {
    const lockedPlayerIds = new Set(
      (database.prepare("SELECT player_id FROM locked_squad_players WHERE locked_squad_id = ?").all(locked.id) as Array<{ player_id: number }>).map((r) => r.player_id)
    );

    // Boosts apply for goals/assists in any FINISHED match inside this lock
    // window. A draw or loss still counts, so do not require verified/winner.
    for (const row of goalRows) {
      if (row.kickoff_at < locked.locked_at || row.kickoff_at >= locked.unlock_at) continue;
      if (!lockedPlayerIds.has(row.player_id)) continue;
      const player = getPlayerById(row.player_id);
      if (!player) continue;
      const boostPerGoal = GOAL_BOOST_BY_RARITY[player.rarity] ?? 0;
      if (boostPerGoal !== 0) {
        const multiplier = row.kickoff_at >= DOUBLE_POINTS_FROM ? 2 : 1;
        awardGoalBoost(userId, row.player_id, row.match_id, boostPerGoal * row.goal_count * multiplier);
      }
    }

    for (const row of assistRows) {
      if (row.kickoff_at < locked.locked_at || row.kickoff_at >= locked.unlock_at) continue;
      if (!lockedPlayerIds.has(row.player_id)) continue;
      const player = getPlayerById(row.player_id);
      if (!player) continue;
      const boostPerAssist = ASSIST_BOOST_BY_RARITY[player.rarity] ?? 0;
      if (boostPerAssist !== 0) {
        const multiplier = row.kickoff_at >= DOUBLE_POINTS_FROM ? 2 : 1;
        awardGoalBoost(userId, row.player_id, `${row.match_id}:assist`, boostPerAssist * row.assist_count * multiplier);
      }
    }
  }
}

function reconcileMissingGoalBoosts() {
  const database = getDb();
  const players = new Map(getAllPlayers().map((player) => [player.id, player]));
  let applied = 0;

  const goalCandidates = database
    .prepare(
      `SELECT ls.user_id, lsp.player_id, gs.match_id, gs.goal_count, fr.kickoff_at
       FROM locked_squads ls
       JOIN locked_squad_players lsp ON lsp.locked_squad_id = ls.id
       JOIN goal_scorers gs ON gs.player_id = lsp.player_id
       JOIN fixture_results fr ON fr.match_id = gs.match_id
       WHERE gs.status = 'matched'
         AND gs.player_id IS NOT NULL
         AND fr.status = 'FINISHED'
         AND fr.kickoff_at >= ls.locked_at
         AND fr.kickoff_at < ls.unlock_at`
    )
    .all() as Array<{ user_id: number; player_id: number; match_id: string; goal_count: number; kickoff_at: string }>;

  const assistCandidates = database
    .prepare(
      `SELECT ls.user_id, lsp.player_id, as2.match_id, as2.assist_count, fr.kickoff_at
       FROM locked_squads ls
       JOIN locked_squad_players lsp ON lsp.locked_squad_id = ls.id
       JOIN assist_scorers as2 ON as2.player_id = lsp.player_id
       JOIN fixture_results fr ON fr.match_id = as2.match_id
       WHERE as2.status = 'matched'
         AND as2.player_id IS NOT NULL
         AND fr.status = 'FINISHED'
         AND fr.kickoff_at >= ls.locked_at
         AND fr.kickoff_at < ls.unlock_at`
    )
    .all() as Array<{ user_id: number; player_id: number; match_id: string; assist_count: number; kickoff_at: string }>;

  for (const row of goalCandidates) {
    const player = players.get(row.player_id);
    if (!player) continue;
    const multiplier = row.kickoff_at >= DOUBLE_POINTS_FROM ? 2 : 1;
    const amount = (GOAL_BOOST_BY_RARITY[player.rarity] ?? 0) * row.goal_count * multiplier;
    if (amount === 0) continue;
    if (awardGoalBoost(row.user_id, row.player_id, row.match_id, amount)) applied++;
  }

  for (const row of assistCandidates) {
    const player = players.get(row.player_id);
    if (!player) continue;
    const multiplier = row.kickoff_at >= DOUBLE_POINTS_FROM ? 2 : 1;
    const amount = (ASSIST_BOOST_BY_RARITY[player.rarity] ?? 0) * row.assist_count * multiplier;
    if (amount === 0) continue;
    if (awardGoalBoost(row.user_id, row.player_id, `${row.match_id}:assist`, amount)) applied++;
  }

  return applied;
}

// Final pass after ALL recipients for this settlement run have already been
// inserted (so the announcement lists everyone, not just whoever happened to
// be processed first). Only fires once per (match, player, event) ever,
// and only for combos that actually have at least one locked recipient.
function announcePendingBoosts() {
  const database = getDb();
  const players = new Map(getAllPlayers().map((player) => [player.id, player]));

  const goalRows = database
    .prepare(
      `SELECT gs.match_id, gs.player_id, gs.goal_count
       FROM goal_scorers gs
       WHERE gs.status = 'matched' AND gs.player_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM goal_boosts gb WHERE gb.match_id = gs.match_id AND gb.player_id = gs.player_id)
         AND NOT EXISTS (SELECT 1 FROM boost_announcements ba WHERE ba.match_id = gs.match_id AND ba.player_id = gs.player_id AND ba.event_type = 'goal')`
    )
    .all() as Array<{ match_id: string; player_id: number; goal_count: number }>;

  const assistRows = database
    .prepare(
      `SELECT as2.match_id, as2.player_id, as2.assist_count
       FROM assist_scorers as2
       WHERE as2.status = 'matched' AND as2.player_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM goal_boosts gb WHERE gb.match_id = as2.match_id || ':assist' AND gb.player_id = as2.player_id)
         AND NOT EXISTS (SELECT 1 FROM boost_announcements ba WHERE ba.match_id = as2.match_id AND ba.player_id = as2.player_id AND ba.event_type = 'assist')`
    )
    .all() as Array<{ match_id: string; player_id: number; assist_count: number }>;

  for (const row of goalRows) {
    const player = players.get(row.player_id);
    if (!player) continue;
    const amount = (GOAL_BOOST_BY_RARITY[player.rarity] ?? 0) * row.goal_count;
    if (amount === 0) continue;
    announceBoost(row.match_id, player, amount, row.goal_count, "goal");
  }

  for (const row of assistRows) {
    const player = players.get(row.player_id);
    if (!player) continue;
    const amount = (ASSIST_BOOST_BY_RARITY[player.rarity] ?? 0) * row.assist_count;
    if (amount === 0) continue;
    announceBoost(row.match_id, player, amount, row.assist_count, "assist");
  }
}

// Announced once game-wide per (match, player, event) — the boost amount is
// rarity-based and identical for every user who locked the player. The "⚡UPGRADE"
// / "🤡CLOWN" markers are detected by the chat to give these their own styling.
function announceBoost(matchId: string, player: Player, boost: number, count: number, type: "goal" | "assist") {
  if (!claimBoostAnnouncement(matchId, player.id, type)) return;

  const recipientMatchId = type === "assist" ? `${matchId}:assist` : matchId;
  const recipients = (getDb()
    .prepare("SELECT users.username FROM goal_boosts gb JOIN users ON users.id = gb.user_id WHERE gb.player_id = ? AND gb.match_id = ? ORDER BY users.username")
    .all(player.id, recipientMatchId) as Array<{ username: string }>).map((row) => row.username);
  // Locked-squad gating means this can never be empty in practice, but stay
  // silent rather than announce a boost that applied to no one.
  if (recipients.length === 0) return;

  const who = ` Boosted: ${recipients.join(", ")}.`;
  const feat = featPhrase(count, type);
  const base = player.rating;
  const after = base + boost;
  if (boost > 0) {
    createAdminChatMessage(`⚡ UPGRADE · ${player.name} ${feat}! +${boost} on his card: ${base} → ${after} 📈${who}`);
  } else {
    createAdminChatMessage(`🤡 CLOWN TAX · ${player.name} ${feat} — ${boost} on his card: ${base} → ${after} 📉${who}`);
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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
