import { NextResponse, type NextRequest } from "next/server";
import { isPreLaunch } from "@/lib/launch";

const allowedBeforeLaunch = new Set(["/rules"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPreLaunch()) return NextResponse.next();
  if (allowedBeforeLaunch.has(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/rules";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icon-192.png|icon-512.png).*)"]
};
