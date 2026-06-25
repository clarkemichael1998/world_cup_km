import { NextResponse } from "next/server";
import { isAdminUsername } from "@/lib/server/admin";
import { getCurrentUser } from "@/lib/server/db";
import { resyncFinishedGoals } from "@/lib/server/fixtures";
import { settleAllLiveAwards } from "@/lib/server/live";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { force?: boolean } | null;

  // Pull scorer detail for finished matches, then re-settle every user so newly
  // matched goals/assists apply boosts retroactively. force=true re-checks
  // matches that previously returned no goals.
  const goals = await resyncFinishedGoals(Boolean(body?.force));
  const settle = settleAllLiveAwards();

  return NextResponse.json({
    ok: goals.ok,
    matchesChecked: goals.matchesChecked,
    goalsFound: goals.goalsFound,
    apiHadGoals: goals.apiHadGoals,
    remaining: goals.remaining,
    usersSettled: settle.usersSettled,
    reconciledBoosts: settle.reconciledBoosts,
    message: goals.message
  });
}
