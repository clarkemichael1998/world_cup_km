import { NextResponse } from "next/server";
import { getCommunityStats } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ community: getCommunityStats() });
}
