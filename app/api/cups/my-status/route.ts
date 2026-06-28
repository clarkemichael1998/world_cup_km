import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/db";
import { getMyCupStatuses } from "@/lib/server/cups";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  return NextResponse.json({ statuses: getMyCupStatuses(user.username) });
}
