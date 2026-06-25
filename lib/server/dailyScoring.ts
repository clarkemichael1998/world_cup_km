import type { DatabaseSync } from "node:sqlite";
import { londonLockWindowForDate } from "@/lib/server/matchday";

// Shared scoring formula used by BOTH the cup head-to-head matches and the
// main leaderboard's "Matchday Head-to-Head" — so a cup match and a daily
// leaderboard crown are decided the exact same way, transparently:
//
//   activity points = activity credits logged that matchday, capped at 40
//   football points = (2 x locked players whose nation won) + goal/assist
//                      boost amounts that matchday, capped at 40
//   total = activity points + football points
//   tie-break = higher UNCAPPED activity wins
//
// Takes an already-open db handle (not getDb()) so this module never has to
// import lib/server/db.ts — avoids a circular import (db.ts -> here -> db.ts).

export const DAILY_POINTS_CAP = 40;
export const NATION_WIN_POINTS = 2;

export type DailyScore = {
  date: string;
  activityRaw: number;
  activityPoints: number;
  winCount: number;
  winPoints: number;
  boostRaw: number;
  footballRaw: number;
  footballPoints: number;
  total: number;
};

export function isMatchdaySettled(date: string, now: Date = new Date()): boolean {
  const { unlockAt } = londonLockWindowForDate(date);
  return now.getTime() >= unlockAt.getTime();
}

export function getDailyScore(db: DatabaseSync, userId: number, date: string): DailyScore {
  const { lockAt, unlockAt } = londonLockWindowForDate(date);
  const lockAtIso = lockAt.toISOString();
  const unlockAtIso = unlockAt.toISOString();

  const activityRow = db
    .prepare(`SELECT COALESCE(SUM(distance_km), 0) AS total FROM km_log WHERE user_id = ? AND voided_at IS NULL AND created_at >= ? AND created_at < ?`)
    .get(userId, lockAtIso, unlockAtIso) as { total: number };

  const winRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM reward_events re JOIN locked_squads ls ON ls.id = re.locked_squad_id WHERE re.user_id = ? AND ls.lock_date = ?`
    )
    .get(userId, date) as { c: number };

  // A boost's matchday is derived from the underlying fixture's kickoff time
  // (not goal_boosts.created_at, which can be days later for manually-entered
  // scorers) so it lands on the day the goal actually happened.
  const boostRow = db
    .prepare(
      `SELECT COALESCE(SUM(gb.boost_amount), 0) AS total
       FROM goal_boosts gb
       JOIN fixture_results fr ON fr.match_id = (
         CASE WHEN gb.match_id LIKE '%:assist' THEN substr(gb.match_id, 1, length(gb.match_id) - 7) ELSE gb.match_id END
       )
       WHERE gb.user_id = ? AND fr.kickoff_at >= ? AND fr.kickoff_at < ?`
    )
    .get(userId, lockAtIso, unlockAtIso) as { total: number };

  const activityRaw = Math.round((activityRow.total ?? 0) * 100) / 100;
  const activityPoints = Math.min(DAILY_POINTS_CAP, activityRaw);
  const winCount = winRow.c;
  const winPoints = winCount * NATION_WIN_POINTS;
  const boostRaw = boostRow.total ?? 0;
  const footballRaw = winPoints + boostRaw;
  const footballPoints = Math.min(DAILY_POINTS_CAP, footballRaw);

  return {
    date,
    activityRaw,
    activityPoints,
    winCount,
    winPoints,
    boostRaw,
    footballRaw,
    footballPoints,
    total: Math.round((activityPoints + footballPoints) * 100) / 100
  };
}

// Ranks scores best-first: higher total wins; tied totals fall back to the
// higher uncapped daily activity (per the published tie-break rule).
export function compareDailyScores(a: DailyScore, b: DailyScore): number {
  return b.total - a.total || b.activityRaw - a.activityRaw;
}
