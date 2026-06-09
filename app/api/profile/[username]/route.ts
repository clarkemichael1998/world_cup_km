import { NextResponse } from "next/server";
import { getCurrentUser, getProfileData } from "@/lib/server/db";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { username } = await params;
  const profile = getProfileData(decodeURIComponent(username));
  if (!profile) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  return NextResponse.json({ profile });
}
