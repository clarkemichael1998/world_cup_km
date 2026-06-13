import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { getCurrentUser } from "@/lib/server/db";
import { resyncFinishedGoals } from "@/lib/server/fixtures";
import { settleAllLiveAwards } from "@/lib/server/live";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Pull scorer detail for any finished matches not yet fetched, then re-settle
  // every user so newly matched goals/assists apply boosts retroactively.
  const goals = await resyncFinishedGoals();
  const settle = settleAllLiveAwards();

  return NextResponse.json({
    ok: goals.ok,
    matchesChecked: goals.matchesChecked,
    goalsFound: goals.goalsFound,
    remaining: goals.remaining,
    usersSettled: settle.usersSettled,
    message: goals.message
  });
}
