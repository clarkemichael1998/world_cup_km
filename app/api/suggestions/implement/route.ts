import { NextResponse } from "next/server";
import { getCurrentUser, getSuggestions, setSuggestionImplemented } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });
  if (!isAdminUsername(user.username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { suggestionId?: number; implemented?: boolean } | null;
  if (!body || typeof body.suggestionId !== "number" || !Number.isInteger(body.suggestionId)) {
    return NextResponse.json({ error: "suggestionId required." }, { status: 400 });
  }

  const ok = setSuggestionImplemented(body.suggestionId, user.id, body.implemented !== false);
  if (!ok) return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });

  return NextResponse.json({ ok: true, suggestions: getSuggestions(user.id) });
}
