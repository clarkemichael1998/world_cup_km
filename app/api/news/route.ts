import { NextResponse } from "next/server";
import { getCurrentUser, getMatchdayHeadToHead, getNewsReel, isAppLockedDown, updateNewsReel } from "@/lib/server/db";
import { getPreviousMatchday } from "@/lib/server/live";
import { isAdminUsername } from "@/lib/server/admin";

function newsRights(username: string): { canSet: boolean; wonMatchday: string | null } {
  const previousMatchday = getPreviousMatchday();
  const day = getMatchdayHeadToHead().find((entry) => entry.date === previousMatchday);
  const winner = day?.entries[0]?.username ?? null;
  if (winner && winner === username) return { canSet: true, wonMatchday: previousMatchday };
  if (isAdminUsername(username)) return { canSet: true, wonMatchday: null };
  return { canSet: false, wonMatchday: null };
}

export async function GET() {
  const news = getNewsReel();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ news });
  const rights = newsRights(user.username);
  return NextResponse.json({ news, canSetNews: rights.canSet, wonMatchday: rights.wonMatchday });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (isAppLockedDown()) return NextResponse.json({ error: "The app has locked down." }, { status: 403 });

  const rights = newsRights(user.username);
  if (!rights.canSet) {
    return NextResponse.json({ error: "Only yesterday's matchday winner can set the news reel. Win a matchday to take the mic." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "News message is required." }, { status: 400 });
  if (message.length > 180) return NextResponse.json({ error: "Keep the headline under 180 characters." }, { status: 400 });

  const news = updateNewsReel(message, true, user.id);
  return NextResponse.json({ ok: true, news });
}
