import { NextResponse } from "next/server";
import {
  getAllOtherUsers,
  getCurrentUser,
  getRandomSwapChallenges,
  getRandomSwapLog,
  initiateRandomSwap,
  isAppLockedDown,
  respondToRandomSwap
} from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const challenges = getRandomSwapChallenges(user.id).map((c) => ({
    id: c.id,
    challengerId: c.challenger_id,
    challengerUsername: c.challenger_username,
    targetId: c.target_id,
    targetUsername: c.target_username,
    status: c.status,
    createdAt: c.created_at,
    isMine: c.challenger_id === user.id,
    isIncoming: c.target_id === user.id
  }));

  const log = getRandomSwapLog(30).map((e) => ({
    id: e.id,
    challengerUsername: e.challenger_username,
    targetUsername: e.target_username,
    challengerPlayerId: e.challenger_player_id,
    targetPlayerId: e.target_player_id,
    completedAt: e.completed_at
  }));

  return NextResponse.json({ challenges, log, users: getAllOtherUsers(user.id) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (isAppLockedDown()) return NextResponse.json({ error: "The app has locked down." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { action?: string; targetId?: number; swapId?: number } | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action" }, { status: 400 });

  if (body.action === "challenge") {
    if (typeof body.targetId !== "number") return NextResponse.json({ error: "Missing targetId" }, { status: 400 });
    const result = initiateRandomSwap(user.id, body.targetId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "accept" || body.action === "decline" || body.action === "withdraw") {
    if (typeof body.swapId !== "number") return NextResponse.json({ error: "Missing swapId" }, { status: 400 });
    const result = respondToRandomSwap(body.swapId, user.id, body.action);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
