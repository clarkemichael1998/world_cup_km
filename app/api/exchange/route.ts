import { NextResponse } from "next/server";
import { exchangeDuplicates, getCurrentUser } from "@/lib/server/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const result = exchangeDuplicates(user.id);
  if (result.creditsGained === 0) {
    return NextResponse.json({ error: "You need at least 3 duplicates to exchange." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...result });
}
