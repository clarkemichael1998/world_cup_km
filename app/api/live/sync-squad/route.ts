import { NextResponse } from "next/server";
import { getCurrentUser, saveDraftSquad } from "@/lib/server/db";
import type { SquadSlot } from "@/lib/types";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { squad?: Partial<Record<SquadSlot, number>> } | null;
  saveDraftSquad(user.id, body?.squad ?? {});
  return NextResponse.json({ ok: true });
}
