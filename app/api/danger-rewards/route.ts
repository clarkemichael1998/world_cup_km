import { NextResponse } from "next/server";
import { claimDangerReveals, getCurrentUser, getPendingDangerReveals } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  return NextResponse.json({ pending: getPendingDangerReveals(user.id) });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const playerIds = claimDangerReveals(user.id);
  return NextResponse.json({ ok: true, playerIds });
}
