import { NextResponse } from "next/server";
import { getCurrentUser, getKmFeed, logKmEntry } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json({ feed: getKmFeed() });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { distanceKm?: number; cardsEarned?: number } | null;
  if (!body || typeof body.distanceKm !== "number" || body.distanceKm <= 0) {
    return NextResponse.json({ error: "Invalid entry." }, { status: 400 });
  }

  logKmEntry(user.id, body.distanceKm, body.cardsEarned ?? 0);
  return NextResponse.json({ ok: true });
}
