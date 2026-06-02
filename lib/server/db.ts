import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { DatabaseSync } from "node:sqlite";
import players from "@/data/players.json";
import type { ActivityType, SquadSlot } from "@/lib/types";

const dbDir = path.join(process.cwd(), "data");
const dbPath = process.env.SQLITE_DB_PATH ?? path.join(dbDir, "km-footy.sqlite");
const sessionCookie = "km_footy_session";

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  reward_credits: number;
};

export type CurrentUser = {
  id: number;
  username: string;
  rewardCredits: number;
};

let db: DatabaseSync | null = null;

export function getDb() {
  if (db) return db;
  mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      reward_credits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS draft_squad_players (
      user_id INTEGER NOT NULL,
      slot TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, slot),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS user_state (
      user_id INTEGER PRIMARY KEY,
      total_km REAL NOT NULL DEFAULT 0,
      km_balance REAL NOT NULL DEFAULT 0,
      daily_credits_granted_date TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS user_players (
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, player_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS reveal_players (
      user_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, position),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS locked_squads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      lock_date TEXT NOT NULL,
      locked_at TEXT NOT NULL,
      unlock_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, lock_date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS locked_squad_players (
      locked_squad_id INTEGER NOT NULL,
      slot TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      nation TEXT NOT NULL,
      PRIMARY KEY (locked_squad_id, slot),
      FOREIGN KEY (locked_squad_id) REFERENCES locked_squads(id)
    );
    CREATE TABLE IF NOT EXISTS fixture_results (
      match_id TEXT PRIMARY KEY,
      match_date TEXT NOT NULL,
      kickoff_at TEXT NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      winner TEXT,
      status TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed',
      verified INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS fixture_provider_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS reward_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      locked_squad_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      credits INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, locked_squad_id, match_id, player_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (locked_squad_id) REFERENCES locked_squads(id)
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS chat_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(message_id, user_id, reaction),
      FOREIGN KEY (message_id) REFERENCES chat_messages(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS km_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      distance_km REAL NOT NULL,
      activity_type TEXT NOT NULL DEFAULT 'walk',
      activity_amount REAL,
      activity_unit TEXT,
      comment TEXT,
      reward_credit_value REAL,
      balance_before REAL,
      balance_after REAL,
      chat_message_id INTEGER,
      voided_at TEXT,
      voided_by INTEGER,
      void_reason TEXT,
      cards_earned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS km_log_awards (
      log_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      PRIMARY KEY (log_id, position),
      FOREIGN KEY (log_id) REFERENCES km_log(id)
    );
    CREATE TABLE IF NOT EXISTS goal_scorers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      scorer_name_raw TEXT NOT NULL,
      player_id INTEGER,
      goal_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'auto',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(match_id, scorer_name_raw)
    );
    CREATE TABLE IF NOT EXISTS assist_scorers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      scorer_name_raw TEXT NOT NULL,
      player_id INTEGER,
      assist_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'auto',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(match_id, scorer_name_raw)
    );
    CREATE TABLE IF NOT EXISTS goal_boosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      boost_amount INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, player_id, match_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  migrateKmLogActivity(db);
  migrateFixtureResults(db);
  migrateUserState(db);
  migrateGoalScorers(db);
  seedFixtureResults(db);
  return db;
}

function migrateKmLogActivity(database: DatabaseSync) {
  for (const statement of [
    "ALTER TABLE km_log ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'walk'",
    "ALTER TABLE km_log ADD COLUMN activity_amount REAL",
    "ALTER TABLE km_log ADD COLUMN activity_unit TEXT",
    "ALTER TABLE km_log ADD COLUMN comment TEXT",
    "ALTER TABLE km_log ADD COLUMN reward_credit_value REAL",
    "ALTER TABLE km_log ADD COLUMN balance_before REAL",
    "ALTER TABLE km_log ADD COLUMN balance_after REAL",
    "ALTER TABLE km_log ADD COLUMN chat_message_id INTEGER",
    "ALTER TABLE km_log ADD COLUMN voided_at TEXT",
    "ALTER TABLE km_log ADD COLUMN voided_by INTEGER",
    "ALTER TABLE km_log ADD COLUMN void_reason TEXT"
  ]) {
    try {
      database.exec(statement);
    } catch {
      // Existing databases already have this column.
    }
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, "hex");
  return storedBuffer.length === candidate.length && timingSafeEqual(storedBuffer, candidate);
}

export function createOrGetUser(username: string, password: string): UserRow | null {
  const database = getDb();
  const normalized = username.trim().toLowerCase();
  const existing = database.prepare("SELECT * FROM users WHERE username = ?").get(normalized) as UserRow | undefined;
  if (existing) return verifyPassword(password, existing.password_hash) ? existing : null;

  const passwordHash = hashPassword(password);
  database.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(normalized, passwordHash);
  return database.prepare("SELECT * FROM users WHERE username = ?").get(normalized) as UserRow;
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  getDb().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires.toISOString());
  (await cookies()).set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires
  });
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(sessionCookie)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  store.delete(sessionCookie);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT users.id, users.username, users.reward_credits
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as { id: number; username: string; reward_credits: number } | undefined;
  return row ? { id: row.id, username: row.username, rewardCredits: row.reward_credits } : null;
}

export function saveDraftSquad(userId: number, squad: Partial<Record<SquadSlot, number>>) {
  const database = getDb();
  database.prepare("DELETE FROM draft_squad_players WHERE user_id = ?").run(userId);
  const insert = database.prepare("INSERT INTO draft_squad_players (user_id, slot, player_id) VALUES (?, ?, ?)");
  for (const [slot, playerId] of Object.entries(squad)) {
    if (playerId) insert.run(userId, slot, playerId);
  }
}

export function getDraftSquad(userId: number) {
  const rows = getDb().prepare("SELECT slot, player_id FROM draft_squad_players WHERE user_id = ?").all(userId) as Array<{ slot: SquadSlot; player_id: number }>;
  return Object.fromEntries(rows.map((row) => [row.slot, row.player_id])) as Partial<Record<SquadSlot, number>>;
}

export function getPersistedUserState(userId: number) {
  ensureUserState(userId);
  const state = getDb().prepare("SELECT total_km, km_balance FROM user_state WHERE user_id = ?").get(userId) as { total_km: number; km_balance: number };
  const players = getDb().prepare("SELECT player_id, duplicate_count FROM user_players WHERE user_id = ?").all(userId) as Array<{ player_id: number; duplicate_count: number }>;
  const squad = getDraftSquad(userId);

  return {
    totalKm: state.total_km,
    kmBalance: state.km_balance,
    ownedPlayerIds: players.map((player) => player.player_id),
    duplicateCounts: Object.fromEntries(players.map((player) => [player.player_id, player.duplicate_count])),
    squad
  };
}

export function savePersistedUserState(userId: number, state: { totalKm: number; kmBalance: number; ownedPlayerIds: number[]; duplicateCounts: Record<number, number>; squad: Partial<Record<SquadSlot, number>> }) {
  const database = getDb();
  database.prepare("INSERT INTO user_state (user_id, total_km, km_balance, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET total_km = excluded.total_km, km_balance = excluded.km_balance, updated_at = CURRENT_TIMESTAMP").run(userId, state.totalKm, state.kmBalance);
  database.prepare("DELETE FROM user_players WHERE user_id = ?").run(userId);
  const insert = database.prepare("INSERT INTO user_players (user_id, player_id, duplicate_count) VALUES (?, ?, ?)");
  for (const playerId of state.ownedPlayerIds) {
    insert.run(userId, playerId, state.duplicateCounts[playerId] ?? 0);
  }
  saveDraftSquad(userId, state.squad);
}

export function getRatingBoosts(userId: number): Record<number, number> {
  const rows = getDb()
    .prepare("SELECT player_id, SUM(boost_amount) AS total FROM goal_boosts WHERE user_id = ? GROUP BY player_id")
    .all(userId) as Array<{ player_id: number; total: number }>;
  return Object.fromEntries(rows.map((row) => [row.player_id, row.total]));
}

const DAILY_FREE_CREDITS = 2;

export function awardDailyCredits(userId: number): number {
  const db = getDb();
  const todayUTC = new Date().toISOString().slice(0, 10);
  const row = db.prepare("SELECT daily_credits_granted_date FROM user_state WHERE user_id = ?").get(userId) as { daily_credits_granted_date: string | null } | undefined;
  if (row?.daily_credits_granted_date === todayUTC) return 0;
  db.prepare("UPDATE user_state SET daily_credits_granted_date = ? WHERE user_id = ?").run(todayUTC, userId);
  db.prepare("UPDATE users SET reward_credits = reward_credits + ? WHERE id = ?").run(DAILY_FREE_CREDITS, userId);
  return DAILY_FREE_CREDITS;
}

export function spendCredits(userId: number, amount: number): boolean {
  const db = getDb();
  const user = db.prepare("SELECT reward_credits FROM users WHERE id = ?").get(userId) as { reward_credits: number } | undefined;
  if (!user || user.reward_credits < amount) return false;
  db.prepare("UPDATE users SET reward_credits = reward_credits - ? WHERE id = ?").run(amount, userId);
  return true;
}

export function upsertGoalScorer(matchId: string, scorerNameRaw: string, playerId: number | null, status: "matched" | "pending" | "ignored", source: "auto" | "manual", goalCount = 1) {
  getDb()
    .prepare(`INSERT INTO goal_scorers (match_id, scorer_name_raw, player_id, goal_count, status, source)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(match_id, scorer_name_raw) DO UPDATE SET
        player_id = CASE WHEN excluded.source = 'manual' OR goal_scorers.status = 'pending' THEN excluded.player_id ELSE goal_scorers.player_id END,
        goal_count = excluded.goal_count,
        status = CASE WHEN excluded.source = 'manual' THEN excluded.status ELSE goal_scorers.status END,
        source = excluded.source`)
    .run(matchId, scorerNameRaw, playerId, goalCount, status, source);
}

export function getPendingGoalScorers() {
  return getDb()
    .prepare(`SELECT gs.id, gs.match_id, gs.scorer_name_raw, gs.player_id, gs.goal_count, gs.status, gs.source,
                     fr.home_team, fr.away_team, fr.match_date
              FROM goal_scorers gs
              LEFT JOIN fixture_results fr ON fr.match_id = gs.match_id
              ORDER BY fr.match_date DESC, gs.id DESC`)
    .all() as Array<{ id: number; match_id: string; scorer_name_raw: string; player_id: number | null; goal_count: number; status: string; source: string; home_team: string | null; away_team: string | null; match_date: string | null }>;
}

export function resolveGoalScorer(id: number, playerId: number | null, status: "matched" | "ignored") {
  getDb()
    .prepare("UPDATE goal_scorers SET player_id = ?, status = ?, source = 'manual' WHERE id = ?")
    .run(playerId, status, id);
}

export function getMatchedGoalScorers(matchId: string): Array<{ playerId: number; goalCount: number }> {
  const rows = getDb()
    .prepare("SELECT player_id, goal_count FROM goal_scorers WHERE match_id = ? AND status = 'matched' AND player_id IS NOT NULL")
    .all(matchId) as Array<{ player_id: number; goal_count: number }>;
  return rows.map((r) => ({ playerId: r.player_id, goalCount: r.goal_count }));
}

export function awardGoalBoost(userId: number, playerId: number, matchId: string, boostAmount: number): boolean {
  const result = getDb()
    .prepare("INSERT OR IGNORE INTO goal_boosts (user_id, player_id, match_id, boost_amount) VALUES (?, ?, ?, ?)")
    .run(userId, playerId, matchId, boostAmount);
  return result.changes > 0;
}

export function upsertAssistScorer(matchId: string, scorerNameRaw: string, playerId: number | null, status: "matched" | "pending" | "ignored", source: "auto" | "manual", assistCount = 1) {
  getDb()
    .prepare(`INSERT INTO assist_scorers (match_id, scorer_name_raw, player_id, assist_count, status, source)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(match_id, scorer_name_raw) DO UPDATE SET
        player_id = CASE WHEN excluded.source = 'manual' OR assist_scorers.status = 'pending' THEN excluded.player_id ELSE assist_scorers.player_id END,
        assist_count = excluded.assist_count,
        status = CASE WHEN excluded.source = 'manual' THEN excluded.status ELSE assist_scorers.status END,
        source = excluded.source`)
    .run(matchId, scorerNameRaw, playerId, assistCount, status, source);
}

export function getMatchedAssistScorers(matchId: string): Array<{ playerId: number; assistCount: number }> {
  const rows = getDb()
    .prepare("SELECT player_id, assist_count FROM assist_scorers WHERE match_id = ? AND status = 'matched' AND player_id IS NOT NULL")
    .all(matchId) as Array<{ player_id: number; assist_count: number }>;
  return rows.map((r) => ({ playerId: r.player_id, assistCount: r.assist_count }));
}

export function getPendingAssistScorers() {
  return getDb()
    .prepare(`SELECT as2.id, as2.match_id, as2.scorer_name_raw, as2.player_id, as2.assist_count, as2.status, as2.source,
                     fr.home_team, fr.away_team, fr.match_date
              FROM assist_scorers as2
              LEFT JOIN fixture_results fr ON fr.match_id = as2.match_id
              ORDER BY fr.match_date DESC, as2.id DESC`)
    .all() as Array<{ id: number; match_id: string; scorer_name_raw: string; player_id: number | null; assist_count: number; status: string; source: string; home_team: string | null; away_team: string | null; match_date: string | null }>;
}

export function resolveAssistScorer(id: number, playerId: number | null, status: "matched" | "ignored") {
  getDb()
    .prepare("UPDATE assist_scorers SET player_id = ?, status = ?, source = 'manual' WHERE id = ?")
    .run(playerId, status, id);
}

export function getRevealPlayerIds(userId: number) {
  const rows = getDb().prepare("SELECT player_id FROM reveal_players WHERE user_id = ? ORDER BY position").all(userId) as Array<{ player_id: number }>;
  return rows.map((row) => row.player_id);
}

export function saveRevealPlayerIds(userId: number, playerIds: number[]) {
  const database = getDb();
  database.prepare("DELETE FROM reveal_players WHERE user_id = ?").run(userId);
  const insert = database.prepare("INSERT INTO reveal_players (user_id, position, player_id) VALUES (?, ?, ?)");
  playerIds.forEach((playerId, index) => insert.run(userId, index, playerId));
}

export function getCommunityStats() {
  const row = getDb().prepare("SELECT COALESCE(SUM(total_km), 0) AS total_km, COUNT(*) AS user_count FROM user_state").get() as { total_km: number; user_count: number };
  return {
    totalKm: row.total_km,
    userCount: row.user_count
  };
}

export function getChatMessages() {
  return getDb()
    .prepare(
      `SELECT chat_messages.id, chat_messages.message, chat_messages.created_at, users.username
       FROM chat_messages
       JOIN users ON users.id = chat_messages.user_id
       ORDER BY chat_messages.created_at DESC, chat_messages.id DESC
       LIMIT 50`
    )
    .all() as Array<{ id: number; message: string; created_at: string; username: string }>;
}

export function toggleChatReaction(messageId: number, userId: number, reaction: string): 'added' | 'removed' {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?").get(messageId, userId, reaction);
  if (existing) {
    database.prepare("DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND reaction = ?").run(messageId, userId, reaction);
    return 'removed';
  }
  database.prepare("INSERT OR IGNORE INTO chat_reactions (message_id, user_id, reaction) VALUES (?, ?, ?)").run(messageId, userId, reaction);
  return 'added';
}

export function getChatReactionsForMessages(messageIds: number[], viewerUserId: number | null): Array<{ message_id: number; reaction: string; count: number; user_reacted: boolean }> {
  if (messageIds.length === 0) return [];
  const placeholders = messageIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT message_id, reaction, COUNT(*) AS count,
              MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS user_reacted
       FROM chat_reactions
       WHERE message_id IN (${placeholders})
       GROUP BY message_id, reaction`
    )
    .all(viewerUserId ?? 0, ...messageIds) as Array<{ message_id: number; reaction: string; count: number; user_reacted: number }>;
  return rows.map((r) => ({ ...r, user_reacted: r.user_reacted === 1 }));
}

export function saveChatMessage(userId: number, message: string) {
  const trimmed = message.trim().slice(0, 500);
  if (!trimmed) return;
  createChatMessage(userId, trimmed);
}

export function getKmLogsToday(userId: number): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM km_log
       WHERE user_id = ? AND date(created_at) = date('now')`
    )
    .get(userId) as { count: number };
  return row.count;
}

export function createChatMessage(userId: number, message: string) {
  const trimmed = message.trim().slice(0, 1000);
  if (!trimmed) return null;
  const result = getDb().prepare("INSERT INTO chat_messages (user_id, message) VALUES (?, ?)").run(userId, trimmed);
  return Number(result.lastInsertRowid);
}

export function createAdminChatMessage(message: string) {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM users WHERE username = 'admin'").get() as { id: number } | undefined;
  const inserted =
    existing ??
    (database
      .prepare("INSERT INTO users (username, password_hash) VALUES ('admin', ?) RETURNING id")
      .get(`system:${randomBytes(32).toString("hex")}`) as { id: number });
  const adminUserId = inserted.id;
  return createChatMessage(adminUserId, message);
}

export function markChatMessageRemoved(messageId: number, reason: string) {
  getDb()
    .prepare("UPDATE chat_messages SET message = ? WHERE id = ?")
    .run(`[Activity log removed by admin] ${reason ? `Reason: ${reason}` : ""}`.trim(), messageId);
}

export function logKmEntry({
  userId,
  activityCredits,
  cardsEarned,
  activityType = "walk",
  activityAmount = activityCredits,
  activityUnit = "km",
  comment,
  rewardCreditValue,
  balanceBefore,
  balanceAfter,
  awardedPlayerIds,
  chatMessageId
}: {
  userId: number;
  activityCredits: number;
  cardsEarned: number;
  activityType?: ActivityType;
  activityAmount?: number;
  activityUnit?: string;
  comment?: string;
  rewardCreditValue?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  awardedPlayerIds?: number[];
  chatMessageId?: number | null;
}) {
  const database = getDb();
  const result = database
    .prepare(
      `INSERT INTO km_log (
        user_id, distance_km, activity_type, activity_amount, activity_unit, comment,
        reward_credit_value, balance_before, balance_after, chat_message_id, cards_earned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      activityCredits,
      activityType,
      activityAmount,
      activityUnit,
      comment?.trim().slice(0, 240) || null,
      rewardCreditValue ?? null,
      balanceBefore ?? null,
      balanceAfter ?? null,
      chatMessageId ?? null,
      cardsEarned
    );
  const logId = Number(result.lastInsertRowid);
  const insertAward = database.prepare("INSERT INTO km_log_awards (log_id, position, player_id) VALUES (?, ?, ?)");
  (awardedPlayerIds ?? []).forEach((playerId, index) => insertAward.run(logId, index, playerId));
  return logId;
}

export function getKmLeaderboard() {
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT users.id, users.username,
              COALESCE(SUM(km_log.distance_km), 0) AS total_km,
              COALESCE(games_won.count, 0) AS games_won
       FROM users
       LEFT JOIN km_log ON km_log.user_id = users.id AND km_log.voided_at IS NULL
       LEFT JOIN (
         SELECT user_id, COUNT(DISTINCT match_id) AS count
         FROM reward_events
         GROUP BY user_id
       ) games_won ON games_won.user_id = users.id
       GROUP BY users.id`
    )
    .all() as Array<{ id: number; username: string; total_km: number; games_won: number }>;

  const ownedRows = db
    .prepare(`SELECT user_id, player_id FROM user_players`)
    .all() as Array<{ user_id: number; player_id: number }>;

  const boostRows = db
    .prepare(
      `SELECT user_id,
              SUM(CASE WHEN match_id NOT LIKE '%:assist' THEN boost_amount ELSE 0 END) AS goal_bonus,
              SUM(CASE WHEN match_id LIKE '%:assist' THEN boost_amount ELSE 0 END) AS assist_bonus
       FROM goal_boosts GROUP BY user_id`
    )
    .all() as Array<{ user_id: number; goal_bonus: number; assist_bonus: number }>;
  const boostByUser = new Map(boostRows.map((r) => [r.user_id, r]));

  const byUser = new Map<number, number[]>();
  for (const row of ownedRows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.player_id);
    byUser.set(row.user_id, list);
  }

  return rows
    .map((row) => ({
      username: row.username,
      total_km: row.total_km,
      games_won: row.games_won,
      best_squad_rating: computeBestSquadRating(byUser.get(row.id) ?? []),
      goal_bonus: boostByUser.get(row.id)?.goal_bonus ?? 0,
      assist_bonus: boostByUser.get(row.id)?.assist_bonus ?? 0
    }))
    .sort((a, b) => b.best_squad_rating - a.best_squad_rating || b.total_km - a.total_km);
}

export function getAdminActivityLogs(limit = 50) {
  const logs = getDb()
    .prepare(
      `SELECT km_log.id, km_log.user_id, users.username, km_log.distance_km, km_log.activity_type,
              km_log.activity_amount, km_log.activity_unit, km_log.comment, km_log.cards_earned,
              km_log.reward_credit_value, km_log.balance_before, km_log.balance_after,
              km_log.chat_message_id, km_log.created_at, km_log.voided_at, km_log.void_reason
       FROM km_log
       JOIN users ON users.id = km_log.user_id
       ORDER BY km_log.created_at DESC, km_log.id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
      id: number;
      user_id: number;
      username: string;
      distance_km: number;
      activity_type: ActivityType;
      activity_amount: number | null;
      activity_unit: string | null;
      comment: string | null;
      cards_earned: number;
      reward_credit_value: number | null;
      balance_before: number | null;
      balance_after: number | null;
      chat_message_id: number | null;
      created_at: string;
      voided_at: string | null;
      void_reason: string | null;
    }>;
  return logs.map((log) => ({
    ...log,
    awards: getLogAwards(log.id)
  }));
}

function getLogAwards(logId: number) {
  return getDb()
    .prepare("SELECT log_id, player_id FROM km_log_awards WHERE log_id = ? ORDER BY position")
    .all(logId) as Array<{ log_id: number; player_id: number }>;
}

export function voidActivityLog(logId: number, adminUserId: number, reason: string) {
  const database = getDb();
  const log = database
    .prepare(
      `SELECT id, user_id, distance_km, reward_credit_value, balance_before, balance_after,
              chat_message_id, voided_at
       FROM km_log WHERE id = ?`
    )
    .get(logId) as
    | {
        id: number;
        user_id: number;
        distance_km: number;
        reward_credit_value: number | null;
        balance_before: number | null;
        balance_after: number | null;
        chat_message_id: number | null;
        voided_at: string | null;
      }
    | undefined;

  if (!log) return { ok: false, error: "Log not found." };
  if (log.voided_at) return { ok: false, error: "Log already removed." };

  const awards = getLogAwards(logId);
  const state = database.prepare("SELECT total_km, km_balance FROM user_state WHERE user_id = ?").get(log.user_id) as { total_km: number; km_balance: number } | undefined;
  const totalKm = Math.max(0, Number(((state?.total_km ?? 0) - log.distance_km).toFixed(2)));
  const balanceDelta = log.balance_before != null && log.balance_after != null ? log.balance_after - log.balance_before : (log.reward_credit_value ?? log.distance_km) % 1;
  const kmBalance = Math.max(0, Math.min(0.99, Number(((state?.km_balance ?? 0) - balanceDelta).toFixed(2))));

  database.prepare("UPDATE user_state SET total_km = ?, km_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").run(totalKm, kmBalance, log.user_id);
  for (const award of awards) {
    removeAwardedPlayer(log.user_id, award.player_id);
  }
  database
    .prepare("DELETE FROM draft_squad_players WHERE user_id = ? AND player_id NOT IN (SELECT player_id FROM user_players WHERE user_id = ?)")
    .run(log.user_id, log.user_id);

  const trimmedReason = reason.trim().slice(0, 240);
  database
    .prepare("UPDATE km_log SET voided_at = CURRENT_TIMESTAMP, voided_by = ?, void_reason = ? WHERE id = ?")
    .run(adminUserId, trimmedReason, logId);
  if (log.chat_message_id) markChatMessageRemoved(log.chat_message_id, trimmedReason);
  return { ok: true };
}

function removeAwardedPlayer(userId: number, playerId: number) {
  const database = getDb();
  const owned = database.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(userId, playerId) as { duplicate_count: number } | undefined;
  if (!owned) return;
  if (owned.duplicate_count > 0) {
    database.prepare("UPDATE user_players SET duplicate_count = duplicate_count - 1 WHERE user_id = ? AND player_id = ?").run(userId, playerId);
  } else {
    database.prepare("DELETE FROM user_players WHERE user_id = ? AND player_id = ?").run(userId, playerId);
  }
}

import playerData from "@/data/players.json";
const _allPlayersForRating = playerData as Array<{ id: number; rating: number; pos: string }>;

function computeBestSquadRating(playerIds: number[]): number {
  if (playerIds.length === 0) return 0;
  const owned = playerIds.map((id) => _allPlayersForRating.find((p) => p.id === id)).filter(Boolean) as Array<{ id: number; rating: number; pos: string }>;
  const used = new Set<number>();
  const positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
  const picked: number[] = [];

  for (const pos of positions) {
    const best = owned.filter((p) => p.pos === pos && !used.has(p.id)).sort((a, b) => b.rating - a.rating)[0];
    if (best) { used.add(best.id); picked.push(best.rating); }
  }

  if (picked.length === 0) return 0;
  return Math.round((picked.reduce((s, r) => s + r, 0) / picked.length) * 10) / 10;
}

export function getUpcomingFixtures(date: string) {
  return getDb()
    .prepare(`SELECT match_id, home_team, away_team, kickoff_at, status, winner FROM fixture_results WHERE match_date = ? ORDER BY kickoff_at`)
    .all(date) as Array<{ match_id: string; home_team: string; away_team: string; kickoff_at: string; status: string; winner: string | null }>;
}

export function getLockedSquadForDate(userId: number, lockDate: string) {
  const database = getDb();
  const locked = database.prepare("SELECT id FROM locked_squads WHERE user_id = ? AND lock_date = ?").get(userId, lockDate) as { id: number } | undefined;
  if (!locked) return null;
  const players = database
    .prepare("SELECT slot, player_id FROM locked_squad_players WHERE locked_squad_id = ? ORDER BY slot")
    .all(locked.id) as Array<{ slot: string; player_id: number }>;
  return { lockedSquadId: locked.id, players };
}

export function lockSquadForDate(userId: number, lockDate: string, lockAt: string, unlockAt: string) {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM locked_squads WHERE user_id = ? AND lock_date = ?").get(userId, lockDate);
  if (existing) return;
  const draftSquad = getDraftSquad(userId);
  const allPlayerData = players as Array<{ id: number; nation: string }>;
  const playerNationMap = new Map(allPlayerData.map((p) => [p.id, p]));
  const result = database.prepare("INSERT INTO locked_squads (user_id, lock_date, locked_at, unlock_at) VALUES (?, ?, ?, ?)").run(userId, lockDate, lockAt, unlockAt);
  const lockedSquadId = Number(result.lastInsertRowid);
  const insertPlayer = database.prepare("INSERT INTO locked_squad_players (locked_squad_id, slot, player_id, nation) VALUES (?, ?, ?, ?)");
  for (const [slot, playerId] of Object.entries(draftSquad)) {
    const p = playerNationMap.get(playerId);
    if (p) insertPlayer.run(lockedSquadId, slot, p.id, p.nation);
  }
}

export function unlockSquadForDate(userId: number, lockDate: string) {
  const database = getDb();
  const locked = database.prepare("SELECT id FROM locked_squads WHERE user_id = ? AND lock_date = ?").get(userId, lockDate) as { id: number } | undefined;
  if (!locked) return;
  database.prepare("DELETE FROM locked_squad_players WHERE locked_squad_id = ?").run(locked.id);
  database.prepare("DELETE FROM locked_squads WHERE id = ?").run(locked.id);
}

export function getKmFeed(limit = 30) {
  return getDb()
    .prepare(
      `SELECT km_log.distance_km, km_log.activity_type, km_log.activity_amount, km_log.activity_unit, km_log.comment, km_log.cards_earned, km_log.created_at, users.username
       FROM km_log
       JOIN users ON users.id = km_log.user_id
       WHERE km_log.voided_at IS NULL
       ORDER BY km_log.created_at DESC, km_log.id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
      distance_km: number;
      activity_type: ActivityType;
      activity_amount: number | null;
      activity_unit: string | null;
      comment: string | null;
      cards_earned: number;
      created_at: string;
      username: string;
    }>;
}

function ensureUserState(userId: number) {
  const exists = getDb().prepare("SELECT user_id FROM user_state WHERE user_id = ?").get(userId);
  if (exists) return;

  const starter = createStarterStateSnapshot();
  savePersistedUserState(userId, starter);
}

function createStarterStateSnapshot() {
  const playerRows = players as Array<{ id: number; pos: string; rarity: string; rating: number }>;
  const plan: Array<{ slot: SquadSlot; positions: string[] }> = [
    { slot: "GK", positions: ["GK"] },
    { slot: "DF1", positions: ["DF"] },
    { slot: "DF2", positions: ["DF"] },
    { slot: "DF3", positions: ["DF"] },
    { slot: "DF4", positions: ["DF"] },
    { slot: "MF1", positions: ["MF"] },
    { slot: "MF2", positions: ["MF"] },
    { slot: "MF3", positions: ["MF"] },
    { slot: "FW1", positions: ["FW"] },
    { slot: "FW2", positions: ["FW"] },
    { slot: "FW3", positions: ["FW"] }
  ];
  const picked = new Set<number>();
  const squad: Partial<Record<SquadSlot, number>> = {};

  for (const item of plan) {
    const pool = playerRows.filter((player) => item.positions.includes(player.pos) && !picked.has(player.id)).sort((a, b) => a.rating - b.rating);
    const player = pool[0];
    if (player) {
      picked.add(player.id);
      squad[item.slot] = player.id;
    }
  }

  return {
    totalKm: 0,
    kmBalance: 0,
    ownedPlayerIds: Array.from(picked),
    duplicateCounts: Object.fromEntries(Array.from(picked).map((id) => [id, 0])),
    squad
  };
}

function migrateUserState(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(user_state)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (!colNames.has("daily_credits_granted_date")) {
    database.exec("ALTER TABLE user_state ADD COLUMN daily_credits_granted_date TEXT");
  }
}

function migrateGoalScorers(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(goal_scorers)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (colNames.size > 0 && !colNames.has("goal_count")) {
    database.exec("ALTER TABLE goal_scorers ADD COLUMN goal_count INTEGER NOT NULL DEFAULT 1");
  }
}

function migrateFixtureResults(database: DatabaseSync) {
  const fixtureColumns = database.prepare("PRAGMA table_info(fixture_results)").all() as Array<{ name: string }>;
  const fixtureColumnNames = new Set(fixtureColumns.map((column) => column.name));
  if (!fixtureColumnNames.has("verified")) database.exec("ALTER TABLE fixture_results ADD COLUMN verified INTEGER NOT NULL DEFAULT 0");
  if (!fixtureColumnNames.has("updated_at")) database.exec("ALTER TABLE fixture_results ADD COLUMN updated_at TEXT");

  database.prepare("UPDATE fixture_results SET verified = 1 WHERE source = 'seed' OR source = 'manual'").run();
  database.prepare("UPDATE fixture_results SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL").run();
}

function seedFixtureResults(database: DatabaseSync) {
  const count = database.prepare("SELECT COUNT(*) AS count FROM fixture_results").get() as { count: number };
  if (count.count > 0) return;
  const insert = database.prepare("INSERT INTO fixture_results (match_id, match_date, kickoff_at, home_team, away_team, winner, status, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  insert.run("seed-2026-06-11-mexico-win", "2026-06-11", "2026-06-11T20:00:00.000Z", "Mexico", "South Africa", "Mexico", "FINISHED", 1);
  insert.run("seed-2026-06-12-czech-win", "2026-06-12", "2026-06-12T20:00:00.000Z", "Czech Republic", "South Korea", "Czech Republic", "FINISHED", 1);
}
