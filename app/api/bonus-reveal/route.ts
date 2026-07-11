import { NextResponse } from "next/server";
import { claimBonusReveals, getCurrentUser, isAppLockedDown, getPendingBonusReveals } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  return NextResponse.json({ pending: getPendingBonusReveals(user.id) });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (isAppLockedDown()) return NextResponse.json({ error: "The app has locked down." }, { status: 403 });
  const playerIds = claimBonusReveals(user.id);
  return NextResponse.json({ ok: true, playerIds });
}
