import { NextResponse } from "next/server";
import { getCurrentUser, getDb } from "@/lib/server/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ credits: 0 });

  const database = getDb();
  const row = database.prepare("SELECT reward_credits FROM users WHERE id = ?").get(user.id) as { reward_credits: number };
  database.prepare("UPDATE users SET reward_credits = 0 WHERE id = ?").run(user.id);
  return NextResponse.json({ credits: row.reward_credits });
}
