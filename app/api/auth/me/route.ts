import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/db";
import { isAdminUsername } from "@/lib/server/admin";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      isAdmin: isAdminUsername(user.username)
    }
  });
}
