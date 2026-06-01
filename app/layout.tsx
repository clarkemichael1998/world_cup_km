import type { Metadata } from "next";
import Link from "next/link";
import { NavActions } from "@/components/NavActions";
import { AuthGuard } from "@/components/AuthGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "KMXI",
  description: "Log kilometres, collect World Cup players, and compete with your XI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-green-900/10 bg-white/80 backdrop-blur">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-xl font-black tracking-tight text-pitch">
                KMXI
              </Link>
              <div className="flex gap-2 text-sm font-semibold text-green-950">
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/add-km">
                  Add KM
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/collection">
                  Collection
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/squad">
                  Squad
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/live">
                  Live
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/chat">
                  Chat
                </Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/login">
                  Login
                </Link>
                <NavActions />
              </div>
            </nav>
          </header>
          <AuthGuard />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
