"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { MobileNav } from "@/components/MobileNav";
import { NavActions } from "@/components/NavActions";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => setIsAdmin(Boolean(payload.user?.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  return (
    <div className="min-h-screen pb-16 md:pb-0" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}>
      <header className="nav-blur hidden border-b border-green-900/10 bg-white/80 md:block sticky top-0 z-40">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-black tracking-tight text-pitch">
            ⚽ KMXI
          </Link>
          <div className="flex gap-2 text-sm font-semibold text-green-950">
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/add-km">Add Activity</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/collection">Stickers</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/squad">Squad</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/squads">Squads</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/leaderboard">Leaderboard</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/chat">Chat</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/suggestions">Suggestions</Link>
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/rules">Rules</Link>
            {isAdmin ? <Link className="rounded-md bg-amber-100 px-3 py-2 font-black text-amber-900 hover:bg-amber-200" href="/admin">Admin</Link> : null}
            <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/login">Login</Link>
            <NavActions />
          </div>
        </nav>
      </header>

      <header
        className="nav-blur sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-green-900/10 bg-white/80 px-4 py-3 md:hidden"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <Link href="/" className="shrink-0 text-lg font-black tracking-tight text-pitch">⚽ KMXI</Link>
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/suggestions" className="whitespace-nowrap rounded-md bg-green-950/5 px-2 py-1 text-xs font-black uppercase tracking-wide text-green-900 hover:bg-green-950/10">
            Ideas
          </Link>
          <Link href="/rules" className="whitespace-nowrap rounded-md bg-green-950/5 px-2 py-1 text-xs font-black uppercase tracking-wide text-green-900 hover:bg-green-950/10">
            Rules
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-wide text-amber-900 hover:bg-amber-200">
              Admin
            </Link>
          ) : null}
          <NavActions compact />
        </div>
      </header>

      <NewsBanner />
      <AuthGuard />
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</main>
      <MobileNav />
    </div>
  );
}

function NewsBanner() {
  const [news, setNews] = useState({ message: "Martin O'Neill appointed new Celtic manager", isActive: true });

  useEffect(() => {
    fetch("/api/news")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.news?.message) {
          setNews({ message: payload.news.message, isActive: payload.news.isActive !== false });
        }
      })
      .catch(() => {});
  }, []);

  if (!news.isActive) return null;

  return (
    <div className="overflow-hidden border-y border-green-900/10 bg-pitch text-white">
      <div className="news-ticker whitespace-nowrap py-2 text-xs font-black uppercase tracking-wide">
        <NewsTickerSegment message={news.message} />
        <NewsTickerSegment message={news.message} ariaHidden />
      </div>
    </div>
  );
}

function NewsTickerSegment({ message, ariaHidden = false }: { message: string; ariaHidden?: boolean }) {
  return (
    <div className="news-ticker-segment" aria-hidden={ariaHidden}>
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} className="mx-8">
          {message}
        </span>
      ))}
    </div>
  );
}
