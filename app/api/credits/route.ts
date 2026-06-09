import { NextResponse } from "next/server";
import { getCurrentUser, awardDailyCredits, getActivityStreak, getDb } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  awardDailyCredits(user.id);
  const row = getDb().prepare("SELECT reward_credits FROM users WHERE id = ?").get(user.id) as { reward_credits: number };
  return NextResponse.json({ credits: row.reward_credits, streak: getActivityStreak(user.id) });
}
