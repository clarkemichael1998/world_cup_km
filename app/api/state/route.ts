import { NextResponse } from "next/server";
import { getCurrentUser, getPersistedUserState, saveClientDraftState, getRatingBoosts, awardDailyCredits } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  awardDailyCredits(user.id);
  const state = getPersistedUserState(user.id);
  const ratingBoosts = getRatingBoosts(user.id);
  return NextResponse.json({ state: { ...state, ratingBoosts } });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.state) return NextResponse.json({ error: "Missing state." }, { status: 400 });

  saveClientDraftState(user.id, body.state);
  return NextResponse.json({ ok: true });
}
