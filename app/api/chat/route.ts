import { NextResponse } from "next/server";
import { getChatMessages, getChatReactionsForMessages, getCurrentUser, saveChatMessage } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ messages: getMessagesWithReactions(user?.id ?? null) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { message?: string; replyToMessageId?: number | null } | null;
  const message = body?.message?.trim() ?? "";
  if (!message) return NextResponse.json({ error: "Message required." }, { status: 400 });
  if (message.length > 500) return NextResponse.json({ error: "Keep messages under 500 characters." }, { status: 400 });

  if (body?.replyToMessageId != null && (typeof body.replyToMessageId !== "number" || !Number.isInteger(body.replyToMessageId))) {
    return NextResponse.json({ error: "Invalid reply target." }, { status: 400 });
  }

  saveChatMessage(user.id, message, body?.replyToMessageId ?? null);
  return NextResponse.json({ ok: true, messages: getMessagesWithReactions(user.id) });
}

function getMessagesWithReactions(viewerUserId: number | null) {
  const messages = getChatMessages().reverse();
  const ids = messages.map((m) => m.id);
  const reactions = getChatReactionsForMessages(ids, viewerUserId);
  const reactionsByMessage = new Map<number, Array<{ reaction: string; count: number; user_reacted: boolean; users: string[] }>>();
  for (const r of reactions) {
    const list = reactionsByMessage.get(r.message_id) ?? [];
    list.push({ reaction: r.reaction, count: r.count, user_reacted: r.user_reacted, users: r.users });
    reactionsByMessage.set(r.message_id, list);
  }
  return messages.map((m) => ({ ...m, reactions: reactionsByMessage.get(m.id) ?? [] }));
}
