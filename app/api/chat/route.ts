import { NextResponse } from "next/server";
import { getChatMessages, getChatReactionsForMessages, getCurrentUser, saveChatMessage } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  const messages = getChatMessages().reverse();
  const ids = messages.map((m) => m.id);
  const reactions = getChatReactionsForMessages(ids, user?.id ?? null);
  // group reactions by message_id
  const reactionsByMessage = new Map<number, Array<{ reaction: string; count: number; user_reacted: boolean }>>();
  for (const r of reactions) {
    const list = reactionsByMessage.get(r.message_id) ?? [];
    list.push({ reaction: r.reaction, count: r.count, user_reacted: r.user_reacted });
    reactionsByMessage.set(r.message_id, list);
  }
  const messagesWithReactions = messages.map((m) => ({ ...m, reactions: reactionsByMessage.get(m.id) ?? [] }));
  return NextResponse.json({ messages: messagesWithReactions });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim() ?? "";
  if (!message) return NextResponse.json({ error: "Message required." }, { status: 400 });
  if (message.length > 500) return NextResponse.json({ error: "Keep messages under 500 characters." }, { status: 400 });

  saveChatMessage(user.id, message);
  const updatedMessages = getChatMessages().reverse();
  const updatedIds = updatedMessages.map((m) => m.id);
  const updatedReactions = getChatReactionsForMessages(updatedIds, user.id);
  const reactionsByMsg = new Map<number, Array<{ reaction: string; count: number; user_reacted: boolean }>>();
  for (const r of updatedReactions) {
    const list = reactionsByMsg.get(r.message_id) ?? [];
    list.push({ reaction: r.reaction, count: r.count, user_reacted: r.user_reacted });
    reactionsByMsg.set(r.message_id, list);
  }
  return NextResponse.json({ ok: true, messages: updatedMessages.map((m) => ({ ...m, reactions: reactionsByMsg.get(m.id) ?? [] })) });
}
