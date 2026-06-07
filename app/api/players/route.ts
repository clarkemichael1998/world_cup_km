import { NextResponse } from "next/server";
import { getAllPlayers } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ players: getAllPlayers() });
}
