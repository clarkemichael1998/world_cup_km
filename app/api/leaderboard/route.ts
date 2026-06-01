import { NextResponse } from "next/server";
import { getKmLeaderboard } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ leaderboard: getKmLeaderboard() });
}
