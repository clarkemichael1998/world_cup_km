import { NextResponse } from "next/server";
import { getCurrentUser, getDb } from "@/lib/server/db";
import { settleUserLive } from "@/lib/server/live";
import { londonLockWindow } from "@/lib/server/matchday";
import { getDailyScore, isMatchdaySettled } from "@/lib/server/dailyScoring";

// The matchday currently accumulating points — NOT the "next lock" shown on
// the Squad page. Before 3pm, the active scoring window is still yesterday's
// (it doesn't close until 3pm today); after 3pm, it's today's. This lets a
// player see their running activity/football/total update live, before the
// day closes — the same numbers the leaderboard and cup matches use.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  settleUserLive(user.id);

  const db = getDb();
  const window = londonLockWindow(new Date());
  const score = getDailyScore(db, user.id, window.lockDate);
  const settled = isMatchdaySettled(window.lockDate);

  return NextResponse.json({
    date: window.lockDate,
    lockAt: window.lockAt.toISOString(),
    unlockAt: window.unlockAt.toISOString(),
    settled,
    score
  });
}
