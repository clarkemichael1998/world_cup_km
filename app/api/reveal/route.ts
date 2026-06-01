import players from "@/data/players.json";
import { NextResponse } from "next/server";
import { getCurrentUser, getRevealPlayerIds, saveRevealPlayerIds } from "@/lib/server/db";
import type { Player } from "@/lib/types";

const allPlayers = players as Player[];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const ids = getRevealPlayerIds(user.id);
  return NextResponse.json({ players: ids.map((id) => allPlayers.find((player) => player.id === id)).filter((p): p is Player => p !== undefined) });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { playerIds?: number[] } | null;
  saveRevealPlayerIds(user.id, body?.playerIds ?? []);
  return NextResponse.json({ ok: true });
}
