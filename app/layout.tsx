import type { Metadata } from "next";
import Link from "next/link";
import { NavActions } from "@/components/NavActions";
import { AuthGuard } from "@/components/AuthGuard";
import { MobileNav } from "@/components/MobileNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "KMXI",
  description: "Log kilometres, collect World Cup players, and compete with your XI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <div className="min-h-screen pb-16 md:pb-0" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}>
          {/* Desktop top nav */}
          <header className="nav-blur hidden border-b border-green-900/10 bg-white/80 md:block sticky top-0 z-40">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-xl font-black tracking-tight text-pitch">
                KMXI
              </Link>
              <div className="flex gap-2 text-sm font-semibold text-green-950">
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/add-km">Add KM</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/collection">Collection</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/squad">Squad</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/live">Live</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/chat">Chat</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/login">Login</Link>
                <NavActions />
              </div>
            </nav>
          </header>

          {/* Mobile top bar */}
          <header className="nav-blur sticky top-0 z-40 flex items-center justify-between border-b border-green-900/10 bg-white/80 px-4 py-3 md:hidden"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}>
            <Link href="/" className="text-lg font-black tracking-tight text-pitch">KMXI</Link>
            <NavActions />
          </header>

          <AuthGuard />
          <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</main>
        </div>

        {/* Mobile bottom tab bar */}
        <MobileNav />
      </body>
    </html>
  );
}
