import { NextResponse } from "next/server";
import { createOrGetUser, createSession } from "@/lib/server/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const username = body?.username?.trim();
  const password = body?.password ?? "";

  if (!username || password.length < 4) {
    return NextResponse.json({ error: "Enter a username and password of at least 4 characters." }, { status: 400 });
  }

  const user = createOrGetUser(username, password);
  if (!user) {
    return NextResponse.json({ error: "That username exists with a different password." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, rewardCredits: user.reward_credits } });
}
