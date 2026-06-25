import { NextResponse } from "next/server";
import { getCommunitySquads } from "@/lib/server/db";
import { settleAllLiveAwards } from "@/lib/server/live";

export async function GET() {
  settleAllLiveAwards();
  return NextResponse.json({ squads: getCommunitySquads() });
}
