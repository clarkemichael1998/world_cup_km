import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { DatabaseSync } from "node:sqlite";
import players from "@/data/players.json";
import type { SquadSlot } from "@/lib/types";

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
  `);
  migrateFixtureResults(db);
  seedFixtureResults(db);
  return db;
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
