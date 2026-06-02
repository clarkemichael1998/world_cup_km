import { NextResponse } from "next/server";
import { getCurrentUser, getKmLogsToday } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: getKmLogsToday(user.id) });
}
