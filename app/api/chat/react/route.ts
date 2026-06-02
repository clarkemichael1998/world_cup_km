import { NextResponse } from "next/server";
import { getCurrentUser, toggleChatReaction } from "@/lib/server/db";

const ALLOWED_REACTIONS = ["👍", "👎", "🔥", "❤️", "😂", "🤡", "💩", "🫪"];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { messageId?: number; reaction?: string } | null;
  if (!body || typeof body.messageId !== "number" || !body.reaction) {
    return NextResponse.json({ error: "messageId and reaction required." }, { status: 400 });
  }
  if (!ALLOWED_REACTIONS.includes(body.reaction)) {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }

  const action = toggleChatReaction(body.messageId, user.id, body.reaction);
  return NextResponse.json({ ok: true, action });
}
