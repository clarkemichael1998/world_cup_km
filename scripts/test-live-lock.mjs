import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const dbPath = new URL("../data/live-lock-test.sqlite", import.meta.url);

try {
  unlinkSync(dbPath);
} catch {}

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, reward_credits INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE draft_squad_players (user_id INTEGER NOT NULL, slot TEXT NOT NULL, player_id INTEGER NOT NULL, PRIMARY KEY (user_id, slot));
  CREATE TABLE locked_squads (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, lock_date TEXT NOT NULL, locked_at TEXT NOT NULL, unlock_at TEXT NOT NULL, UNIQUE (user_id, lock_date));
  CREATE TABLE locked_squad_players (locked_squad_id INTEGER NOT NULL, slot TEXT NOT NULL, player_id INTEGER NOT NULL, nation TEXT NOT NULL, PRIMARY KEY (locked_squad_id, slot));
  CREATE TABLE fixture_results (match_id TEXT PRIMARY KEY, kickoff_at TEXT NOT NULL, winner TEXT, status TEXT NOT NULL, verified INTEGER NOT NULL);
  CREATE TABLE reward_events (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, locked_squad_id INTEGER NOT NULL, match_id TEXT NOT NULL, player_id INTEGER NOT NULL, credits INTEGER NOT NULL, UNIQUE (user_id, locked_squad_id, match_id, player_id));
`);

db.prepare("INSERT INTO users (id) VALUES (1)").run();
db.prepare("INSERT INTO draft_squad_players VALUES (1, 'FW1', 10), (1, 'FW2', 11), (1, 'MF1', 12)").run();

const lock = db.prepare("INSERT INTO locked_squads (user_id, lock_date, locked_at, unlock_at) VALUES (1, '2026-06-11', '2026-06-11T10:00:00.000Z', '2026-06-12T10:00:00.000Z')").run();
const lockedSquadId = Number(lock.lastInsertRowid);
db.prepare("INSERT INTO locked_squad_players VALUES (?, 'FW1', 10, 'Mexico'), (?, 'FW2', 11, 'Mexico'), (?, 'MF1', 12, 'South Africa')").run(lockedSquadId, lockedSquadId, lockedSquadId);

db.prepare("DELETE FROM draft_squad_players").run();
db.prepare("INSERT INTO draft_squad_players VALUES (1, 'FW1', 20), (1, 'FW2', 21), (1, 'MF1', 22)").run();
db.prepare("INSERT INTO fixture_results VALUES ('match-mexico-win', '2026-06-11T20:00:00.000Z', 'Mexico', 'FINISHED', 1)").run();

awardCredits(1, "2026-06-11");
awardCredits(1, "2026-06-11");

const user = db.prepare("SELECT reward_credits FROM users WHERE id = 1").get();
const events = db.prepare("SELECT player_id FROM reward_events ORDER BY player_id").all();

assert.equal(user.reward_credits, 6);
assert.deepEqual(events.map((event) => event.player_id), [10, 11]);

console.log("Live lock invariant passed: only locked winning players were credited once.");

function awardCredits(userId, lockDate) {
  const locked = db.prepare("SELECT id, locked_at, unlock_at FROM locked_squads WHERE user_id = ? AND lock_date = ?").get(userId, lockDate);
  const matches = db.prepare("SELECT match_id, winner FROM fixture_results WHERE status = 'FINISHED' AND verified = 1 AND winner IS NOT NULL AND kickoff_at >= ? AND kickoff_at < ?").all(locked.locked_at, locked.unlock_at);
  const lockedPlayers = db.prepare("SELECT player_id, nation FROM locked_squad_players WHERE locked_squad_id = ?").all(locked.id);

  for (const match of matches) {
    for (const player of lockedPlayers) {
      if (player.nation !== match.winner) continue;
      const inserted = db.prepare("INSERT OR IGNORE INTO reward_events (user_id, locked_squad_id, match_id, player_id, credits) VALUES (?, ?, ?, ?, 3)").run(userId, locked.id, match.match_id, player.player_id);
      if (inserted.changes > 0) db.prepare("UPDATE users SET reward_credits = reward_credits + 3 WHERE id = ?").run(userId);
    }
  }
}
