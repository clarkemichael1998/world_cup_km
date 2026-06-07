import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { DatabaseSync } from "node:sqlite";
import players from "@/data/players.json";
import { getAdminUsernames } from "@/lib/server/admin";
import type { ActivityType, Player, Position, Rarity, SquadSlot } from "@/lib/types";

const dbDir = path.join(process.cwd(), "data");
const dbPath = process.env.SQLITE_DB_PATH ?? path.join(dbDir, "km-footy.sqlite");
const sessionCookie = "km_footy_session";
const basePlayers = players as Player[];

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
      reply_to_message_id INTEGER,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (reply_to_message_id) REFERENCES chat_messages(id)
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
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      implemented_at TEXT,
      implemented_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (implemented_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS suggestion_votes (
      suggestion_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (suggestion_id, user_id),
      FOREIGN KEY (suggestion_id) REFERENCES suggestions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS news_reel (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      message TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id)
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
    CREATE TABLE IF NOT EXISTS card_awards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      rarity TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id INTEGER,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
    CREATE TABLE IF NOT EXISTS late_callup_players (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sort_name TEXT NOT NULL,
      club TEXT NOT NULL,
      nation TEXT NOT NULL,
      pos TEXT NOT NULL,
      rating INTEGER NOT NULL,
      rarity TEXT NOT NULL,
      wiki TEXT,
      dob TEXT NOT NULL,
      caps INTEGER,
      goals INTEGER,
      club_wiki TEXT,
      club_country TEXT NOT NULL,
      team_id TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS player_rating_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      adjustment INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      chat_message_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (chat_message_id) REFERENCES chat_messages(id)
    );
  `);
  migrateKmLogActivity(db);
  migrateChatMessages(db);
  migrateFixtureResults(db);
  migrateUserState(db);
  migrateGoalScorers(db);
  migrateSuggestions(db);
  seedFixtureResults(db);
  removeLegacySeedFixtures(db);
  return db;
}

export function getNewsReel() {
  const row = getDb()
    .prepare("SELECT message, is_active, updated_at FROM news_reel WHERE id = 1")
    .get() as { message: string; is_active: number; updated_at: string } | undefined;
  return row
    ? { message: row.message, isActive: row.is_active === 1, updatedAt: row.updated_at }
    : { message: "Martin O'Neill appointed new Celtic manager", isActive: true, updatedAt: null };
}

export function updateNewsReel(message: string, isActive: boolean, updatedBy: number) {
  const cleanMessage = message.trim().slice(0, 180);
  getDb()
    .prepare(
      `INSERT INTO news_reel (id, message, is_active, updated_by, updated_at)
       VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         message = excluded.message,
         is_active = excluded.is_active,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(cleanMessage, isActive ? 1 : 0, updatedBy);
  return getNewsReel();
}

type LateCallupRow = {
  id: number;
  slug: string;
  name: string;
  sort_name: string;
  club: string;
  nation: string;
  pos: Position;
  rating: number;
  rarity: Rarity;
  wiki: string | null;
  dob: string;
  caps: number | null;
  goals: number | null;
  club_wiki: string | null;
  club_country: string;
  team_id: string;
};

export type LateCallupInput = {
  name: string;
  club: string;
  nation: string;
  pos: Position;
  rating: number;
  wiki?: string | null;
  dob: string;
  caps?: number | null;
  goals?: number | null;
  clubWiki?: string | null;
  clubCountry: string;
  teamId: string;
};

export type PlayerRatingAdjustment = {
  id: number;
  playerId: number;
  playerName: string;
  playerNation: string;
  playerClub: string;
  adjustment: number;
  reason: string;
  createdByUsername: string;
  createdAt: string;
  chatMessageId: number | null;
  ratingBefore: number;
  ratingAfter: number;
};

export function getAllPlayers(): Player[] {
  return applyGlobalRatingAdjustments([...basePlayers, ...getLateCallupPlayers()]);
}

export function getLateCallupPlayers(): Player[] {
  const rows = getDb()
    .prepare("SELECT id, slug, name, sort_name, club, nation, pos, rating, rarity, wiki, dob, caps, goals, club_wiki, club_country, team_id FROM late_callup_players ORDER BY id")
    .all() as LateCallupRow[];
  return rows.map(playerFromLateCallupRow);
}

export function createLateCallupPlayer(input: LateCallupInput, createdBy: number): Player {
  const database = getDb();
  const latestLate = database.prepare("SELECT MAX(id) AS maxId FROM late_callup_players").get() as { maxId: number | null };
  const maxBaseId = basePlayers.reduce((max, player) => Math.max(max, player.id), 0);
  const id = Math.max(maxBaseId, latestLate.maxId ?? 0) + 1;
  const slug = uniquePlayerSlug(database, slugify(`${input.name}-${input.nation}`), id);
  const player: Player = {
    id,
    slug,
    name: input.name.trim(),
    sortName: toSortName(input.name),
    club: input.club.trim(),
    nation: input.nation.trim(),
    pos: input.pos,
    rating: input.rating,
    rarity: rarityFromRating(input.rating),
    wiki: cleanOptional(input.wiki),
    dob: input.dob,
    caps: input.caps ?? null,
    goals: input.goals ?? null,
    clubWiki: cleanOptional(input.clubWiki),
    clubCountry: input.clubCountry.trim().toUpperCase(),
    teamId: input.teamId.trim().toLowerCase()
  };

  database
    .prepare(
      `INSERT INTO late_callup_players
       (id, slug, name, sort_name, club, nation, pos, rating, rarity, wiki, dob, caps, goals, club_wiki, club_country, team_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      player.id,
      player.slug,
      player.name,
      player.sortName,
      player.club,
      player.nation,
      player.pos,
      player.rating,
      player.rarity,
      player.wiki,
      player.dob,
      player.caps,
      player.goals,
      player.clubWiki,
      player.clubCountry,
      player.teamId,
      createdBy
    );

  return player;
}

export function getPlayerRatingAdjustments(limit = 40): PlayerRatingAdjustment[] {
  const rows = getDb()
    .prepare(
      `SELECT pra.id, pra.player_id, pra.adjustment, pra.reason, pra.created_at, pra.chat_message_id, users.username AS created_by_username
       FROM player_rating_adjustments pra
       JOIN users ON users.id = pra.created_by
       ORDER BY pra.created_at DESC, pra.id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ id: number; player_id: number; adjustment: number; reason: string; created_at: string; chat_message_id: number | null; created_by_username: string }>;
  return rows.map((row) => toPlayerRatingAdjustment(row));
}

export function createPlayerRatingAdjustment(playerId: number, adjustment: number, reason: string, adminUserId: number): PlayerRatingAdjustment | null {
  const rawPlayers = getRawPlayerPool();
  const rawPlayer = rawPlayers.find((player) => player.id === playerId);
  if (!rawPlayer) return null;

  const currentPlayer = applyGlobalRatingAdjustments(rawPlayers).find((player) => player.id === playerId) ?? rawPlayer;
  const ratingBefore = currentPlayer.rating;
  const ratingAfter = clampRating(ratingBefore + adjustment);
  const appliedAdjustment = ratingAfter - ratingBefore;
  if (appliedAdjustment === 0) return null;

  const action = appliedAdjustment > 0 ? "boosted" : "downgraded";
  const signed = appliedAdjustment > 0 ? `+${appliedAdjustment}` : String(appliedAdjustment);
  const cleanReason = reason.trim().slice(0, 180);
  const chatMessageId = createAdminChatMessage(
    `Viral moment: ${rawPlayer.name} has been ${action} ${signed} to ${ratingAfter}. Reason: ${cleanReason}`
  );
  const result = getDb()
    .prepare("INSERT INTO player_rating_adjustments (player_id, adjustment, reason, created_by, chat_message_id) VALUES (?, ?, ?, ?, ?)")
    .run(playerId, appliedAdjustment, cleanReason, adminUserId, chatMessageId);
  const created = getDb()
    .prepare(
      `SELECT pra.id, pra.player_id, pra.adjustment, pra.reason, pra.created_at, pra.chat_message_id, users.username AS created_by_username
       FROM player_rating_adjustments pra
       JOIN users ON users.id = pra.created_by
       WHERE pra.id = ?`
    )
    .get(Number(result.lastInsertRowid)) as { id: number; player_id: number; adjustment: number; reason: string; created_at: string; chat_message_id: number | null; created_by_username: string } | undefined;
  return created ? toPlayerRatingAdjustment(created) : null;
}

function getRawPlayerPool(): Player[] {
  return [...basePlayers, ...getLateCallupPlayers()];
}

function applyGlobalRatingAdjustments(playerPool: Player[]): Player[] {
  const rows = getDb()
    .prepare("SELECT player_id, SUM(adjustment) AS total FROM player_rating_adjustments GROUP BY player_id")
    .all() as Array<{ player_id: number; total: number }>;
  if (rows.length === 0) return playerPool;
  const adjustmentMap = new Map(rows.map((row) => [row.player_id, row.total]));
  return playerPool.map((player) => {
    const adjustment = adjustmentMap.get(player.id) ?? 0;
    return adjustment === 0 ? player : { ...player, rating: clampRating(player.rating + adjustment) };
  });
}

function toPlayerRatingAdjustment(row: { id: number; player_id: number; adjustment: number; reason: string; created_at: string; chat_message_id: number | null; created_by_username: string }): PlayerRatingAdjustment {
  const rawPlayer = getRawPlayerPool().find((player) => player.id === row.player_id);
  const priorTotal = getRatingAdjustmentTotalBefore(row.player_id, row.id);
  const rawRating = rawPlayer?.rating ?? 0;
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: rawPlayer?.name ?? `Player #${row.player_id}`,
    playerNation: rawPlayer?.nation ?? "Unknown",
    playerClub: rawPlayer?.club ?? "Unknown",
    adjustment: row.adjustment,
    reason: row.reason,
    createdByUsername: row.created_by_username,
    createdAt: row.created_at,
    chatMessageId: row.chat_message_id,
    ratingBefore: clampRating(rawRating + priorTotal),
    ratingAfter: clampRating(rawRating + priorTotal + row.adjustment)
  };
}

function getRatingAdjustmentTotalBefore(playerId: number, adjustmentId: number) {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(adjustment), 0) AS total FROM player_rating_adjustments WHERE player_id = ? AND id < ?")
    .get(playerId, adjustmentId) as { total: number };
  return row.total ?? 0;
}

function clampRating(value: number) {
  return Math.max(1, Math.min(99, value));
}

function playerFromLateCallupRow(row: LateCallupRow): Player {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sortName: row.sort_name,
    club: row.club,
    nation: row.nation,
    pos: row.pos,
    rating: row.rating,
    rarity: row.rarity,
    wiki: row.wiki,
    dob: row.dob,
    caps: row.caps,
    goals: row.goals,
    clubWiki: row.club_wiki,
    clubCountry: row.club_country,
    teamId: row.team_id
  };
}

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toSortName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name.trim();
  const last = parts.pop();
  return `${last}, ${parts.join(" ")}`;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "late-callup";
}

function uniquePlayerSlug(database: DatabaseSync, baseSlug: string, id: number) {
  const baseExists = basePlayers.some((player) => player.slug === baseSlug);
  const lateExists = database.prepare("SELECT id FROM late_callup_players WHERE slug = ?").get(baseSlug);
  if (!baseExists && !lateExists) return baseSlug;
  return `${baseSlug}-${id}`;
}

function rarityFromRating(rating: number): Rarity {
  if (rating >= 91) return "icon";
  if (rating >= 87) return "legend";
  if (rating >= 82) return "epic";
  if (rating >= 74) return "rare";
  if (rating < 50) return "clowns";
  return "common";
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

export function saveClientDraftState(userId: number, state: { squad?: Partial<Record<SquadSlot, number>> }) {
  saveDraftSquad(userId, state.squad ?? {});
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

export function spendCreditsForPlayers(userId: number, amount: number, playerIds: number[]): boolean {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  let username = "";

  try {
    const user = db.prepare("SELECT username, reward_credits FROM users WHERE id = ?").get(userId) as { username: string; reward_credits: number } | undefined;
    if (!user || user.reward_credits < amount) {
      db.exec("ROLLBACK");
      return false;
    }
    username = user.username;

    db.prepare("UPDATE users SET reward_credits = reward_credits - ? WHERE id = ?").run(amount, userId);

    awardPlayersInTransaction(db, userId, playerIds, "credit_pack", null);

    db.prepare("DELETE FROM reveal_players WHERE user_id = ?").run(userId);
    const insertReveal = db.prepare("INSERT INTO reveal_players (user_id, position, player_id) VALUES (?, ?, ?)");
    playerIds.forEach((playerId, index) => insertReveal.run(userId, index, playerId));

    db.exec("COMMIT");
    announcePremiumPulls(userId, username, playerIds, "pack");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function awardPlayersInTransaction(database: DatabaseSync, userId: number, playerIds: number[], source: string, sourceId: number | null) {
  const existingPlayer = database.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?");
  const insertPlayer = database.prepare("INSERT INTO user_players (user_id, player_id, duplicate_count) VALUES (?, ?, 0)");
  const updateDuplicate = database.prepare("UPDATE user_players SET duplicate_count = duplicate_count + 1 WHERE user_id = ? AND player_id = ?");
  const insertAward = database.prepare("INSERT INTO card_awards (user_id, player_id, rarity, source, source_id, position) VALUES (?, ?, ?, ?, ?, ?)");

  for (const [index, playerId] of playerIds.entries()) {
    const owned = existingPlayer.get(userId, playerId);
    if (owned) {
      updateDuplicate.run(userId, playerId);
    } else {
      insertPlayer.run(userId, playerId);
    }
    insertAward.run(userId, playerId, getPlayerRarity(playerId), source, sourceId, index);
  }
}

function getPlayerRarity(playerId: number): Rarity {
  const player = getAllPlayers().find((item) => item.id === playerId);
  return player?.rarity ?? "common";
}

function announcePremiumPulls(userId: number, username: string, playerIds: number[], source: "pack" | "activity") {
  const premiumPlayers = playerIds
    .map((playerId) => getAllPlayers().find((player) => player.id === playerId))
    .filter((player): player is Player => Boolean(player))
    .filter((player) => player.rarity === "legend" || player.rarity === "icon");

  for (const player of premiumPlayers) {
    const rarity = player.rarity === "icon" ? "Icon" : "Legend";
    const sourceText = source === "pack" ? "opened a pack" : "logged activity";
    createChatMessage(userId, `${username} ${sourceText} and pulled ${player.name} (${player.rating} ${rarity}, ${player.nation}).`);
  }
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
    .prepare(
      `INSERT INTO goal_boosts (user_id, player_id, match_id, boost_amount)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, player_id, match_id) DO UPDATE SET
         boost_amount = excluded.boost_amount`
    )
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
      `SELECT chat_messages.id, chat_messages.message, chat_messages.created_at, users.username,
              chat_messages.reply_to_message_id,
              reply_user.username AS reply_to_username,
              reply.message AS reply_to_message
       FROM chat_messages
       JOIN users ON users.id = chat_messages.user_id
       LEFT JOIN chat_messages reply ON reply.id = chat_messages.reply_to_message_id
       LEFT JOIN users reply_user ON reply_user.id = reply.user_id
       ORDER BY chat_messages.created_at DESC, chat_messages.id DESC
       LIMIT 50`
    )
    .all() as Array<{
      id: number;
      message: string;
      created_at: string;
      username: string;
      reply_to_message_id: number | null;
      reply_to_username: string | null;
      reply_to_message: string | null;
    }>;
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

export function getChatReactionsForMessages(messageIds: number[], viewerUserId: number | null): Array<{ message_id: number; reaction: string; count: number; user_reacted: boolean; users: string[] }> {
  if (messageIds.length === 0) return [];
  const placeholders = messageIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT chat_reactions.message_id, chat_reactions.reaction, chat_reactions.user_id, users.username
       FROM chat_reactions
       JOIN users ON users.id = chat_reactions.user_id
       WHERE chat_reactions.message_id IN (${placeholders})
       ORDER BY users.username COLLATE NOCASE`
    )
    .all(...messageIds) as Array<{ message_id: number; reaction: string; user_id: number; username: string }>;

  const grouped = new Map<string, { message_id: number; reaction: string; users: string[]; user_reacted: boolean }>();
  for (const row of rows) {
    const key = `${row.message_id}:${row.reaction}`;
    const item = grouped.get(key) ?? { message_id: row.message_id, reaction: row.reaction, users: [], user_reacted: false };
    item.users.push(row.username);
    item.user_reacted ||= row.user_id === viewerUserId;
    grouped.set(key, item);
  }

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    count: item.users.length
  }));
}

export function saveChatMessage(userId: number, message: string, replyToMessageId?: number | null) {
  const trimmed = message.trim().slice(0, 500);
  if (!trimmed) return;
  createChatMessage(userId, trimmed, replyToMessageId);
}

export function getSuggestions(viewerUserId: number | null) {
  return getDb()
    .prepare(
      `SELECT suggestions.id, suggestions.title, suggestions.details, suggestions.created_at,
              suggestions.implemented_at, implementer.username AS implemented_by_username, users.username,
              COALESCE(SUM(CASE WHEN suggestion_votes.vote = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
              COALESCE(SUM(CASE WHEN suggestion_votes.vote = -1 THEN 1 ELSE 0 END), 0) AS downvotes,
              COALESCE(MAX(CASE WHEN suggestion_votes.user_id = ? THEN suggestion_votes.vote ELSE 0 END), 0) AS user_vote
       FROM suggestions
       JOIN users ON users.id = suggestions.user_id
       LEFT JOIN users implementer ON implementer.id = suggestions.implemented_by
       LEFT JOIN suggestion_votes ON suggestion_votes.suggestion_id = suggestions.id
       GROUP BY suggestions.id
       ORDER BY suggestions.implemented_at IS NOT NULL ASC, (upvotes - downvotes) DESC, upvotes DESC, suggestions.created_at DESC`
    )
    .all(viewerUserId ?? 0) as Array<{
      id: number;
      title: string;
      details: string | null;
      created_at: string;
      implemented_at: string | null;
      implemented_by_username: string | null;
      username: string;
      upvotes: number;
      downvotes: number;
      user_vote: -1 | 0 | 1;
    }>;
}

export function saveSuggestion(userId: number, title: string, details: string) {
  const cleanTitle = title.trim().slice(0, 120);
  const cleanDetails = details.trim().slice(0, 1000);
  if (!cleanTitle) return null;
  const result = getDb()
    .prepare("INSERT INTO suggestions (user_id, title, details) VALUES (?, ?, ?)")
    .run(userId, cleanTitle, cleanDetails || null);
  return Number(result.lastInsertRowid);
}

export function toggleSuggestionVote(suggestionId: number, userId: number, vote: -1 | 1): "added" | "changed" | "removed" {
  const database = getDb();
  const existing = database
    .prepare("SELECT vote FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?")
    .get(suggestionId, userId) as { vote: number } | undefined;

  if (existing?.vote === vote) {
    database.prepare("DELETE FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?").run(suggestionId, userId);
    return "removed";
  }

  if (existing) {
    database
      .prepare("UPDATE suggestion_votes SET vote = ?, updated_at = CURRENT_TIMESTAMP WHERE suggestion_id = ? AND user_id = ?")
      .run(vote, suggestionId, userId);
    return "changed";
  }

  database
    .prepare("INSERT INTO suggestion_votes (suggestion_id, user_id, vote) VALUES (?, ?, ?)")
    .run(suggestionId, userId, vote);
  return "added";
}

export function setSuggestionImplemented(suggestionId: number, adminUserId: number, implemented: boolean) {
  const database = getDb();
  const existing = database.prepare("SELECT id FROM suggestions WHERE id = ?").get(suggestionId) as { id: number } | undefined;
  if (!existing) return false;

  if (implemented) {
    database
      .prepare("UPDATE suggestions SET implemented_at = CURRENT_TIMESTAMP, implemented_by = ? WHERE id = ?")
      .run(adminUserId, suggestionId);
  } else {
    database
      .prepare("UPDATE suggestions SET implemented_at = NULL, implemented_by = NULL WHERE id = ?")
      .run(suggestionId);
  }
  return true;
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

export function createChatMessage(userId: number, message: string, replyToMessageId?: number | null) {
  const trimmed = message.trim().slice(0, 1000);
  if (!trimmed) return null;
  const replyId = replyToMessageId
    ? ((getDb().prepare("SELECT id FROM chat_messages WHERE id = ?").get(replyToMessageId) as { id: number } | undefined)?.id ?? null)
    : null;
  const result = getDb().prepare("INSERT INTO chat_messages (user_id, message, reply_to_message_id) VALUES (?, ?, ?)").run(userId, trimmed, replyId);
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

export function logActivityWithServerAwards({
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
  balanceBefore: number;
  balanceAfter: number;
  awardedPlayerIds: number[];
  chatMessageId?: number | null;
}) {
  const database = getDb();
  database.exec("BEGIN IMMEDIATE");
  let username = "";

  try {
    ensureUserState(userId);
    const user = database.prepare("SELECT username FROM users WHERE id = ?").get(userId) as { username: string } | undefined;
    username = user?.username ?? "Someone";
    const current = database.prepare("SELECT total_km FROM user_state WHERE user_id = ?").get(userId) as { total_km: number };
    const newTotalKm = Number((current.total_km + activityCredits).toFixed(2));

    database
      .prepare("UPDATE user_state SET total_km = ?, km_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .run(newTotalKm, balanceAfter, userId);
    database.prepare("UPDATE users SET reward_credits = 0 WHERE id = ?").run(userId);

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
        balanceBefore,
        balanceAfter,
        chatMessageId ?? null,
        cardsEarned
      );
    const logId = Number(result.lastInsertRowid);
    const insertLogAward = database.prepare("INSERT INTO km_log_awards (log_id, position, player_id) VALUES (?, ?, ?)");
    awardedPlayerIds.forEach((playerId, index) => insertLogAward.run(logId, index, playerId));
    awardPlayersInTransaction(database, userId, awardedPlayerIds, "activity", logId);

    database.prepare("DELETE FROM reveal_players WHERE user_id = ?").run(userId);
    const insertReveal = database.prepare("INSERT INTO reveal_players (user_id, position, player_id) VALUES (?, ?, ?)");
    awardedPlayerIds.forEach((playerId, index) => insertReveal.run(userId, index, playerId));

    database.exec("COMMIT");
    announcePremiumPulls(userId, username, awardedPlayerIds, "activity");
    return { logId, totalKm: newTotalKm, kmBalance: balanceAfter };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getKmLeaderboard() {
  const db = getDb();
  const adminUsernames = getAdminUsernames();

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
  const visibleRows = rows.filter((row) => !adminUsernames.has(row.username.toLowerCase()));
  const visibleUserIds = new Set(visibleRows.map((row) => row.id));

  const ownedRows = db
    .prepare(`SELECT user_id, player_id FROM user_players`)
    .all() as Array<{ user_id: number; player_id: number }>;
  const visibleOwnedRows = ownedRows.filter((row) => visibleUserIds.has(row.user_id));

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
  for (const row of visibleOwnedRows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.player_id);
    byUser.set(row.user_id, list);
  }

  return visibleRows
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

const communitySquadSlots: SquadSlot[] = ["GK", "DF1", "DF2", "DF3", "DF4", "MF1", "MF2", "MF3", "FW1", "FW2", "FW3"];

function computeBestSquadRating(playerIds: number[]): number {
  if (playerIds.length === 0) return 0;
  const allPlayersForRating = getAllPlayers();
  const owned = playerIds.map((id) => allPlayersForRating.find((p) => p.id === id)).filter((player): player is Player => Boolean(player));
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

export function getCommunitySquads() {
  const db = getDb();
  const adminUsernames = getAdminUsernames();
  const users = db
    .prepare("SELECT id, username FROM users ORDER BY username")
    .all() as Array<{ id: number; username: string }>;
  const visibleUsers = users.filter((user) => !adminUsernames.has(user.username.toLowerCase()));
  const ownedRows = db
    .prepare("SELECT user_id, player_id FROM user_players")
    .all() as Array<{ user_id: number; player_id: number }>;
  const boostRows = db
    .prepare("SELECT user_id, player_id, SUM(boost_amount) AS boost FROM goal_boosts GROUP BY user_id, player_id")
    .all() as Array<{ user_id: number; player_id: number; boost: number }>;
  const lockedRows = db
    .prepare(
      `SELECT locked_squads.user_id, locked_squads.lock_date, locked_squad_players.slot, locked_squad_players.player_id
       FROM locked_squads
       JOIN locked_squad_players ON locked_squad_players.locked_squad_id = locked_squads.id
       JOIN (
         SELECT user_id, MAX(lock_date) AS lock_date
         FROM locked_squads
         GROUP BY user_id
       ) latest ON latest.user_id = locked_squads.user_id AND latest.lock_date = locked_squads.lock_date
       ORDER BY locked_squads.user_id, locked_squad_players.slot`
    )
    .all() as Array<{ user_id: number; lock_date: string; slot: SquadSlot; player_id: number }>;

  const playerById = new Map(getAllPlayers().map((player) => [player.id, player]));
  const ownedByUser = new Map<number, number[]>();
  const boostsByUser = new Map<number, Map<number, number>>();
  const lockedByUser = new Map<number, { lockDate: string; players: Array<{ slot: SquadSlot; playerId: number }> }>();

  for (const row of ownedRows) {
    const list = ownedByUser.get(row.user_id) ?? [];
    list.push(row.player_id);
    ownedByUser.set(row.user_id, list);
  }

  for (const row of boostRows) {
    const boosts = boostsByUser.get(row.user_id) ?? new Map<number, number>();
    boosts.set(row.player_id, row.boost ?? 0);
    boostsByUser.set(row.user_id, boosts);
  }

  for (const row of lockedRows) {
    const locked = lockedByUser.get(row.user_id) ?? { lockDate: row.lock_date, players: [] };
    locked.players.push({ slot: row.slot, playerId: row.player_id });
    lockedByUser.set(row.user_id, locked);
  }

  return visibleUsers
    .map((user) => {
      const boosts = boostsByUser.get(user.id) ?? new Map<number, number>();
      const best = pickBestCommunitySquad(ownedByUser.get(user.id) ?? [], boosts, playerById);
      const locked = lockedByUser.get(user.id);
      const lockedPlayers = locked
        ? communitySquadSlots
            .map((slot) => locked.players.find((player) => player.slot === slot))
            .filter((player): player is { slot: SquadSlot; playerId: number } => Boolean(player))
            .map((player) => toCommunitySquadPlayer(player.slot, player.playerId, boosts, playerById))
            .filter((player): player is NonNullable<ReturnType<typeof toCommunitySquadPlayer>> => Boolean(player))
        : [];

      return {
        username: user.username,
        best,
        locked: locked
          ? {
              lockDate: locked.lockDate,
              rating: averageCommunityRating(lockedPlayers),
              players: lockedPlayers
            }
          : null
      };
    })
    .sort((a, b) => b.best.rating - a.best.rating || a.username.localeCompare(b.username));
}

function pickBestCommunitySquad(playerIds: number[], boosts: Map<number, number>, playerById: Map<number, Player>) {
  const owned = playerIds
    .map((id) => playerById.get(id))
    .filter((player): player is Player => Boolean(player));
  const used = new Set<number>();
  const players: Array<NonNullable<ReturnType<typeof toCommunitySquadPlayer>>> = [];

  for (const slot of communitySquadSlots) {
    const position = slot.startsWith("DF") ? "DF" : slot.startsWith("MF") ? "MF" : slot.startsWith("FW") ? "FW" : "GK";
    const player = owned
      .filter((candidate) => candidate.pos === position && !used.has(candidate.id))
      .sort((a, b) => b.rating + (boosts.get(b.id) ?? 0) - (a.rating + (boosts.get(a.id) ?? 0)) || a.name.localeCompare(b.name))[0];
    if (player) {
      used.add(player.id);
      const squadPlayer = toCommunitySquadPlayer(slot, player.id, boosts, playerById);
      if (squadPlayer) players.push(squadPlayer);
    }
  }

  return {
    rating: averageCommunityRating(players),
    players
  };
}

function toCommunitySquadPlayer(slot: SquadSlot, playerId: number, boosts: Map<number, number>, playerById: Map<number, Player>) {
  const player = playerById.get(playerId);
  if (!player) return null;
  const boost = boosts.get(player.id) ?? 0;
  return {
    slot,
    id: player.id,
    name: player.name,
    nation: player.nation,
    club: player.club,
    pos: player.pos,
    rarity: player.rarity,
    rating: player.rating,
    boost,
    effectiveRating: player.rating + boost
  };
}

function averageCommunityRating(players: Array<{ effectiveRating: number }>) {
  if (players.length === 0) return 0;
  return Math.round((players.reduce((sum, player) => sum + player.effectiveRating, 0) / players.length) * 10) / 10;
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
  const playerNationMap = new Map(getAllPlayers().map((p) => [p.id, p]));
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
    const preferred = playerRows.filter(
      (player) =>
        item.positions.includes(player.pos) &&
        !picked.has(player.id) &&
        ["common", "rare"].includes(player.rarity) &&
        player.rating >= 60 &&
        player.rating <= 74
    );
    const fallback = playerRows.filter((player) => item.positions.includes(player.pos) && !picked.has(player.id));
    const pool = preferred.length > 0 ? preferred : fallback;
    const player = pool[Math.floor(Math.random() * pool.length)];
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

function migrateChatMessages(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(chat_messages)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (colNames.size > 0 && !colNames.has("reply_to_message_id")) {
    database.exec("ALTER TABLE chat_messages ADD COLUMN reply_to_message_id INTEGER");
  }
}

function migrateGoalScorers(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(goal_scorers)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (colNames.size > 0 && !colNames.has("goal_count")) {
    database.exec("ALTER TABLE goal_scorers ADD COLUMN goal_count INTEGER NOT NULL DEFAULT 1");
  }
}

function migrateSuggestions(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(suggestions)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (colNames.size > 0 && !colNames.has("implemented_at")) {
    database.exec("ALTER TABLE suggestions ADD COLUMN implemented_at TEXT");
  }
  if (colNames.size > 0 && !colNames.has("implemented_by")) {
    database.exec("ALTER TABLE suggestions ADD COLUMN implemented_by INTEGER");
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
}

function removeLegacySeedFixtures(database: DatabaseSync) {
  database.prepare("DELETE FROM fixture_results WHERE match_id LIKE 'seed-%' OR source = 'seed'").run();
}
