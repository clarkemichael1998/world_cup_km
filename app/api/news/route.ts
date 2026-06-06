import { NextResponse } from "next/server";
import { getNewsReel } from "@/lib/server/db";

export async function GET() {
  const news = getNewsReel();
  return NextResponse.json({ news });
}
