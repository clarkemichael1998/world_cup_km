import { NextResponse } from "next/server";
import { getKmLeaderboard, getMatchdayHeadToHead } from "@/lib/server/db";
import { settleAllLiveAwards } from "@/lib/server/live";

export async function GET() {
  settleAllLiveAwards();
  return NextResponse.json({ leaderboard: getKmLeaderboard(), matchdays: getMatchdayHeadToHead() });
}
