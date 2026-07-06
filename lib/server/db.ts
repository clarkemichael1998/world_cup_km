import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { DatabaseSync } from "node:sqlite";
import players from "@/data/players.json";
import { getAdminUsernames } from "@/lib/server/admin";
import { cupLegendPlayers } from "@/lib/cupLegends";
import type { ActivityType, Player, Position, Rarity, SquadSlot } from "@/lib/types";
import { DEFAULT_ACTIVITY_MULTIPLIER, rarityOdds } from "@/lib/rewardEngine";
import { compareDailyScores, getDailyScore, NATION_WIN_POINTS } from "@/lib/server/dailyScoring";
import { getLondonMatchday, londonLockWindowForDate } from "./matchday";

const dbDir = path.join(process.cwd(), "data");
const dbPath = process.env.SQLITE_DB_PATH ?? path.join(dbDir, "km-footy.sqlite");
const sessionCookie = "km_footy_session";
const basePlayers = players as Player[];
export const MAX_PLAYER_RATING = 199;

// Hidden milestone cards — awarded silently after danger swap milestones.
// Not in players.json, not in the random pack pool, excluded from nation completion.
const DANGER_MILESTONE_PLAYERS: Player[] = [
  { id: 99001, slug: "el-hadji-diouf-danger", name: "El Hadji Diouf", sortName: "Diouf, El Hadji", club: "—", nation: "Senegal", pos: "FW", rating: 33, rarity: "dangerous", wiki: null, dob: "1981-01-15", caps: null, goals: null, clubWiki: null, clubCountry: "Senegal", teamId: "senegal" },
  { id: 99002, slug: "nigel-de-jong-danger", name: "Nigel de Jong", sortName: "De Jong, Nigel", club: "—", nation: "Netherlands", pos: "MF", rating: 78, rarity: "dangerous", wiki: null, dob: "1984-11-30", caps: null, goals: null, clubWiki: null, clubCountry: "Netherlands", teamId: "netherlands" },
  { id: 99003, slug: "rene-higuita-danger", name: "René Higuita", sortName: "Higuita, René", club: "—", nation: "Colombia", pos: "GK", rating: 85, rarity: "dangerous", wiki: null, dob: "1966-08-27", caps: null, goals: null, clubWiki: null, clubCountry: "Colombia", teamId: "colombia" },
  { id: 99004, slug: "luis-suarez-danger", name: "Luis Suárez", sortName: "Suárez, Luis", club: "—", nation: "Uruguay", pos: "FW", rating: 95, rarity: "dangerous", wiki: null, dob: "1987-01-24", caps: null, goals: null, clubWiki: null, clubCountry: "Uruguay", teamId: "uruguay" },
  { id: 99005, slug: "zinedine-zidane-danger", name: "Zinedine Zidane", sortName: "Zidane, Zinedine", club: "—", nation: "France", pos: "MF", rating: 115, rarity: "dangerous", wiki: null, dob: "1972-06-23", caps: null, goals: null, clubWiki: null, clubCountry: "France", teamId: "france" },
];

const DANGER_MILESTONES: Array<{ count: number; playerId: number }> = [
  { count: 3, playerId: 99001 },
  { count: 7, playerId: 99002 },
  { count: 15, playerId: 99003 },
  { count: 30, playerId: 99004 },
  { count: 60, playerId: 99005 },
];
const goalBoostByRarity: Record<Rarity, number> = {
  icon: 2,
  legend: 2,
  epic: 3,
  rare: 5,
  common: 10,
  clowns: -5,
  dangerous: 0
};

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
    CREATE TABLE IF NOT EXISTS tournament_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      activity_multiplier REAL NOT NULL DEFAULT 1.25,
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
    CREATE TABLE IF NOT EXISTS cup_reward_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cup_id INTEGER NOT NULL,
      cup_name TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      reward_key TEXT NOT NULL,
      reward_label TEXT NOT NULL,
      pack_credit_count INTEGER NOT NULL DEFAULT 0,
      icon_count INTEGER NOT NULL DEFAULT 0,
      legend_player_id INTEGER,
      card_award_count INTEGER NOT NULL DEFAULT 0,
      reversed_at TEXT,
      reversal_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cup_id, user_id, reward_key),
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
    CREATE TABLE IF NOT EXISTS trade_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      accepted_by INTEGER,
      accepted_player_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (accepted_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS trade_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (offer_id) REFERENCES trade_offers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS boost_announcements (
      match_id TEXT NOT NULL,
      player_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (match_id, player_id, event_type)
    );
    CREATE TABLE IF NOT EXISTS nation_completion_rewards (
      user_id INTEGER NOT NULL,
      nation TEXT NOT NULL,
      credits INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, nation),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS rank_snapshots (
      snapshot_date TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      PRIMARY KEY (snapshot_date, user_id)
    );
    CREATE TABLE IF NOT EXISTS danger_swap_milestones (
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, player_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS danger_reveal_queue (
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, player_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS random_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      challenger_player_id INTEGER,
      target_player_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      FOREIGN KEY (challenger_id) REFERENCES users(id),
      FOREIGN KEY (target_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS bonus_reveal_queue (
      user_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, player_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS cup_draws (
      cup_id INTEGER PRIMARY KEY,
      participant_usernames TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cup_match_overrides (
      cup_id INTEGER NOT NULL,
      match_id TEXT NOT NULL,
      home_username TEXT,
      away_username TEXT,
      force_winner TEXT,
      PRIMARY KEY (cup_id, match_id)
    );
  `);
  migrateKmLogActivity(db);
  migrateChatMessages(db);
  migrateFixtureResults(db);
  migrateUserState(db);
  migrateGoalScorers(db);
  migrateSuggestions(db);
  migrateCupRewardEvents(db);
  migrateCupBracketOverrides(db);
  migrateBonusRevealQueue(db);
  resetMaradonaCupDraw(db);
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

export function getActivityMultiplier(): number {
  const row = getDb().prepare("SELECT activity_multiplier FROM tournament_settings WHERE id = 1").get() as { activity_multiplier: number } | undefined;
  return row?.activity_multiplier ?? DEFAULT_ACTIVITY_MULTIPLIER;
}

export function getActivityMultiplierSetting() {
  const row = getDb()
    .prepare("SELECT activity_multiplier, updated_at FROM tournament_settings WHERE id = 1")
    .get() as { activity_multiplier: number; updated_at: string } | undefined;
  return { multiplier: row?.activity_multiplier ?? DEFAULT_ACTIVITY_MULTIPLIER, updatedAt: row?.updated_at ?? null };
}

export function updateActivityMultiplier(multiplier: number, updatedBy: number) {
  const normalized = Math.round(multiplier * 100) / 100;
  if (!Number.isFinite(normalized) || normalized < 0.25 || normalized > 10) throw new Error("Multiplier must be between 0.25 and 10.");
  getDb()
    .prepare(
      `INSERT INTO tournament_settings (id, activity_multiplier, updated_by, updated_at)
       VALUES (1, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         activity_multiplier = excluded.activity_multiplier,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(normalized, updatedBy);
  return getActivityMultiplierSetting();
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
  return applyGlobalRatingAdjustments([...basePlayers, ...getLateCallupPlayers(), ...cupLegendPlayers, ...DANGER_MILESTONE_PLAYERS]);
}

export function getDangerMilestonePlayers(): Player[] {
  return DANGER_MILESTONE_PLAYERS;
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
  const maxBaseId = [...basePlayers, ...cupLegendPlayers].reduce((max, player) => Math.max(max, player.id), 0);
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
  return [...basePlayers, ...getLateCallupPlayers(), ...cupLegendPlayers];
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
  return Math.max(1, Math.min(MAX_PLAYER_RATING, value));
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
  refreshFutureLockedSquads(userId, squad);
}

// Squad edits made before a lock window starts must count ("changed freely
// until the daily lock"), so re-snapshot any lock whose window hasn't begun.
function refreshFutureLockedSquads(userId: number, squad: Partial<Record<SquadSlot, number>>) {
  const database = getDb();
  const nowIso = new Date().toISOString();
  const futureLocks = database
    .prepare("SELECT id FROM locked_squads WHERE user_id = ? AND locked_at > ?")
    .all(userId, nowIso) as Array<{ id: number }>;
  if (futureLocks.length === 0) return;

  const playerNationMap = new Map(getAllPlayers().map((p) => [p.id, p]));
  const deletePlayers = database.prepare("DELETE FROM locked_squad_players WHERE locked_squad_id = ?");
  const insertPlayer = database.prepare("INSERT INTO locked_squad_players (locked_squad_id, slot, player_id, nation) VALUES (?, ?, ?, ?)");
  for (const lock of futureLocks) {
    deletePlayers.run(lock.id);
    for (const [slot, playerId] of Object.entries(squad)) {
      const p = playerId ? playerNationMap.get(playerId) : undefined;
      if (p) insertPlayer.run(lock.id, slot, p.id, p.nation);
    }
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
  const boosts = new Map<number, number>(rows.map((row) => [row.player_id, row.total]));
  const playerIds = (getDb().prepare("SELECT player_id FROM user_players WHERE user_id = ?").all(userId) as Array<{ player_id: number }>).map((row) => row.player_id);
  for (const [playerId, boost] of getCollectionBoostMapForPlayerIds(playerIds)) {
    boosts.set(playerId, (boosts.get(playerId) ?? 0) + boost);
  }
  return Object.fromEntries(boosts);
}

const DAILY_FREE_CREDITS = 2;
const STREAK_THRESHOLD_DAYS = 7;
const STREAK_BONUS_CREDITS = 1;

export function awardDailyCredits(userId: number): number {
  const db = getDb();
  ensureUserState(userId);
  const todayUTC = new Date().toISOString().slice(0, 10);
  // Atomic claim: only one concurrent caller can flip the date for today.
  const result = db
    .prepare("UPDATE user_state SET daily_credits_granted_date = ? WHERE user_id = ? AND (daily_credits_granted_date IS NULL OR daily_credits_granted_date <> ?)")
    .run(todayUTC, userId, todayUTC);
  if (result.changes === 0) return 0;
  const streakBonus = getActivityStreak(userId) >= STREAK_THRESHOLD_DAYS ? STREAK_BONUS_CREDITS : 0;
  db.prepare("UPDATE users SET reward_credits = reward_credits + ? WHERE id = ?").run(DAILY_FREE_CREDITS + streakBonus, userId);
  return DAILY_FREE_CREDITS + streakBonus;
}

// Consecutive days with at least one valid activity log, counting a run that
// ends today or yesterday (so the streak isn't broken before today's workout).
export function getActivityStreak(userId: number): number {
  const rows = getDb()
    .prepare("SELECT DISTINCT date(created_at) AS day FROM km_log WHERE user_id = ? AND voided_at IS NULL ORDER BY day DESC")
    .all(userId) as Array<{ day: string }>;
  if (rows.length === 0) return 0;

  const dayMs = 86400000;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - dayMs).toISOString().slice(0, 10);
  if (rows[0].day !== today && rows[0].day !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < rows.length; i++) {
    const expected = new Date(new Date(`${rows[i - 1].day}T12:00:00Z`).getTime() - dayMs).toISOString().slice(0, 10);
    if (rows[i].day !== expected) break;
    streak++;
  }
  return streak;
}

const NATION_COMPLETION_CREDITS = 25;
export const COLLECTION_COMPLETION_BOOST = 3;

export function getCompletedCollectionNationsForPlayerIds(playerIds: number[]): string[] {
  const owned = new Set(playerIds);
  const byNation = new Map<string, number[]>();
  for (const player of getAllPlayers()) {
    if (player.cupId || player.rarity === "dangerous") continue;
    const list = byNation.get(player.nation) ?? [];
    list.push(player.id);
    byNation.set(player.nation, list);
  }
  return Array.from(byNation.entries())
    .filter(([, ids]) => ids.length > 0 && ids.every((id) => owned.has(id)))
    .map(([nation]) => nation)
    .sort((a, b) => a.localeCompare(b));
}

export function getCollectionBoostMapForPlayerIds(playerIds: number[]): Map<number, number> {
  const owned = new Set(playerIds);
  const completedNations = new Set(getCompletedCollectionNationsForPlayerIds(playerIds));
  if (completedNations.size === 0) return new Map();
  const boosts = new Map<number, number>();
  for (const player of getAllPlayers()) {
    if (player.cupId || player.rarity === "dangerous" || !owned.has(player.id) || !completedNations.has(player.nation)) continue;
    boosts.set(player.id, COLLECTION_COMPLETION_BOOST);
  }
  return boosts;
}

export function awardNationCompletionRewards(userId: number): string[] {
  const db = getDb();
  const ownedIds = new Set(
    (db.prepare("SELECT player_id FROM user_players WHERE user_id = ?").all(userId) as Array<{ player_id: number }>).map((r) => r.player_id)
  );
  if (ownedIds.size === 0) return [];

  const byNation = new Map<string, number[]>();
  for (const player of getAllPlayers()) {
    if (player.cupId || player.rarity === "dangerous") continue;
    const list = byNation.get(player.nation) ?? [];
    list.push(player.id);
    byNation.set(player.nation, list);
  }

  const claim = db.prepare("INSERT OR IGNORE INTO nation_completion_rewards (user_id, nation, credits) VALUES (?, ?, ?)");
  const awarded: string[] = [];
  for (const [nation, playerIds] of byNation) {
    if (!playerIds.every((id) => ownedIds.has(id))) continue;
    const result = claim.run(userId, nation, NATION_COMPLETION_CREDITS);
    let creditsToAward = result.changes > 0 ? NATION_COMPLETION_CREDITS : 0;
    if (result.changes === 0) {
      const existing = db.prepare("SELECT credits FROM nation_completion_rewards WHERE user_id = ? AND nation = ?").get(userId, nation) as { credits: number } | undefined;
      if (existing && existing.credits < NATION_COMPLETION_CREDITS) {
        creditsToAward = NATION_COMPLETION_CREDITS - existing.credits;
        db.prepare("UPDATE nation_completion_rewards SET credits = ? WHERE user_id = ? AND nation = ?").run(NATION_COMPLETION_CREDITS, userId, nation);
      }
    }
    if (creditsToAward <= 0) continue;
    db.prepare("UPDATE users SET reward_credits = reward_credits + ? WHERE id = ?").run(creditsToAward, userId);
    awarded.push(nation);
    const username = (db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as { username: string } | undefined)?.username ?? "Someone";
    createAdminChatMessage(`📖 ${username} just completed the ${nation} page — full house! They've earned ${creditsToAward} pack credits.`);
  }
  return awarded;
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

export function awardPlayersInTransaction(database: DatabaseSync, userId: number, playerIds: number[], source: string, sourceId: number | null) {
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

export function getAdminFixtures() {
  return getDb()
    .prepare("SELECT match_id, home_team, away_team, match_date, status, winner FROM fixture_results ORDER BY kickoff_at DESC, match_id DESC")
    .all() as Array<{ match_id: string; home_team: string; away_team: string; match_date: string; status: string; winner: string | null }>;
}

export type AdminContributor = { id: number; playerId: number | null; name: string; count: number; status: string };
export type AdminCompletedGame = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  kickoffAt: string;
  winner: string | null;
  confirmed: boolean;
  scorers: AdminContributor[];
  assists: AdminContributor[];
};

// Every finished game with its recorded goal/assist scorers, for the admin
// review queue. Newest first.
export function getCompletedGamesWithScorers(): AdminCompletedGame[] {
  const db = getDb();
  const games = db
    .prepare("SELECT match_id, home_team, away_team, match_date, kickoff_at, winner, COALESCE(scorers_confirmed, 0) AS confirmed FROM fixture_results WHERE status = 'FINISHED' ORDER BY kickoff_at DESC, match_id DESC")
    .all() as Array<{ match_id: string; home_team: string; away_team: string; match_date: string; kickoff_at: string; winner: string | null; confirmed: number }>;

  const goalRows = db.prepare("SELECT id, match_id, player_id, scorer_name_raw, goal_count, status FROM goal_scorers").all() as Array<{ id: number; match_id: string; player_id: number | null; scorer_name_raw: string; goal_count: number; status: string }>;
  const assistRows = db.prepare("SELECT id, match_id, player_id, scorer_name_raw, assist_count, status FROM assist_scorers").all() as Array<{ id: number; match_id: string; player_id: number | null; scorer_name_raw: string; assist_count: number; status: string }>;
  const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));

  const nameFor = (playerId: number | null, raw: string) => (playerId != null ? playerMap.get(playerId)?.name ?? raw : raw);

  return games.map((g) => ({
    matchId: g.match_id,
    homeTeam: g.home_team,
    awayTeam: g.away_team,
    matchDate: g.match_date,
    kickoffAt: g.kickoff_at,
    winner: g.winner,
    confirmed: g.confirmed === 1,
    scorers: goalRows
      .filter((r) => r.match_id === g.match_id)
      .map((r) => ({ id: r.id, playerId: r.player_id, name: nameFor(r.player_id, r.scorer_name_raw), count: r.goal_count, status: r.status })),
    assists: assistRows
      .filter((r) => r.match_id === g.match_id)
      .map((r) => ({ id: r.id, playerId: r.player_id, name: nameFor(r.player_id, r.scorer_name_raw), count: r.assist_count, status: r.status }))
  }));
}

// Explains, for a user, why each matched scorer did or didn't boost them:
// whether the match fell inside one of their lock windows, whether the player
// was in that locked XI, and whether a boost row exists.
// Full breakdown of getDailyScore() for one user+date — every contributing
// row, not just the totals — so a manual recalculation can be checked
// line-by-line against exactly what the leaderboard/cup matches use.
export function getDailyScoreDiagnostic(username: string, date: string): { found: boolean; lines: string[] } {
  const db = getDb();
  const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username.trim().toLowerCase()) as { id: number; username: string } | undefined;
  if (!user) return { found: false, lines: [`No user named "${username}".`] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { found: false, lines: [`"${date}" isn't a YYYY-MM-DD date.`] };

  const { lockAt, unlockAt } = londonLockWindowForDate(date);
  const lockAtIso = lockAt.toISOString();
  const unlockAtIso = unlockAt.toISOString();
  const lines: string[] = [
    `User "${user.username}" — matchday ${date}`,
    `Window: ${lockAtIso} → ${unlockAtIso} (3pm UK → 3pm UK)`,
    ""
  ];

  lines.push("--- Activity (km_log) ---");
  const activityRows = db
    .prepare(
      `SELECT id, distance_km, activity_type, created_at, voided_at
       FROM km_log
       WHERE user_id = ? AND datetime(created_at) >= datetime(?) AND datetime(created_at) < datetime(?)
       ORDER BY created_at`
    )
    .all(user.id, lockAtIso, unlockAtIso) as Array<{ id: number; distance_km: number; activity_type: string; created_at: string; voided_at: string | null }>;
  if (activityRows.length === 0) lines.push("  (no km_log rows in this window)");
  for (const row of activityRows) {
    const voided = row.voided_at ? " — VOIDED, excluded" : "";
    lines.push(`  #${row.id} ${row.activity_type} +${row.distance_km} credits @ ${row.created_at}${voided}`);
  }

  lines.push("", "--- Nation wins (reward_events) ---");
  const winRows = db
    .prepare(
      `SELECT re.player_id, re.match_id, re.credits
       FROM reward_events re
       JOIN locked_squads ls ON ls.id = re.locked_squad_id
       WHERE re.user_id = ? AND ls.lock_date = ?
       ORDER BY re.id`
    )
    .all(user.id, date) as Array<{ player_id: number; match_id: string; credits: number }>;
  if (winRows.length === 0) lines.push("  (no reward_events rows for this lock_date)");
  const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));
  for (const row of winRows) {
    lines.push(`  ${playerMap.get(row.player_id)?.name ?? `#${row.player_id}`} won (${row.match_id}) — +${NATION_WIN_POINTS} pts`);
  }

  lines.push("", "--- Goal/assist boosts (goal_boosts) ---");
  const boostRows = db
    .prepare(
      `SELECT gb.player_id, gb.match_id, gb.boost_amount, fr.kickoff_at, fr.home_team, fr.away_team
       FROM goal_boosts gb
       JOIN fixture_results fr ON fr.match_id = (
         CASE WHEN gb.match_id LIKE '%:assist' THEN substr(gb.match_id, 1, length(gb.match_id) - 7) ELSE gb.match_id END
       )
       WHERE gb.user_id = ? AND fr.kickoff_at >= ? AND fr.kickoff_at < ?
       ORDER BY fr.kickoff_at`
    )
    .all(user.id, lockAtIso, unlockAtIso) as Array<{ player_id: number; match_id: string; boost_amount: number; kickoff_at: string; home_team: string; away_team: string }>;
  if (boostRows.length === 0) lines.push("  (no goal_boosts rows with a kickoff in this window)");
  for (const row of boostRows) {
    const isAssist = row.match_id.endsWith(":assist");
    lines.push(`  ${playerMap.get(row.player_id)?.name ?? `#${row.player_id}`} ${isAssist ? "assist" : "goal"} boost ${row.boost_amount >= 0 ? "+" : ""}${row.boost_amount} (${row.home_team} v ${row.away_team} @ ${row.kickoff_at})`);
  }

  const score = getDailyScore(db, user.id, date);
  lines.push(
    "",
    "--- Computed (what the leaderboard/cup match actually uses) ---",
    `Activity: raw ${score.activityRaw} → points ${score.activityPoints}${score.activityRaw > score.activityPoints ? " (capped at 40)" : ""}`,
    `Football: ${score.winCount} win(s) = ${score.winPoints} pts, boosts = ${score.boostRaw} pts → raw ${score.footballRaw} → points ${score.footballPoints}${score.footballRaw > score.footballPoints ? " (capped at 40)" : ""}`,
    `Total: ${score.total}`
  );

  return { found: true, lines };
}

export function getUserBoostDiagnostic(username: string): { found: boolean; lines: string[] } {
  const db = getDb();
  const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(username.trim().toLowerCase()) as { id: number; username: string } | undefined;
  if (!user) return { found: false, lines: [`No user named "${username}".`] };

  const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));
  const locks = db.prepare("SELECT id, lock_date, locked_at, unlock_at FROM locked_squads WHERE user_id = ? ORDER BY lock_date").all(user.id) as Array<{ id: number; lock_date: string; locked_at: string; unlock_at: string }>;
  const applied = new Set((db.prepare("SELECT player_id, match_id FROM goal_boosts WHERE user_id = ?").all(user.id) as Array<{ player_id: number; match_id: string }>).map((r) => `${r.player_id}|${r.match_id}`));

  type MatchedRow = { match_id: string; player_id: number; scorer_name_raw: string; cnt: number; scorer_status: string; home_team: string | null; away_team: string | null; kickoff_at: string | null; status: string | null };
  type PendingRow = { match_id: string; scorer_name_raw: string; cnt: number; scorer_status: string; home_team: string | null; away_team: string | null; kickoff_at: string | null; status: string | null };

  const goalRows = db.prepare("SELECT gs.match_id, gs.player_id, gs.scorer_name_raw, gs.goal_count AS cnt, gs.status AS scorer_status, fr.home_team, fr.away_team, fr.kickoff_at, fr.status FROM goal_scorers gs LEFT JOIN fixture_results fr ON fr.match_id = gs.match_id WHERE gs.status = 'matched' AND gs.player_id IS NOT NULL").all() as MatchedRow[];
  const assistRows = db.prepare("SELECT as2.match_id, as2.player_id, as2.scorer_name_raw, as2.assist_count AS cnt, as2.status AS scorer_status, fr.home_team, fr.away_team, fr.kickoff_at, fr.status FROM assist_scorers as2 LEFT JOIN fixture_results fr ON fr.match_id = as2.match_id WHERE as2.status = 'matched' AND as2.player_id IS NOT NULL").all() as MatchedRow[];
  const pendingGoalRows = db.prepare("SELECT gs.match_id, gs.scorer_name_raw, gs.goal_count AS cnt, gs.status AS scorer_status, fr.home_team, fr.away_team, fr.kickoff_at, fr.status FROM goal_scorers gs LEFT JOIN fixture_results fr ON fr.match_id = gs.match_id WHERE gs.status <> 'matched' OR gs.player_id IS NULL").all() as PendingRow[];
  const pendingAssistRows = db.prepare("SELECT as2.match_id, as2.scorer_name_raw, as2.assist_count AS cnt, as2.status AS scorer_status, fr.home_team, fr.away_team, fr.kickoff_at, fr.status FROM assist_scorers as2 LEFT JOIN fixture_results fr ON fr.match_id = as2.match_id WHERE as2.status <> 'matched' OR as2.player_id IS NULL").all() as PendingRow[];

  const lines: string[] = [`User "${user.username}" — ${locks.length} locked squad(s).`];
  if (locks.length === 0) lines.push("This user has no locked squads, so no boosts can apply.");
  const allLockedIds = new Set<number>();

  const fixtureLabel = (row: { home_team: string | null; away_team: string | null; status: string | null; kickoff_at: string | null; match_id: string }) =>
    `${row.home_team ?? "?"} v ${row.away_team ?? "?"}, fixture ${row.status ?? "missing"}, kickoff ${row.kickoff_at ?? "missing"}, match ${row.match_id}`;

  for (const lock of locks) {
    const lockedIds = new Set((db.prepare("SELECT player_id FROM locked_squad_players WHERE locked_squad_id = ?").all(lock.id) as Array<{ player_id: number }>).map((r) => r.player_id));
    lockedIds.forEach((id) => allLockedIds.add(id));
    lines.push(`\n[${lock.lock_date}] window ${lock.locked_at} -> ${lock.unlock_at} - ${lockedIds.size} players locked`);
    const report = (label: string, rows: MatchedRow[], assistKey: boolean) => {
      const inWindow = rows.filter((r) => r.kickoff_at && r.kickoff_at >= lock.locked_at && r.kickoff_at < lock.unlock_at);
      for (const r of inWindow) {
        const name = playerMap.get(r.player_id)?.name ?? `#${r.player_id}`;
        const isLocked = lockedIds.has(r.player_id);
        const key = `${r.player_id}|${assistKey ? `${r.match_id}:assist` : r.match_id}`;
        lines.push(`  ${label} ${name} (#${r.player_id}) x${r.cnt} [${fixtureLabel(r)}] - in locked XI: ${isLocked ? "YES" : "no"} - boost applied: ${applied.has(key) ? "yes" : "NO"}`);
      }
      if (inWindow.length === 0) lines.push(`  (no matched ${assistKey ? "assists" : "goals"} fell in this window)`);
    };
    report("goal", goalRows, false);
    report("assist", assistRows, true);
    const pendingGoalsInWindow = pendingGoalRows.filter((r) => r.kickoff_at && r.kickoff_at >= lock.locked_at && r.kickoff_at < lock.unlock_at);
    const pendingAssistsInWindow = pendingAssistRows.filter((r) => r.kickoff_at && r.kickoff_at >= lock.locked_at && r.kickoff_at < lock.unlock_at);
    for (const r of pendingGoalsInWindow) {
      lines.push(`  pending goal "${r.scorer_name_raw}" x${r.cnt} [${fixtureLabel(r)}] - scorer status ${r.scorer_status}; not matched to a card, so no boost can apply`);
    }
    for (const r of pendingAssistsInWindow) {
      lines.push(`  pending assist "${r.scorer_name_raw}" x${r.cnt} [${fixtureLabel(r)}] - scorer status ${r.scorer_status}; not matched to a card, so no boost can apply`);
    }
  }

  const outsideEveryWindow = (row: MatchedRow) => !row.kickoff_at || !locks.some((lock) => row.kickoff_at && row.kickoff_at >= lock.locked_at && row.kickoff_at < lock.unlock_at);
  const relevantOutsideGoals = goalRows.filter((row) => allLockedIds.has(row.player_id) && outsideEveryWindow(row));
  const relevantOutsideAssists = assistRows.filter((row) => allLockedIds.has(row.player_id) && outsideEveryWindow(row));
  if (relevantOutsideGoals.length > 0 || relevantOutsideAssists.length > 0) {
    lines.push("\nMatched scorer rows for players this user has locked, but outside every lock window:");
    for (const r of relevantOutsideGoals) {
      const name = playerMap.get(r.player_id)?.name ?? `#${r.player_id}`;
      lines.push(`  goal ${name} (#${r.player_id}) x${r.cnt} [${fixtureLabel(r)}]`);
    }
    for (const r of relevantOutsideAssists) {
      const name = playerMap.get(r.player_id)?.name ?? `#${r.player_id}`;
      lines.push(`  assist ${name} (#${r.player_id}) x${r.cnt} [${fixtureLabel(r)}]`);
    }
  }

  return { found: true, lines };
}

export function repairUserGoalBoost(username: string, playerId: number, matchDate?: string): { found: boolean; repaired: number; lines: string[] } {
  const db = getDb();
  const normalizedUsername = username.trim().toLowerCase();
  const user = db.prepare("SELECT id, username FROM users WHERE username = ?").get(normalizedUsername) as { id: number; username: string } | undefined;
  if (!user) return { found: false, repaired: 0, lines: [`No user named "${username}".`] };

  const player = getAllPlayers().find((item) => item.id === playerId);
  if (!player) return { found: true, repaired: 0, lines: [`No player with id #${playerId}.`] };

  const owned = db.prepare("SELECT player_id FROM user_players WHERE user_id = ? AND player_id = ?").get(user.id, playerId);
  const locks = db
    .prepare(
      `SELECT ls.id, ls.lock_date, ls.locked_at, ls.unlock_at, lsp.slot
       FROM locked_squads ls
       JOIN locked_squad_players lsp ON lsp.locked_squad_id = ls.id
       WHERE ls.user_id = ? AND lsp.player_id = ?
       ORDER BY ls.lock_date`
    )
    .all(user.id, playerId) as Array<{ id: number; lock_date: string; locked_at: string; unlock_at: string; slot: string }>;
  const scorerRows = db
    .prepare(
      `SELECT gs.id, gs.match_id, gs.scorer_name_raw, gs.goal_count, gs.status AS scorer_status,
              fr.match_date, fr.kickoff_at, fr.home_team, fr.away_team, fr.status AS fixture_status
       FROM goal_scorers gs
       LEFT JOIN fixture_results fr ON fr.match_id = gs.match_id
       WHERE gs.player_id = ?
         AND (? IS NULL OR fr.match_date = ?)
       ORDER BY fr.kickoff_at, gs.id`
    )
    .all(playerId, matchDate ?? null, matchDate ?? null) as Array<{
      id: number;
      match_id: string;
      scorer_name_raw: string;
      goal_count: number;
      scorer_status: string;
      match_date: string | null;
      kickoff_at: string | null;
      home_team: string | null;
      away_team: string | null;
      fixture_status: string | null;
    }>;
  const existingBoosts = new Set(
    (db.prepare("SELECT match_id FROM goal_boosts WHERE user_id = ? AND player_id = ?").all(user.id, playerId) as Array<{ match_id: string }>).map((row) => row.match_id)
  );

  const lines = [
    `Target: ${user.username} / ${player.name} (#${player.id}, ${player.rarity})${matchDate ? ` / ${matchDate}` : ""}`,
    `Owned card: ${owned ? "YES" : "NO"}`,
    `Locked squads containing player: ${locks.length}`,
    `Matched scorer rows for player: ${scorerRows.length}`
  ];
  for (const lock of locks) {
    lines.push(`  lock ${lock.lock_date} ${lock.locked_at} -> ${lock.unlock_at}, slot ${lock.slot}`);
  }
  for (const row of scorerRows) {
    lines.push(
      `  scorer row #${row.id}: ${row.scorer_name_raw} x${row.goal_count}, scorer ${row.scorer_status}, fixture ${row.fixture_status ?? "missing"}, ` +
        `${row.home_team ?? "?"} v ${row.away_team ?? "?"}, date ${row.match_date ?? "?"}, kickoff ${row.kickoff_at ?? "missing"}, match ${row.match_id}`
    );
  }

  let repaired = 0;
  for (const row of scorerRows) {
    if (row.scorer_status !== "matched") {
      lines.push(`  skip ${row.match_id}: scorer status is ${row.scorer_status}, not matched.`);
      continue;
    }
    if (row.fixture_status !== "FINISHED") {
      lines.push(`  skip ${row.match_id}: fixture status is ${row.fixture_status ?? "missing"}, not FINISHED.`);
      continue;
    }
    if (!row.kickoff_at) {
      lines.push(`  skip ${row.match_id}: missing kickoff_at.`);
      continue;
    }
    const matchingLocks = locks.filter((lock) => row.kickoff_at && row.kickoff_at >= lock.locked_at && row.kickoff_at < lock.unlock_at);
    if (matchingLocks.length === 0) {
      lines.push(`  skip ${row.match_id}: no locked squad containing ${player.name} covered kickoff ${row.kickoff_at}.`);
      continue;
    }
    const boostPerGoal = goalBoostByRarity[player.rarity] ?? 0;
    const amount = boostPerGoal * row.goal_count;
    if (amount === 0) {
      lines.push(`  skip ${row.match_id}: ${player.rarity} goal boost is 0.`);
      continue;
    }
    const result = db
      .prepare(
        `INSERT INTO goal_boosts (user_id, player_id, match_id, boost_amount)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, player_id, match_id) DO UPDATE SET
           boost_amount = excluded.boost_amount`
      )
      .run(user.id, playerId, row.match_id, amount);
    repaired += result.changes > 0 && !existingBoosts.has(row.match_id) ? 1 : 0;
    lines.push(`  applied ${amount > 0 ? `+${amount}` : amount} for ${row.match_id} (${matchingLocks.map((lock) => lock.lock_date).join(", ")}).`);
  }

  return { found: true, repaired, lines };
}

export function setScorersConfirmed(matchId: string, confirmed: boolean) {
  const db = getDb();
  db.prepare("UPDATE fixture_results SET scorers_confirmed = ? WHERE match_id = ?").run(confirmed ? 1 : 0, matchId);

  if (!confirmed) return;

  // Build a single summary chat message for this game, updating any existing one.
  const game = db.prepare("SELECT home_team, away_team, chat_message_id FROM fixture_results WHERE match_id = ?").get(matchId) as
    | { home_team: string; away_team: string; chat_message_id: number | null }
    | undefined;
  if (!game) return;

  const goalRows = db.prepare("SELECT scorer_name_raw, goal_count, player_id FROM goal_scorers WHERE match_id = ? AND status = 'matched'").all(matchId) as
    Array<{ scorer_name_raw: string; goal_count: number; player_id: number | null }>;
  const assistRows = db.prepare("SELECT scorer_name_raw, assist_count, player_id FROM assist_scorers WHERE match_id = ? AND status = 'matched'").all(matchId) as
    Array<{ scorer_name_raw: string; assist_count: number; player_id: number | null }>;
  const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));
  const nameFor = (playerId: number | null, raw: string) => (playerId != null ? playerMap.get(playerId)?.name ?? raw : raw);

  const scorerParts = goalRows.map((r) => `${nameFor(r.player_id, r.scorer_name_raw)}${r.goal_count > 1 ? ` ×${r.goal_count}` : ""}`);
  const assistParts = assistRows.map((r) => `${nameFor(r.player_id, r.scorer_name_raw)}${r.assist_count > 1 ? ` ×${r.assist_count}` : ""}`);

  const lines: string[] = [`⚽ ${game.home_team} vs ${game.away_team}`];
  if (scorerParts.length) lines.push(`Goals: ${scorerParts.join(", ")}`);
  if (assistParts.length) lines.push(`Assists: ${assistParts.join(", ")}`);
  if (!scorerParts.length && !assistParts.length) lines.push("No scorers or assists recorded.");
  const message = lines.join(" · ");

  if (game.chat_message_id != null) {
    db.prepare("UPDATE chat_messages SET message = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?").run(message, game.chat_message_id);
  } else {
    const newMsgId = createAdminChatMessage(message);
    if (newMsgId != null) {
      db.prepare("UPDATE fixture_results SET chat_message_id = ? WHERE match_id = ?").run(newMsgId, matchId);
    }
  }
}

// Delete a scorer record and reverse any boosts it awarded, so removal/correction
// is clean. Returns whether a row was removed.
export function deleteGoalScorer(id: number): boolean {
  const db = getDb();
  const row = db.prepare("SELECT match_id, player_id FROM goal_scorers WHERE id = ?").get(id) as { match_id: string; player_id: number | null } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM goal_scorers WHERE id = ?").run(id);
  if (row.player_id != null) db.prepare("DELETE FROM goal_boosts WHERE player_id = ? AND match_id = ?").run(row.player_id, row.match_id);
  return true;
}

export function deleteAssistScorer(id: number): boolean {
  const db = getDb();
  const row = db.prepare("SELECT match_id, player_id FROM assist_scorers WHERE id = ?").get(id) as { match_id: string; player_id: number | null } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM assist_scorers WHERE id = ?").run(id);
  if (row.player_id != null) db.prepare("DELETE FROM goal_boosts WHERE player_id = ? AND match_id = ?").run(row.player_id, `${row.match_id}:assist`);
  return true;
}

export function getBoostLog(limit = 40) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT gb.user_id, users.username, gb.player_id, gb.match_id, gb.boost_amount, gb.created_at
       FROM goal_boosts gb JOIN users ON users.id = gb.user_id
       ORDER BY gb.created_at DESC, gb.id DESC LIMIT ?`
    )
    .all(limit) as Array<{ user_id: number; username: string; player_id: number; match_id: string; boost_amount: number; created_at: string }>;

  const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));
  const fixtureMap = new Map(
    (db.prepare("SELECT match_id, home_team, away_team FROM fixture_results").all() as Array<{ match_id: string; home_team: string; away_team: string }>).map((f) => [f.match_id, f])
  );

  return rows.map((row) => {
    const isAssist = row.match_id.endsWith(":assist");
    const baseMatch = isAssist ? row.match_id.slice(0, -7) : row.match_id;
    const fixture = fixtureMap.get(baseMatch);
    return {
      username: row.username,
      playerName: playerMap.get(row.player_id)?.name ?? `Player ${row.player_id}`,
      eventType: isAssist ? ("assist" as const) : ("goal" as const),
      amount: row.boost_amount,
      match: fixture ? `${fixture.home_team} v ${fixture.away_team}` : baseMatch,
      createdAt: row.created_at
    };
  });
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
  activityType = "walk",
  activityAmount = activityCredits,
  activityUnit = "km",
  comment,
  rewardCreditValue,
  balanceBefore,
  balanceAfter,
  activityPlayerIds,
  generateBonusPlayerIds,
  chatMessageId
}: {
  userId: number;
  activityCredits: number;
  activityType?: ActivityType;
  activityAmount?: number;
  activityUnit?: string;
  comment?: string;
  rewardCreditValue?: number;
  balanceBefore: number;
  balanceAfter: number;
  activityPlayerIds: number[];
  generateBonusPlayerIds: (count: number) => number[];
  chatMessageId?: number | null;
}) {
  const database = getDb();
  database.exec("BEGIN IMMEDIATE");
  let username = "";

  try {
    ensureUserState(userId);
    const user = database.prepare("SELECT username, reward_credits FROM users WHERE id = ?").get(userId) as { username: string; reward_credits: number } | undefined;
    username = user?.username ?? "Someone";
    const current = database.prepare("SELECT total_km FROM user_state WHERE user_id = ?").get(userId) as { total_km: number };
    const newTotalKm = Number((current.total_km + activityCredits).toFixed(2));

    // Consume bonus pack credits atomically: read fresh inside the transaction,
    // convert exactly that many to pulls, and decrement by the amount consumed.
    const bonusCredits = Math.max(0, Math.floor(user?.reward_credits ?? 0));
    const bonusPlayerIds = bonusCredits > 0 ? generateBonusPlayerIds(bonusCredits) : [];
    const awardedPlayerIds = [...activityPlayerIds, ...bonusPlayerIds];
    const cardsEarned = awardedPlayerIds.length;

    database
      .prepare("UPDATE user_state SET total_km = ?, km_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .run(newTotalKm, balanceAfter, userId);
    if (bonusCredits > 0) {
      database.prepare("UPDATE users SET reward_credits = reward_credits - ? WHERE id = ?").run(bonusCredits, userId);
    }

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
    return { logId, totalKm: newTotalKm, kmBalance: balanceAfter, bonusCredits, awardedPlayerIds };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getKmLeaderboard() {
  const db = getDb();
  const adminUsernames = getAdminUsernames();
  const dailyWins = new Map<string, number>();
  for (const matchday of getMatchdayHeadToHead(1000)) {
    const winner = matchday.entries[0]?.username;
    if (winner) dailyWins.set(winner, (dailyWins.get(winner) ?? 0) + 1);
  }

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
  const playerBoostRows = db
    .prepare("SELECT user_id, player_id, SUM(boost_amount) AS boost FROM goal_boosts GROUP BY user_id, player_id")
    .all() as Array<{ user_id: number; player_id: number; boost: number }>;
  const playerBoostsByUser = new Map<number, Map<number, number>>();
  for (const row of playerBoostRows) {
    const boosts = playerBoostsByUser.get(row.user_id) ?? new Map<number, number>();
    boosts.set(row.player_id, row.boost ?? 0);
    playerBoostsByUser.set(row.user_id, boosts);
  }

  const byUser = new Map<number, number[]>();
  for (const row of visibleOwnedRows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.player_id);
    byUser.set(row.user_id, list);
  }

  const ranked = visibleRows
    .map((row) => ({
      userId: row.id,
      username: row.username,
      total_km: row.total_km,
      games_won: row.games_won,
      daily_wins: dailyWins.get(row.username) ?? 0,
      best_squad_rating: computeBestSquadRating(byUser.get(row.id) ?? [], playerBoostsByUser.get(row.id)),
      goal_bonus: boostByUser.get(row.id)?.goal_bonus ?? 0,
      assist_bonus: boostByUser.get(row.id)?.assist_bonus ?? 0
    }))
    .sort((a, b) => b.best_squad_rating - a.best_squad_rating || b.total_km - a.total_km);

  // Movement since the previous day's snapshot of the squad-avg ranking.
  const movementByUser = updateRankSnapshot(db, ranked.map((r) => r.userId));

  return ranked.map((row) => ({
    username: row.username,
    total_km: row.total_km,
    games_won: row.games_won,
    daily_wins: row.daily_wins,
    best_squad_rating: row.best_squad_rating,
    goal_bonus: row.goal_bonus,
    assist_bonus: row.assist_bonus,
    movement: movementByUser.get(row.userId) ?? null
  }));
}

// Records today's ranking and returns each user's rank change vs the most
// recent prior day's snapshot (positive = moved up, null = new this period).
function updateRankSnapshot(db: DatabaseSync, orderedUserIds: number[]): Map<number, number | null> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const prevDate = (db.prepare("SELECT MAX(snapshot_date) AS d FROM rank_snapshots WHERE snapshot_date < ?").get(today) as { d: string | null }).d;
  const prevRanks = new Map<number, number>();
  if (prevDate) {
    const rows = db.prepare("SELECT user_id, rank FROM rank_snapshots WHERE snapshot_date = ?").all(prevDate) as Array<{ user_id: number; rank: number }>;
    for (const r of rows) prevRanks.set(r.user_id, r.rank);
  }

  const movement = new Map<number, number | null>();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM rank_snapshots WHERE snapshot_date = ?").run(today);
    const insert = db.prepare("INSERT INTO rank_snapshots (snapshot_date, user_id, rank) VALUES (?, ?, ?)");
    orderedUserIds.forEach((userId, index) => {
      const currentRank = index + 1;
      insert.run(today, userId, currentRank);
      const prev = prevRanks.get(userId);
      movement.set(userId, prev === undefined ? null : prev - currentRank);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return movement;
}

// Daily head-to-head standings, computed with the exact same formula used to
// decide cup matches (see lib/server/dailyScoring.ts) — so the leaderboard's
// daily crown and a cup match winner are never decided by different rules.
// The day the new transparent activity+football scoring shipped. Days from
// here onward ALWAYS use it; days before it ALWAYS keep the old
// credits+boost ranking they were originally awarded under. This must stay
// a fixed date, not "today" recomputed on each request — otherwise a day
// that was live while it was happening would silently demote to legacy the
// moment the calendar rolls past it, flipping who "won" an already-decided
// day.
const SCORING_CUTOVER_DATE = "2026-06-25";

export function getMatchdayHeadToHead(limit = 10) {
  const db = getDb();
  const adminUsernames = getAdminUsernames();

  const legacy = getLegacyHeadToHead(db, adminUsernames, SCORING_CUTOVER_DATE);
  const live = getLiveHeadToHead(db, adminUsernames, SCORING_CUTOVER_DATE);

  return [...legacy, ...live].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

// Exact pre-cutover logic: a day only appears if someone actually earned a
// credit or a boost on it, ranked by credits then boost (no activity points).
function getLegacyHeadToHead(db: ReturnType<typeof getDb>, adminUsernames: Set<string>, cutoverDate: string) {
  const creditRows = db
    .prepare(
      `SELECT ls.lock_date AS date, users.username, SUM(re.credits) AS credits
       FROM reward_events re
       JOIN locked_squads ls ON ls.id = re.locked_squad_id
       JOIN users ON users.id = re.user_id
       WHERE ls.lock_date < ?
       GROUP BY ls.lock_date, re.user_id`
    )
    .all(cutoverDate) as Array<{ date: string; username: string; credits: number }>;

  const boostRows = db
    .prepare(
      `SELECT users.username, fr.kickoff_at, SUM(gb.boost_amount) AS boost
       FROM goal_boosts gb
       JOIN users ON users.id = gb.user_id
       JOIN fixture_results fr ON fr.match_id = CASE
         WHEN gb.match_id LIKE '%:assist' THEN substr(gb.match_id, 1, length(gb.match_id) - 7)
         ELSE gb.match_id END
       GROUP BY gb.user_id, fr.match_id`
    )
    .all() as Array<{ username: string; kickoff_at: string; boost: number }>;

  const byDate = new Map<string, Map<string, { credits: number; boost: number }>>();
  const entryFor = (date: string, username: string) => {
    if (adminUsernames.has(username.toLowerCase())) return null;
    const users = byDate.get(date) ?? new Map<string, { credits: number; boost: number }>();
    byDate.set(date, users);
    const entry = users.get(username) ?? { credits: 0, boost: 0 };
    users.set(username, entry);
    return entry;
  };
  for (const row of creditRows) {
    const entry = entryFor(row.date, row.username);
    if (entry) entry.credits += row.credits;
  }
  for (const row of boostRows) {
    const date = getLondonMatchday(new Date(row.kickoff_at));
    if (date >= cutoverDate) continue;
    const entry = entryFor(date, row.username);
    if (entry) entry.boost += row.boost;
  }

  return Array.from(byDate.entries()).map(([date, users]) => ({
    date,
    entries: Array.from(users.entries())
      .map(([username, totals]) => ({ method: "legacy" as const, username, credits: totals.credits, boost: totals.boost }))
      .sort((a, b) => b.credits - a.credits || b.boost - a.boost || a.username.localeCompare(b.username))
  }));
}

// New transparent scoring, shared with cup matches: a day only appears if
// someone had a locked squad that day, win or lose.
function getLiveHeadToHead(db: ReturnType<typeof getDb>, adminUsernames: Set<string>, cutoverDate: string) {
  const participantRows = db
    .prepare(
      `SELECT DISTINCT ls.lock_date AS date, ls.user_id AS userId, users.username AS username
       FROM locked_squads ls
       JOIN users ON users.id = ls.user_id
       WHERE ls.lock_date >= ?`
    )
    .all(cutoverDate) as Array<{ date: string; userId: number; username: string }>;

  const byDate = new Map<string, Array<{ userId: number; username: string }>>();
  for (const row of participantRows) {
    if (adminUsernames.has(row.username.toLowerCase())) continue;
    const list = byDate.get(row.date) ?? [];
    list.push({ userId: row.userId, username: row.username });
    byDate.set(row.date, list);
  }

  return Array.from(byDate.entries()).map(([date, participants]) => ({
    date,
    entries: participants
      .map(({ userId, username }) => ({ method: "live" as const, username, ...getDailyScore(db, userId, date) }))
      .sort((a, b) => compareDailyScores(a, b) || a.username.localeCompare(b.username))
  }));
}

// Returns true only for the first caller per (match, player, event) so a
// goal/assist is announced once game-wide, not once per user who locked them.
export function claimBoostAnnouncement(matchId: string, playerId: number, eventType: "goal" | "assist"): boolean {
  const result = getDb()
    .prepare("INSERT OR IGNORE INTO boost_announcements (match_id, player_id, event_type) VALUES (?, ?, ?)")
    .run(matchId, playerId, eventType);
  return result.changes > 0;
}

export function getProfileData(username: string) {
  const db = getDb();
  const user = db.prepare("SELECT id, username, created_at FROM users WHERE username = ?").get(username.trim().toLowerCase()) as
    | { id: number; username: string; created_at: string }
    | undefined;
  if (!user) return null;

  const ownedRows = db
    .prepare("SELECT player_id, duplicate_count FROM user_players WHERE user_id = ?")
    .all(user.id) as Array<{ player_id: number; duplicate_count: number }>;
  const state = db.prepare("SELECT total_km FROM user_state WHERE user_id = ?").get(user.id) as { total_km: number } | undefined;
  const wins = db
    .prepare("SELECT COUNT(DISTINCT match_id) AS games, COALESCE(SUM(credits), 0) AS credits FROM reward_events WHERE user_id = ?")
    .get(user.id) as { games: number; credits: number };
  const boosts = db
    .prepare("SELECT player_id, match_id, boost_amount, created_at FROM goal_boosts WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id) as Array<{ player_id: number; match_id: string; boost_amount: number; created_at: string }>;
  const ownedPlayerIds = ownedRows.map((row) => row.player_id);
  const collectionBoosts = getCollectionBoostMapForPlayerIds(ownedPlayerIds);
  const completedNations = getCompletedCollectionNationsForPlayerIds(ownedPlayerIds);

  const locks = db
    .prepare("SELECT id, lock_date FROM locked_squads WHERE user_id = ? ORDER BY lock_date DESC LIMIT 14")
    .all(user.id) as Array<{ id: number; lock_date: string }>;
  const lockPlayers = db.prepare("SELECT slot, player_id FROM locked_squad_players WHERE locked_squad_id = ? ORDER BY slot");

  return {
    username: user.username,
    joinedAt: user.created_at,
    totalKm: state?.total_km ?? 0,
    gamesWon: wins.games,
    winCredits: wins.credits,
    streak: getActivityStreak(user.id),
    ownedPlayerIds,
    duplicateCounts: Object.fromEntries(ownedRows.map((row) => [row.player_id, row.duplicate_count])),
    completedNations,
    collectionBoosts: Object.fromEntries(collectionBoosts),
    boosts: boosts.map((row) => ({
      playerId: row.player_id,
      matchId: row.match_id.endsWith(":assist") ? row.match_id.slice(0, -7) : row.match_id,
      type: row.match_id.endsWith(":assist") ? ("assist" as const) : ("goal" as const),
      amount: row.boost_amount,
      createdAt: row.created_at
    })),
    lockedHistory: locks.map((lock) => ({
      lockDate: lock.lock_date,
      players: (lockPlayers.all(lock.id) as Array<{ slot: string; player_id: number }>).map((row) => ({ slot: row.slot, playerId: row.player_id }))
    }))
  };
}

export function getOpenTradeOffers() {
  return getDb()
    .prepare(
      `SELECT t.id, t.user_id, t.player_id, t.created_at, users.username
       FROM trade_offers t
       JOIN users ON users.id = t.user_id
       WHERE t.status = 'open'
       ORDER BY t.created_at DESC`
    )
    .all() as Array<{ id: number; user_id: number; player_id: number; created_at: string; username: string }>;
}

export function expireStaleTradeProposals() {
  const db = getDb();
  db.prepare(
    `UPDATE trade_proposals
     SET status = 'rejected'
     WHERE status = 'pending'
       AND created_at <= datetime('now', '-1 day')`
  ).run();
  db.prepare(
    `UPDATE trade_offers
     SET status = 'cancelled'
     WHERE status = 'open'
       AND id NOT IN (SELECT offer_id FROM trade_proposals WHERE status = 'pending')`
  ).run();
}

export function getAutoTradeMarket(currentUserId: number) {
  expireStaleTradeProposals();
  return getDb()
    .prepare(
      `SELECT up.user_id, users.username, up.player_id, up.duplicate_count
       FROM user_players up
       JOIN users ON users.id = up.user_id
       WHERE up.user_id != ? AND up.duplicate_count > 0
       ORDER BY users.username, up.duplicate_count DESC`
    )
    .all(currentUserId) as Array<{ user_id: number; username: string; player_id: number; duplicate_count: number }>;
}

export function getActiveDirectTradeProposals(userId: number) {
  expireStaleTradeProposals();
  return getDb()
    .prepare(
      `SELECT p.id, p.user_id AS proposer_id, proposer.username AS proposer_username,
              p.player_id AS offered_player_id, p.created_at, datetime(p.created_at, '+1 day') AS expires_at,
              t.id AS offer_id, t.user_id AS target_user_id, target.username AS target_username,
              t.player_id AS wanted_player_id
       FROM trade_proposals p
       JOIN trade_offers t ON t.id = p.offer_id AND t.status = 'open'
       JOIN users proposer ON proposer.id = p.user_id
       JOIN users target ON target.id = t.user_id
       WHERE p.status = 'pending'
         AND (p.user_id = ? OR t.user_id = ?)
       ORDER BY p.created_at DESC`
    )
    .all(userId, userId) as Array<{
      id: number;
      proposer_id: number;
      proposer_username: string;
      offered_player_id: number;
      created_at: string;
      expires_at: string;
      offer_id: number;
      target_user_id: number;
      target_username: string;
      wanted_player_id: number;
    }>;
}

export function getRecentCompletedTrades(limit = 10) {
  return getDb()
    .prepare(
      `SELECT t.player_id, t.accepted_player_id, t.completed_at,
              offerer.username AS offerer_username, acceptor.username AS acceptor_username
       FROM trade_offers t
       JOIN users offerer ON offerer.id = t.user_id
       JOIN users acceptor ON acceptor.id = t.accepted_by
       WHERE t.status = 'completed'
       ORDER BY t.completed_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ player_id: number; accepted_player_id: number; completed_at: string; offerer_username: string; acceptor_username: string }>;
}

export function createDirectTradeProposal(proposerId: number, targetUserId: number, wantedPlayerId: number, offeredPlayerId: number): string | null {
  const db = getDb();
  expireStaleTradeProposals();
  if (targetUserId === proposerId) return "You can't propose a trade with yourself.";
  if (wantedPlayerId === offeredPlayerId) return "Choose two different cards for the swap.";

  const targetDupe = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(targetUserId, wantedPlayerId) as { duplicate_count: number } | undefined;
  if (!targetDupe || targetDupe.duplicate_count < 1) return "That player is no longer available as a duplicate.";

  const proposerDupe = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(proposerId, offeredPlayerId) as { duplicate_count: number } | undefined;
  if (!proposerDupe || proposerDupe.duplicate_count < 1) return "You can only offer a card you hold a duplicate of.";

  const playerMap = new Map(getAllPlayers().map((player) => [player.id, player]));
  const wantedPlayer = playerMap.get(wantedPlayerId);
  const offeredPlayer = playerMap.get(offeredPlayerId);
  if (!wantedPlayer || !offeredPlayer) return "One of those players could not be found.";
  if (wantedPlayer.rarity !== offeredPlayer.rarity) {
    return `Trades must match card status: offer another ${wantedPlayer.rarity} card for ${wantedPlayer.name}.`;
  }

  const existing = db
    .prepare(
      `SELECT p.id, t.id AS offer_id
       FROM trade_proposals p
       JOIN trade_offers t ON t.id = p.offer_id
       WHERE p.user_id = ? AND t.user_id = ? AND t.player_id = ?
         AND p.status = 'pending' AND t.status = 'open'`
    )
    .get(proposerId, targetUserId, wantedPlayerId) as { id: number; offer_id: number } | undefined;

  if (existing) {
    db.prepare("UPDATE trade_proposals SET player_id = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?").run(offeredPlayerId, existing.id);
    db.prepare("UPDATE trade_offers SET created_at = CURRENT_TIMESTAMP WHERE id = ?").run(existing.offer_id);
    return null;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const offer = db.prepare("INSERT INTO trade_offers (user_id, player_id) VALUES (?, ?)").run(targetUserId, wantedPlayerId);
    db.prepare("INSERT INTO trade_proposals (offer_id, user_id, player_id) VALUES (?, ?, ?)").run(Number(offer.lastInsertRowid), proposerId, offeredPlayerId);
    db.exec("COMMIT");
    return null;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createTradeOffer(userId: number, playerId: number): string | null {
  const db = getDb();
  const owned = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(userId, playerId) as { duplicate_count: number } | undefined;
  if (!owned || owned.duplicate_count < 1) return "You can only offer a player you hold a duplicate of.";

  const openForPlayer = db
    .prepare("SELECT COUNT(*) AS c FROM trade_offers WHERE user_id = ? AND player_id = ? AND status = 'open'")
    .get(userId, playerId) as { c: number };
  if (openForPlayer.c >= owned.duplicate_count) return "All your spare copies of this player are already up for trade.";

  db.prepare("INSERT INTO trade_offers (user_id, player_id) VALUES (?, ?)").run(userId, playerId);
  return null;
}

export function cancelTradeOffer(userId: number, offerId: number): string | null {
  const result = getDb()
    .prepare("UPDATE trade_offers SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'open'")
    .run(offerId, userId);
  return result.changes > 0 ? null : "Offer not found or no longer open.";
}

export function getPendingProposalsForOpenOffers() {
  return getDb()
    .prepare(
      `SELECT p.id, p.offer_id, p.user_id, p.player_id, p.created_at, users.username
       FROM trade_proposals p
       JOIN trade_offers t ON t.id = p.offer_id AND t.status = 'open'
       JOIN users ON users.id = p.user_id
       WHERE p.status = 'pending'
       ORDER BY p.created_at`
    )
    .all() as Array<{ id: number; offer_id: number; user_id: number; player_id: number; created_at: string; username: string }>;
}

export function proposeTrade(offerId: number, userId: number, playerId: number): string | null {
  const db = getDb();
  const offer = db.prepare("SELECT id, user_id, player_id FROM trade_offers WHERE id = ? AND status = 'open'").get(offerId) as
    | { id: number; user_id: number; player_id: number }
    | undefined;
  if (!offer) return "That offer is no longer open.";
  if (offer.user_id === userId) return "You can't propose on your own offer.";
  if (offer.player_id === playerId) return "Offering the same player back would be pointless, even by clown standards.";

  const dupe = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(userId, playerId) as { duplicate_count: number } | undefined;
  if (!dupe || dupe.duplicate_count < 1) return "You can only propose a player you hold a duplicate of.";

  const existing = db.prepare("SELECT id FROM trade_proposals WHERE offer_id = ? AND user_id = ? AND status = 'pending'").get(offerId, userId) as { id: number } | undefined;
  if (existing) {
    db.prepare("UPDATE trade_proposals SET player_id = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?").run(playerId, existing.id);
  } else {
    db.prepare("INSERT INTO trade_proposals (offer_id, user_id, player_id) VALUES (?, ?, ?)").run(offerId, userId, playerId);
  }
  return null;
}

export function withdrawTradeProposal(userId: number, proposalId: number): string | null {
  const result = getDb()
    .prepare("UPDATE trade_proposals SET status = 'withdrawn' WHERE id = ? AND user_id = ? AND status = 'pending'")
    .run(proposalId, userId);
  return result.changes > 0 ? null : "Proposal not found or no longer pending.";
}

export function declineTradeProposal(offererId: number, proposalId: number): string | null {
  const result = getDb()
    .prepare(
      `UPDATE trade_proposals SET status = 'rejected'
       WHERE id = ? AND status = 'pending'
         AND offer_id IN (SELECT id FROM trade_offers WHERE user_id = ? AND status = 'open')`
    )
    .run(proposalId, offererId);
  return result.changes > 0 ? null : "Proposal not found or no longer pending.";
}

export function confirmTradeProposal(offererId: number, proposalId: number): string | null {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const proposal = db
      .prepare(
        `SELECT p.id, p.user_id, p.player_id, p.offer_id, t.user_id AS offerer_id, t.player_id AS offer_player_id
         FROM trade_proposals p
         JOIN trade_offers t ON t.id = p.offer_id
         WHERE p.id = ? AND p.status = 'pending' AND t.status = 'open'`
      )
      .get(proposalId) as
      | { id: number; user_id: number; player_id: number; offer_id: number; offerer_id: number; offer_player_id: number }
      | undefined;
    if (!proposal || proposal.offerer_id !== offererId) {
      db.exec("ROLLBACK");
      return "Proposal not found or no longer pending.";
    }

    const offererDupe = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(offererId, proposal.offer_player_id) as { duplicate_count: number } | undefined;
    if (!offererDupe || offererDupe.duplicate_count < 1) {
      db.prepare("UPDATE trade_offers SET status = 'cancelled' WHERE id = ?").run(proposal.offer_id);
      db.exec("COMMIT");
      return "You no longer hold a spare copy of your offered player — offer withdrawn.";
    }
    const proposerDupe = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(proposal.user_id, proposal.player_id) as { duplicate_count: number } | undefined;
    if (!proposerDupe || proposerDupe.duplicate_count < 1) {
      db.prepare("UPDATE trade_proposals SET status = 'rejected' WHERE id = ?").run(proposal.id);
      db.exec("COMMIT");
      return "The proposer no longer holds a spare copy — proposal rejected.";
    }

    transferTradedPlayer(db, offererId, proposal.user_id, proposal.offer_player_id);
    transferTradedPlayer(db, proposal.user_id, offererId, proposal.player_id);

    db.prepare("UPDATE trade_offers SET status = 'completed', accepted_by = ?, accepted_player_id = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(proposal.user_id, proposal.player_id, proposal.offer_id);
    db.prepare("UPDATE trade_proposals SET status = 'accepted' WHERE id = ?").run(proposal.id);
    db.prepare("UPDATE trade_proposals SET status = 'rejected' WHERE offer_id = ? AND status = 'pending'").run(proposal.offer_id);
    db.exec("COMMIT");

    // Post to chat only for premium-rarity swaps (icon, legend, epic)
    const premiumRarities = new Set(["icon", "legend", "epic"]);
    const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));
    const givenPlayer = playerMap.get(proposal.offer_player_id);
    const receivedPlayer = playerMap.get(proposal.player_id);
    if (givenPlayer && receivedPlayer && (premiumRarities.has(givenPlayer.rarity) || premiumRarities.has(receivedPlayer.rarity))) {
      const offererName = (db.prepare("SELECT username FROM users WHERE id = ?").get(offererId) as { username: string } | undefined)?.username ?? "Someone";
      const proposerName = (db.prepare("SELECT username FROM users WHERE id = ?").get(proposal.user_id) as { username: string } | undefined)?.username ?? "Someone";
      const emoji = givenPlayer.rarity === "icon" || receivedPlayer.rarity === "icon" ? "🌟" : givenPlayer.rarity === "legend" || receivedPlayer.rarity === "legend" ? "🏆" : "💎";
      createAdminChatMessage(`${emoji} ${offererName} and ${proposerName} just pulled off a big one — ${givenPlayer.name} (${givenPlayer.rarity}) for ${receivedPlayer.name} (${receivedPlayer.rarity}).`);
    }

    return null;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// Moves one copy of a player from one user to another: the giver spends a
// duplicate, the receiver gains a duplicate (if owned) or the sticker itself.
function transferTradedPlayer(db: DatabaseSync, fromUserId: number, toUserId: number, playerId: number) {
  db.prepare("UPDATE user_players SET duplicate_count = duplicate_count - 1 WHERE user_id = ? AND player_id = ?").run(fromUserId, playerId);
  const existing = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(toUserId, playerId);
  if (existing) {
    db.prepare("UPDATE user_players SET duplicate_count = duplicate_count + 1 WHERE user_id = ? AND player_id = ?").run(toUserId, playerId);
  } else {
    db.prepare("INSERT INTO user_players (user_id, player_id, duplicate_count) VALUES (?, ?, 0)").run(toUserId, playerId);
  }
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

export function getStickerAwardStats() {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) AS count FROM card_awards").get() as { count: number }).count;
  const rows = db
    .prepare("SELECT rarity, COUNT(*) AS count FROM card_awards GROUP BY rarity")
    .all() as Array<{ rarity: Rarity; count: number }>;
  const counts = new Map<Rarity, number>(rows.map((row) => [row.rarity, row.count]));
  let previousCeiling = 0;
  const byRarity = rarityOdds.map((item) => {
    const expectedPct = Math.round((item.ceiling - previousCeiling) * 10000) / 100;
    previousCeiling = item.ceiling;
    const count = counts.get(item.rarity) ?? 0;
    const actualPct = total > 0 ? Math.round((count / total) * 10000) / 100 : 0;
    return {
      rarity: item.rarity,
      count,
      actualPct,
      expectedPct,
      deltaPct: Math.round((actualPct - expectedPct) * 100) / 100
    };
  });
  const bySource = db
    .prepare("SELECT source, COUNT(*) AS count FROM card_awards GROUP BY source ORDER BY count DESC")
    .all() as Array<{ source: string; count: number }>;

  return { total, byRarity, bySource };
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

function computeBestSquadRating(playerIds: number[], boosts = new Map<number, number>()): number {
  if (playerIds.length === 0) return 0;
  const allPlayersForRating = getAllPlayers();
  const owned = playerIds.map((id) => allPlayersForRating.find((p) => p.id === id)).filter((player): player is Player => Boolean(player));
  const collectionBoosts = getCollectionBoostMapForPlayerIds(playerIds);
  const used = new Set<number>();
  const positions = ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"];
  const picked: number[] = [];

  for (const pos of positions) {
    const best = owned
      .filter((p) => p.pos === pos && !used.has(p.id))
      .sort((a, b) => getEffectiveRatingForSort(b, boosts, collectionBoosts) - getEffectiveRatingForSort(a, boosts, collectionBoosts) || a.name.localeCompare(b.name))[0];
    if (best) {
      used.add(best.id);
      picked.push(getEffectiveRatingForSort(best, boosts, collectionBoosts));
    }
  }

  if (picked.length === 0) return 0;
  return Math.round((picked.reduce((s, r) => s + r, 0) / picked.length) * 10) / 10;
}

function getEffectiveRatingForSort(player: Player, boosts: Map<number, number>, collectionBoosts: Map<number, number>) {
  return player.rating + (boosts.get(player.id) ?? 0) + (collectionBoosts.get(player.id) ?? 0);
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
  const bonusRows = db
    .prepare(
      `SELECT user_id, player_id,
              SUM(CASE WHEN match_id LIKE '%:assist' THEN 0 ELSE boost_amount END) AS goal_boost,
              SUM(CASE WHEN match_id LIKE '%:assist' THEN boost_amount ELSE 0 END) AS assist_boost
       FROM goal_boosts
       GROUP BY user_id, player_id`
    )
    .all() as Array<{ user_id: number; player_id: number; goal_boost: number | null; assist_boost: number | null }>;
  const winRows = db
    .prepare("SELECT user_id, player_id, SUM(credits) AS win_credits FROM reward_events GROUP BY user_id, player_id")
    .all() as Array<{ user_id: number; player_id: number; win_credits: number | null }>;
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
  const bonusByUser = new Map<number, Map<number, { goalBoost: number; assistBoost: number; winCredits: number }>>();
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

  for (const row of bonusRows) {
    const bonuses = bonusByUser.get(row.user_id) ?? new Map<number, { goalBoost: number; assistBoost: number; winCredits: number }>();
    const current = bonuses.get(row.player_id) ?? { goalBoost: 0, assistBoost: 0, winCredits: 0 };
    bonuses.set(row.player_id, { ...current, goalBoost: row.goal_boost ?? 0, assistBoost: row.assist_boost ?? 0 });
    bonusByUser.set(row.user_id, bonuses);
  }

  for (const row of winRows) {
    const bonuses = bonusByUser.get(row.user_id) ?? new Map<number, { goalBoost: number; assistBoost: number; winCredits: number }>();
    const current = bonuses.get(row.player_id) ?? { goalBoost: 0, assistBoost: 0, winCredits: 0 };
    bonuses.set(row.player_id, { ...current, winCredits: row.win_credits ?? 0 });
    bonusByUser.set(row.user_id, bonuses);
  }

  for (const row of lockedRows) {
    const locked = lockedByUser.get(row.user_id) ?? { lockDate: row.lock_date, players: [] };
    locked.players.push({ slot: row.slot, playerId: row.player_id });
    lockedByUser.set(row.user_id, locked);
  }

  return visibleUsers
    .map((user) => {
      const boosts = boostsByUser.get(user.id) ?? new Map<number, number>();
      const bonuses = bonusByUser.get(user.id) ?? new Map<number, { goalBoost: number; assistBoost: number; winCredits: number }>();
      const ownedPlayerIds = ownedByUser.get(user.id) ?? [];
      const collectionBoosts = getCollectionBoostMapForPlayerIds(ownedPlayerIds);
      const best = pickBestCommunitySquad(ownedPlayerIds, boosts, collectionBoosts, bonuses, playerById);
      const locked = lockedByUser.get(user.id);
      const lockedPlayers = locked
        ? communitySquadSlots
            .map((slot) => locked.players.find((player) => player.slot === slot))
            .filter((player): player is { slot: SquadSlot; playerId: number } => Boolean(player))
            .map((player) => toCommunitySquadPlayer(player.slot, player.playerId, boosts, collectionBoosts, bonuses, playerById))
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

function pickBestCommunitySquad(playerIds: number[], boosts: Map<number, number>, collectionBoosts: Map<number, number>, bonuses: Map<number, { goalBoost: number; assistBoost: number; winCredits: number }>, playerById: Map<number, Player>) {
  const owned = playerIds
    .map((id) => playerById.get(id))
    .filter((player): player is Player => Boolean(player));
  const used = new Set<number>();
  const players: Array<NonNullable<ReturnType<typeof toCommunitySquadPlayer>>> = [];

  for (const slot of communitySquadSlots) {
    const position = slot.startsWith("DF") ? "DF" : slot.startsWith("MF") ? "MF" : slot.startsWith("FW") ? "FW" : "GK";
    const player = owned
      .filter((candidate) => candidate.pos === position && !used.has(candidate.id))
      .sort((a, b) => getEffectiveRatingForSort(b, boosts, collectionBoosts) - getEffectiveRatingForSort(a, boosts, collectionBoosts) || a.name.localeCompare(b.name))[0];
    if (player) {
      used.add(player.id);
      const squadPlayer = toCommunitySquadPlayer(slot, player.id, boosts, collectionBoosts, bonuses, playerById);
      if (squadPlayer) players.push(squadPlayer);
    }
  }

  return {
    rating: averageCommunityRating(players),
    players
  };
}

function toCommunitySquadPlayer(slot: SquadSlot, playerId: number, boosts: Map<number, number>, collectionBoosts: Map<number, number>, bonuses: Map<number, { goalBoost: number; assistBoost: number; winCredits: number }>, playerById: Map<number, Player>) {
  const player = playerById.get(playerId);
  if (!player) return null;
  const boost = boosts.get(player.id) ?? 0;
  const collectionBoost = collectionBoosts.get(player.id) ?? 0;
  const bonus = bonuses.get(player.id) ?? { goalBoost: 0, assistBoost: 0, winCredits: 0 };
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
    collectionBoost,
    goalBoost: bonus.goalBoost,
    assistBoost: bonus.assistBoost,
    winCredits: bonus.winCredits,
    effectiveRating: player.rating + boost + collectionBoost
  };
}

export function getAdminMatchMonitor(limit = 80) {
  const fixtures = getDb()
    .prepare(
      `SELECT fixture_results.match_id, fixture_results.match_date, fixture_results.kickoff_at,
              fixture_results.home_team, fixture_results.away_team, fixture_results.winner,
              fixture_results.status, fixture_results.source, fixture_results.verified,
              fixture_results.updated_at,
              COALESCE(rewards.reward_count, 0) AS reward_count,
              COALESCE(rewards.credit_total, 0) AS credit_total,
              COALESCE(goals.goal_records, 0) AS goal_records,
              COALESCE(goals.matched_goal_records, 0) AS matched_goal_records,
              COALESCE(assists.assist_records, 0) AS assist_records,
              COALESCE(assists.matched_assist_records, 0) AS matched_assist_records
       FROM fixture_results
       LEFT JOIN (
         SELECT match_id, COUNT(*) AS reward_count, SUM(credits) AS credit_total
         FROM reward_events
         GROUP BY match_id
       ) rewards ON rewards.match_id = fixture_results.match_id
       LEFT JOIN (
         SELECT match_id, COUNT(*) AS goal_records,
                SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) AS matched_goal_records
         FROM goal_scorers
         GROUP BY match_id
       ) goals ON goals.match_id = fixture_results.match_id
       LEFT JOIN (
         SELECT match_id, COUNT(*) AS assist_records,
                SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) AS matched_assist_records
         FROM assist_scorers
         GROUP BY match_id
       ) assists ON assists.match_id = fixture_results.match_id
       ORDER BY fixture_results.kickoff_at
       LIMIT ?`
    )
    .all(limit) as Array<{
      match_id: string;
      match_date: string;
      kickoff_at: string;
      home_team: string;
      away_team: string;
      winner: string | null;
      status: string;
      source: string;
      verified: number;
      updated_at: string | null;
      reward_count: number;
      credit_total: number;
      goal_records: number;
      matched_goal_records: number;
      assist_records: number;
      matched_assist_records: number;
    }>;

  const provider = getDb()
    .prepare("SELECT provider, status, message, checked_at FROM fixture_provider_runs ORDER BY checked_at DESC, id DESC LIMIT 1")
    .get() as { provider: string; status: string; message: string | null; checked_at: string } | undefined;

  return {
    providerStatus: provider
      ? { provider: provider.provider, status: provider.status, message: provider.message ?? "", checkedAt: provider.checked_at }
      : null,
    fixtures: fixtures.map((fixture) => ({
      matchId: fixture.match_id,
      matchDate: fixture.match_date,
      kickoffAt: fixture.kickoff_at,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      winner: fixture.winner,
      status: fixture.status,
      source: fixture.source,
      verified: fixture.verified === 1,
      updatedAt: fixture.updated_at,
      rewardCount: fixture.reward_count,
      creditTotal: fixture.credit_total,
      goalRecords: fixture.goal_records,
      matchedGoalRecords: fixture.matched_goal_records,
      assistRecords: fixture.assist_records,
      matchedAssistRecords: fixture.matched_assist_records
    }))
  };
}

function averageCommunityRating(players: Array<{ effectiveRating: number }>) {
  if (players.length === 0) return 0;
  return Math.round((players.reduce((sum, player) => sum + player.effectiveRating, 0) / players.length) * 10) / 10;
}

// Fixtures kicking off inside the lock window [startIso, endIso). This matches
// how live settlement buckets matches (by kickoff_at, not calendar match_date),
// so a late kickoff that rolls past midnight UTC still shows under its lock day.
export function getFixturesInWindow(startIso: string, endIso: string) {
  return getDb()
    .prepare(`SELECT match_id, home_team, away_team, kickoff_at, status, winner FROM fixture_results WHERE kickoff_at >= ? AND kickoff_at < ? ORDER BY kickoff_at`)
    .all(startIso, endIso) as Array<{ match_id: string; home_team: string; away_team: string; kickoff_at: string; status: string; winner: string | null }>;
}

// All fixtures grouped by calendar date (newest first), each with the matched
// KMXI-pool scorers and assisters. Scorers outside the sticker pool aren't
// tracked, so this shows the players that matter for the game.
export function getResultsByDay() {
  const db = getDb();
  const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));

  const fixtures = db
    .prepare(`SELECT match_id, match_date, kickoff_at, home_team, away_team, winner, status FROM fixture_results ORDER BY kickoff_at ASC, match_id ASC`)
    .all() as Array<{ match_id: string; match_date: string; kickoff_at: string; home_team: string; away_team: string; winner: string | null; status: string }>;

  const goalRows = db
    .prepare("SELECT match_id, player_id, goal_count FROM goal_scorers WHERE status = 'matched' AND player_id IS NOT NULL")
    .all() as Array<{ match_id: string; player_id: number; goal_count: number }>;
  const assistRows = db
    .prepare("SELECT match_id, player_id, assist_count FROM assist_scorers WHERE status = 'matched' AND player_id IS NOT NULL")
    .all() as Array<{ match_id: string; player_id: number; assist_count: number }>;

  type Contributor = { name: string; nation: string; rarity: string; count: number };
  const goalsByMatch = new Map<string, Contributor[]>();
  const assistsByMatch = new Map<string, Contributor[]>();

  for (const row of goalRows) {
    const player = playerMap.get(row.player_id);
    if (!player) continue;
    const list = goalsByMatch.get(row.match_id) ?? [];
    list.push({ name: player.name, nation: player.nation, rarity: player.rarity, count: row.goal_count });
    goalsByMatch.set(row.match_id, list);
  }
  for (const row of assistRows) {
    const player = playerMap.get(row.player_id);
    if (!player) continue;
    const list = assistsByMatch.get(row.match_id) ?? [];
    list.push({ name: player.name, nation: player.nation, rarity: player.rarity, count: row.assist_count });
    assistsByMatch.set(row.match_id, list);
  }

  const byDate = new Map<string, Array<{
    matchId: string;
    kickoffAt: string;
    homeTeam: string;
    awayTeam: string;
    winner: string | null;
    status: string;
    scorers: Contributor[];
    assisters: Contributor[];
  }>>();

  for (const fixture of fixtures) {
    const list = byDate.get(fixture.match_date) ?? [];
    list.push({
      matchId: fixture.match_id,
      kickoffAt: fixture.kickoff_at,
      homeTeam: fixture.home_team,
      awayTeam: fixture.away_team,
      winner: fixture.winner,
      status: fixture.status,
      scorers: (goalsByMatch.get(fixture.match_id) ?? []).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      assisters: (assistsByMatch.get(fixture.match_id) ?? []).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    });
    byDate.set(fixture.match_date, list);
  }

  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, matches]) => ({ date, matches }));
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
  if (!colNames.has("live_settle_key")) {
    database.exec("ALTER TABLE user_state ADD COLUMN live_settle_key TEXT");
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

function migrateCupRewardEvents(database: DatabaseSync) {
  const cols = database.prepare("PRAGMA table_info(cup_reward_events)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));
  if (colNames.size > 0 && !colNames.has("reversed_at")) {
    database.exec("ALTER TABLE cup_reward_events ADD COLUMN reversed_at TEXT");
  }
  if (colNames.size > 0 && !colNames.has("reversal_reason")) {
    database.exec("ALTER TABLE cup_reward_events ADD COLUMN reversal_reason TEXT");
  }
}

function migrateFixtureResults(database: DatabaseSync) {
  const fixtureColumns = database.prepare("PRAGMA table_info(fixture_results)").all() as Array<{ name: string }>;
  const fixtureColumnNames = new Set(fixtureColumns.map((column) => column.name));
  if (!fixtureColumnNames.has("verified")) database.exec("ALTER TABLE fixture_results ADD COLUMN verified INTEGER NOT NULL DEFAULT 0");
  if (!fixtureColumnNames.has("updated_at")) database.exec("ALTER TABLE fixture_results ADD COLUMN updated_at TEXT");
  if (!fixtureColumnNames.has("goals_synced")) database.exec("ALTER TABLE fixture_results ADD COLUMN goals_synced INTEGER NOT NULL DEFAULT 0");
  if (!fixtureColumnNames.has("scorers_confirmed")) database.exec("ALTER TABLE fixture_results ADD COLUMN scorers_confirmed INTEGER NOT NULL DEFAULT 0");
  if (!fixtureColumnNames.has("chat_message_id")) database.exec("ALTER TABLE fixture_results ADD COLUMN chat_message_id INTEGER");

  database.prepare("UPDATE fixture_results SET verified = 1 WHERE source = 'seed' OR source = 'manual'").run();
  database.prepare("UPDATE fixture_results SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL").run();

  // Normalise legacy team/winner name variants to the canonical player-data
  // nation strings so "playing today", win credits, and boosts all match.
  const nationFixes: Array<[string[], string]> = [
    [["Bosnia", "Bosnia-Herzegovina", "Bosnia & Herzegovina"], "Bosnia and Herzegovina"],
    [["USA", "United States of America"], "United States"],
    [["Korea Republic", "Republic of Korea"], "South Korea"],
    [["Czechia"], "Czech Republic"],
    [["Congo DR"], "DR Congo"],
    [["Côte d'Ivoire", "Cote d'Ivoire"], "Ivory Coast"],
    [["Cabo Verde"], "Cape Verde"],
    [["Türkiye", "Turkiye"], "Turkey"],
    [["IR Iran", "Iran (Islamic Republic of)"], "Iran"],
    [["Curacao"], "Curaçao"]
  ];
  for (const [variants, canonical] of nationFixes) {
    for (const variant of variants) {
      database.prepare("UPDATE fixture_results SET home_team = ?, updated_at = CURRENT_TIMESTAMP WHERE home_team = ?").run(canonical, variant);
      database.prepare("UPDATE fixture_results SET away_team = ?, updated_at = CURRENT_TIMESTAMP WHERE away_team = ?").run(canonical, variant);
      database.prepare("UPDATE fixture_results SET winner = ?, updated_at = CURRENT_TIMESTAMP WHERE winner = ?").run(canonical, variant);
    }
  }
}

// ── Random Swap ───────────────────────────────────────────────

function getEligibleRandomSwapPlayerIds(db: DatabaseSync, userId: number): number[] {
  const owned = db.prepare("SELECT player_id FROM user_players WHERE user_id = ?").all(userId) as { player_id: number }[];

  const lockedIds = new Set<number>(
    (
      db
        .prepare(
          `SELECT lsp.player_id FROM locked_squad_players lsp
           JOIN locked_squads ls ON ls.id = lsp.locked_squad_id
           WHERE ls.user_id = ?`
        )
        .all(userId) as { player_id: number }[]
    ).map((r) => r.player_id)
  );

  const completedNations = new Set<string>(
    (db.prepare("SELECT nation FROM nation_completion_rewards WHERE user_id = ?").all(userId) as { nation: string }[]).map((r) => r.nation)
  );

  const playerNationMap = new Map(basePlayers.map((p) => [p.id, p.nation]));

  return owned
    .filter((r) => !lockedIds.has(r.player_id))
    .filter((r) => {
      const nation = playerNationMap.get(r.player_id);
      return nation !== undefined && !completedNations.has(nation);
    })
    .map((r) => r.player_id);
}

function transferRandomSwapPlayer(db: DatabaseSync, fromUserId: number, toUserId: number, playerId: number) {
  const giver = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(fromUserId, playerId) as { duplicate_count: number } | undefined;
  if (!giver) return;
  if (giver.duplicate_count > 0) {
    db.prepare("UPDATE user_players SET duplicate_count = duplicate_count - 1 WHERE user_id = ? AND player_id = ?").run(fromUserId, playerId);
  } else {
    db.prepare("DELETE FROM user_players WHERE user_id = ? AND player_id = ?").run(fromUserId, playerId);
  }
  const receiver = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(toUserId, playerId) as { duplicate_count: number } | undefined;
  if (receiver) {
    db.prepare("UPDATE user_players SET duplicate_count = duplicate_count + 1 WHERE user_id = ? AND player_id = ?").run(toUserId, playerId);
  } else {
    db.prepare("INSERT INTO user_players (user_id, player_id, duplicate_count) VALUES (?, ?, 0)").run(toUserId, playerId);
  }
}

export function initiateRandomSwap(challengerId: number, targetId: number): { ok: boolean; error?: string } {
  if (challengerId === targetId) return { ok: false, error: "Cannot challenge yourself." };
  const db = getDb();

  const existing = db
    .prepare(
      `SELECT id FROM random_swaps WHERE status = 'pending'
       AND ((challenger_id = ? AND target_id = ?) OR (challenger_id = ? AND target_id = ?))`
    )
    .get(challengerId, targetId, targetId, challengerId) as { id: number } | undefined;
  if (existing) return { ok: false, error: "A random swap challenge is already pending between you two." };

  const eligible = getEligibleRandomSwapPlayerIds(db, challengerId);
  if (eligible.length === 0) return { ok: false, error: "You have no eligible players to put in the pot." };

  db.prepare("INSERT INTO random_swaps (challenger_id, target_id) VALUES (?, ?)").run(challengerId, targetId);
  return { ok: true };
}

export function respondToRandomSwap(swapId: number, userId: number, action: "accept" | "decline" | "withdraw"): { ok: boolean; error?: string } {
  const db = getDb();
  const swap = db.prepare("SELECT id, challenger_id, target_id FROM random_swaps WHERE id = ? AND status = 'pending'").get(swapId) as {
    id: number; challenger_id: number; target_id: number;
  } | undefined;
  if (!swap) return { ok: false, error: "Challenge not found or already resolved." };

  if (action === "withdraw") {
    if (swap.challenger_id !== userId) return { ok: false, error: "Only the challenger can withdraw." };
    db.prepare("UPDATE random_swaps SET status = 'withdrawn' WHERE id = ?").run(swapId);
    return { ok: true };
  }
  if (action === "decline") {
    if (swap.target_id !== userId) return { ok: false, error: "Only the target can decline." };
    db.prepare("UPDATE random_swaps SET status = 'declined' WHERE id = ?").run(swapId);
    return { ok: true };
  }

  // accept
  if (swap.target_id !== userId) return { ok: false, error: "Only the target can accept." };

  db.exec("BEGIN IMMEDIATE");
  try {
    const challengerEligible = getEligibleRandomSwapPlayerIds(db, swap.challenger_id);
    const targetEligible = getEligibleRandomSwapPlayerIds(db, userId);
    if (challengerEligible.length === 0) { db.exec("ROLLBACK"); return { ok: false, error: "The challenger has no eligible players to swap." }; }
    if (targetEligible.length === 0) { db.exec("ROLLBACK"); return { ok: false, error: "You have no eligible players to swap." }; }

    const challengerPlayerId = challengerEligible[Math.floor(Math.random() * challengerEligible.length)];
    const targetPlayerId = targetEligible[Math.floor(Math.random() * targetEligible.length)];

    transferRandomSwapPlayer(db, swap.challenger_id, userId, challengerPlayerId);
    transferRandomSwapPlayer(db, userId, swap.challenger_id, targetPlayerId);

    db.prepare(
      "UPDATE random_swaps SET status = 'completed', challenger_player_id = ?, target_player_id = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(challengerPlayerId, targetPlayerId, swapId);
    db.exec("COMMIT");

    const playerMap = new Map(getAllPlayers().map((p) => [p.id, p]));
    const cPlayer = playerMap.get(challengerPlayerId);
    const tPlayer = playerMap.get(targetPlayerId);
    const premiumRarities = new Set(["icon", "legend", "epic"]);
    if (cPlayer && tPlayer && (premiumRarities.has(cPlayer.rarity) || premiumRarities.has(tPlayer.rarity))) {
      const challengerName = (db.prepare("SELECT username FROM users WHERE id = ?").get(swap.challenger_id) as { username: string } | undefined)?.username ?? "Someone";
      const targetName = (db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as { username: string } | undefined)?.username ?? "Someone";
      createAdminChatMessage(
        `🎲 DANGER SWAP — ${challengerName} lost ${cPlayer.name} (${cPlayer.rarity}) · ${targetName} lost ${tPlayer.name} (${tPlayer.rarity}).`
      );
    }
    checkAndAwardDangerMilestones(swap.challenger_id);
    checkAndAwardDangerMilestones(userId);
    return { ok: true };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getRandomSwapChallenges(userId: number) {
  return getDb()
    .prepare(
      `SELECT rs.id, rs.challenger_id, rs.target_id, rs.status, rs.created_at,
              u1.username AS challenger_username, u2.username AS target_username
       FROM random_swaps rs
       JOIN users u1 ON u1.id = rs.challenger_id
       JOIN users u2 ON u2.id = rs.target_id
       WHERE (rs.challenger_id = ? OR rs.target_id = ?) AND rs.status = 'pending'
       ORDER BY rs.created_at DESC`
    )
    .all(userId, userId) as Array<{
      id: number; challenger_id: number; target_id: number; status: string; created_at: string;
      challenger_username: string; target_username: string;
    }>;
}

export function getRandomSwapLog(limit = 30) {
  return getDb()
    .prepare(
      `SELECT rs.id, rs.challenger_id, rs.target_id, rs.challenger_player_id, rs.target_player_id,
              rs.completed_at, u1.username AS challenger_username, u2.username AS target_username
       FROM random_swaps rs
       JOIN users u1 ON u1.id = rs.challenger_id
       JOIN users u2 ON u2.id = rs.target_id
       WHERE rs.status = 'completed'
       ORDER BY rs.completed_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
      id: number; challenger_id: number; target_id: number;
      challenger_player_id: number; target_player_id: number;
      completed_at: string; challenger_username: string; target_username: string;
    }>;
}

// ── Danger Milestone Awards ───────────────────────────────────

export function checkAndAwardDangerMilestones(userId: number): void {
  const db = getDb();
  const { count } = db.prepare(
    "SELECT COUNT(*) AS count FROM random_swaps WHERE status = 'completed' AND (challenger_id = ? OR target_id = ?)"
  ).get(userId, userId) as { count: number };

  for (const milestone of DANGER_MILESTONES) {
    if (count < milestone.count) continue;
    const already = db.prepare("SELECT 1 FROM danger_swap_milestones WHERE user_id = ? AND player_id = ?").get(userId, milestone.playerId);
    if (already) continue;

    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("INSERT OR IGNORE INTO danger_swap_milestones (user_id, player_id) VALUES (?, ?)").run(userId, milestone.playerId);
      const owned = db.prepare("SELECT duplicate_count FROM user_players WHERE user_id = ? AND player_id = ?").get(userId, milestone.playerId) as { duplicate_count: number } | undefined;
      if (owned) {
        db.prepare("UPDATE user_players SET duplicate_count = duplicate_count + 1 WHERE user_id = ? AND player_id = ?").run(userId, milestone.playerId);
      } else {
        db.prepare("INSERT INTO user_players (user_id, player_id, duplicate_count) VALUES (?, ?, 0)").run(userId, milestone.playerId);
      }
      db.prepare("INSERT INTO card_awards (user_id, player_id, rarity, source, source_id, position) VALUES (?, ?, 'dangerous', 'danger_milestone', NULL, 0)").run(userId, milestone.playerId);
      db.prepare("INSERT OR IGNORE INTO danger_reveal_queue (user_id, player_id) VALUES (?, ?)").run(userId, milestone.playerId);
      db.exec("COMMIT");
    } catch {
      db.exec("ROLLBACK");
    }
  }
}

export function getPendingDangerReveals(userId: number): number {
  const { count } = getDb().prepare("SELECT COUNT(*) AS count FROM danger_reveal_queue WHERE user_id = ?").get(userId) as { count: number };
  return count;
}

export function claimDangerReveals(userId: number): number[] {
  const db = getDb();
  const rows = db.prepare("SELECT player_id FROM danger_reveal_queue WHERE user_id = ? ORDER BY awarded_at").all(userId) as { player_id: number }[];
  if (rows.length === 0) return [];
  const playerIds = rows.map((r) => r.player_id);
  const { maxPos } = db.prepare("SELECT MAX(position) AS maxPos FROM reveal_players WHERE user_id = ?").get(userId) as { maxPos: number | null };
  const startPos = (maxPos ?? -1) + 1;
  const insert = db.prepare("INSERT OR REPLACE INTO reveal_players (user_id, position, player_id) VALUES (?, ?, ?)");
  playerIds.forEach((id, i) => insert.run(userId, startPos + i, id));
  db.prepare("DELETE FROM danger_reveal_queue WHERE user_id = ?").run(userId);
  return playerIds;
}

export function getAllOtherUsers(userId: number): Array<{ id: number; username: string }> {
  const adminNames = getAdminUsernames();
  const rows = getDb().prepare("SELECT id, username FROM users WHERE id != ? ORDER BY username").all(userId) as Array<{ id: number; username: string }>;
  return rows.filter((r) => !adminNames.has(r.username.trim().toLowerCase()));
}

function seedFixtureResults(database: DatabaseSync) {
  const count = database.prepare("SELECT COUNT(*) AS count FROM fixture_results").get() as { count: number };
  if (count.count > 0) return;
}

function removeLegacySeedFixtures(database: DatabaseSync) {
  database.prepare("DELETE FROM fixture_results WHERE match_id LIKE 'seed-%' OR source = 'seed'").run();
}

function migrateCupBracketOverrides(database: DatabaseSync) {
  const upsert = database.prepare(
    "INSERT OR REPLACE INTO cup_match_overrides (cup_id, match_id, home_username, away_username, force_winner) VALUES (?, ?, ?, ?, ?)"
  );
  // Dalglish Cup (cup 2) semi-finals — correct matchups after reseeding incident
  upsert.run(2, "sf-1", "liamshieldss", "liamw", null);
  upsert.run(2, "sf-2", "clairemcmahon", "annieclarke11", null);
  // Larsson Cup (cup 1) final — liamshieldss beat lucy
  upsert.run(1, "final", "liamshieldss", "lucy", "liamshieldss");
}

function migrateBonusRevealQueue(database: DatabaseSync) {
  // One-time compensation award: Nicolas Raskin (652) + Lawrence Shankland (311)
  const BONUS_KEY = "bonus-compensation-2026-07-05";
  const BONUS_PLAYER_IDS = [652, 311];

  const alreadyRan = database
    .prepare("SELECT COUNT(*) AS c FROM card_awards WHERE source = ?")
    .get(BONUS_KEY) as { c: number };
  if (alreadyRan.c > 0) return;

  const adminNames = getAdminUsernames();
  const users = database.prepare("SELECT id, username FROM users").all() as Array<{ id: number; username: string }>;

  for (const user of users) {
    if (adminNames.has(user.username.toLowerCase())) continue;
    for (const playerId of BONUS_PLAYER_IDS) {
      database
        .prepare("INSERT OR IGNORE INTO bonus_reveal_queue (user_id, player_id) VALUES (?, ?)")
        .run(user.id, playerId);
      const player = getAllPlayers().find((p) => p.id === playerId);
      database
        .prepare("INSERT INTO card_awards (user_id, player_id, rarity, source, source_id, position) VALUES (?, ?, ?, ?, ?, ?)")
        .run(user.id, playerId, player?.rarity ?? "clowns", BONUS_KEY, null, 0);
    }
  }
}

export function getPendingBonusReveals(userId: number): number {
  return ((getDb().prepare("SELECT COUNT(*) AS c FROM bonus_reveal_queue WHERE user_id = ?").get(userId) as { c: number }).c);
}

export function claimBonusReveals(userId: number): number[] {
  const db = getDb();
  const rows = db.prepare("SELECT player_id FROM bonus_reveal_queue WHERE user_id = ?").all(userId) as Array<{ player_id: number }>;
  if (rows.length === 0) return [];
  const playerIds = rows.map((r) => r.player_id);
  const maxPos = (db.prepare("SELECT COALESCE(MAX(position), -1) AS m FROM reveal_players WHERE user_id = ?").get(userId) as { m: number }).m;
  const insertReveal = db.prepare("INSERT OR IGNORE INTO reveal_players (user_id, position, player_id) VALUES (?, ?, ?)");
  playerIds.forEach((pid, i) => insertReveal.run(userId, maxPos + 1 + i, pid));
  db.prepare("DELETE FROM bonus_reveal_queue WHERE user_id = ?").run(userId);
  return playerIds;
}

function resetMaradonaCupDraw(database: DatabaseSync) {
  // michael98 was an admin account erroneously included in the Maradona Cup
  // draw, causing louisamcm to be omitted. Delete any stored draw so it
  // regenerates with the correct participant list on cup start.
  database.prepare("DELETE FROM cup_draws WHERE cup_id = 3").run();
}

export function getCupDraw(cupId: number): string[] | null {
  const row = getDb()
    .prepare("SELECT participant_usernames FROM cup_draws WHERE cup_id = ?")
    .get(cupId) as { participant_usernames: string } | null;
  return row ? (JSON.parse(row.participant_usernames) as string[]) : null;
}

export function setCupDraw(cupId: number, usernames: string[]) {
  getDb()
    .prepare("INSERT OR REPLACE INTO cup_draws (cup_id, participant_usernames) VALUES (?, ?)")
    .run(cupId, JSON.stringify(usernames));
}

export function getCupMatchOverrides(cupId: number): Array<{ match_id: string; home_username: string | null; away_username: string | null; force_winner: string | null }> {
  return getDb()
    .prepare("SELECT match_id, home_username, away_username, force_winner FROM cup_match_overrides WHERE cup_id = ?")
    .all(cupId) as Array<{ match_id: string; home_username: string | null; away_username: string | null; force_winner: string | null }>;
}
