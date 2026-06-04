import { NextResponse } from "next/server";
import { getCurrentUser, getSuggestions, saveSuggestion } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ suggestions: getSuggestions(user?.id ?? null) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { title?: string; details?: string } | null;
  const title = body?.title?.trim() ?? "";
  const details = body?.details?.trim() ?? "";

  if (!title) return NextResponse.json({ error: "Suggestion title required." }, { status: 400 });
  if (title.length > 120) return NextResponse.json({ error: "Keep titles under 120 characters." }, { status: 400 });
  if (details.length > 1000) return NextResponse.json({ error: "Keep details under 1000 characters." }, { status: 400 });

  saveSuggestion(user.id, title, details);
  return NextResponse.json({ ok: true, suggestions: getSuggestions(user.id) });
}
