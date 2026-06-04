import { NextResponse } from "next/server";
import { getCommunitySquads } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ squads: getCommunitySquads() });
}
