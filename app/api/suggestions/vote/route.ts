import { NextResponse } from "next/server";
import { getCurrentUser, getSuggestions, toggleSuggestionVote } from "@/lib/server/db";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { suggestionId?: number; vote?: number } | null;
  if (!body || typeof body.suggestionId !== "number" || !Number.isInteger(body.suggestionId)) {
    return NextResponse.json({ error: "suggestionId required." }, { status: 400 });
  }
  if (body.vote !== 1 && body.vote !== -1) {
    return NextResponse.json({ error: "Vote must be 1 or -1." }, { status: 400 });
  }

  const action = toggleSuggestionVote(body.suggestionId, user.id, body.vote);
  return NextResponse.json({ ok: true, action, suggestions: getSuggestions(user.id) });
}
