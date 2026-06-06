import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      isAdmin: Boolean(process.env.ADMIN_USERNAME && user.username === process.env.ADMIN_USERNAME)
    }
  });
}
