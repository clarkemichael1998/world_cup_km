"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { BrandLogo } from "@/components/BrandLogo";
import { MobileNav } from "@/components/MobileNav";
import { NavActions } from "@/components/NavActions";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [badges, setBadges] = useState({ credits: 0, squadNeedsLock: false });

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => {
        setIsAdmin(Boolean(payload.user?.isAdmin));
        setUsername(payload.user?.username ?? null);
      })
      .catch(() => {
        setIsAdmin(false);
        setUsername(null);
      });

    fetch("/api/credits", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setBadges((current) => ({ ...current, credits: payload?.credits ?? 0 })))
      .catch(() => {});

    fetch("/api/squad/lock", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setBadges((current) => ({ ...current, squadNeedsLock: Boolean(payload && !payload.isLocked) })))
      .catch(() => {});

  }, []);

  const londonDate = getLondonDateString();
  // Daniel's screen rides upside down across these days (inclusive). ISO date
  // strings compare lexicographically, so >=/<= bounds the window correctly.
  const isDanielAustraliaDay = username?.toLowerCase() === "danielm" && londonDate >= "2026-06-10" && londonDate <= "2026-06-12";

  return (
    <div
      className={`min-h-screen pb-16 md:pb-0 ${isDanielAustraliaDay ? "australia-mode" : ""}`}
      style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <header className="nav-blur hidden border-b border-green-900/10 bg-white/80 md:block sticky top-0 z-40">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label="KMXI home">
            <BrandLogo variant="nav" />
          </Link>
          <div className="flex items-center gap-1 text-sm font-semibold text-green-950">
            <NavLink href="/add-km" label="Log" />
            <NavLink href="/collection" label="Stickers" />
            <NavLink href="/squad" label="Squad" badge={badges.squadNeedsLock ? "Lock" : undefined} />
            <NavLink href="/trade" label="Trade" />
            <NavLink href="/results" label="Results" />
            <NavLink href="/leaderboard" label="Leaderboard" />
            <NavLink href="/squads" label="Rivals" />
            <span className="mx-1 h-5 w-px bg-green-900/10" />
            <NavLink href="/matchday-guide" label="Guide" />
            <NavLink href="/rules" label="Rules" />
            <NavLink href="/suggestions" label="Ideas" />
            {isAdmin ? <Link className="rounded-md bg-amber-100 px-3 py-2 font-black text-amber-900 hover:bg-amber-200" href="/admin">Admin</Link> : null}
            {badges.credits > 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-900">{badges.credits} packs</span> : null}
            <NavActions />
          </div>
        </nav>
      </header>

      <header
        className="nav-blur sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-green-900/10 bg-white/80 px-4 py-3 md:hidden"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <Link href="/" className="shrink-0" aria-label="KMXI home"><BrandLogo variant="nav" /></Link>
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/suggestions" className="whitespace-nowrap rounded-md bg-green-950/5 px-2 py-1 text-xs font-bold uppercase tracking-wide text-green-900 hover:bg-green-950/10">
            Ideas
          </Link>
          <Link href="/rules" className="whitespace-nowrap rounded-md bg-green-950/5 px-2 py-1 text-xs font-bold uppercase tracking-wide text-green-900 hover:bg-green-950/10">
            Rules
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="whitespace-nowrap rounded-md bg-amber-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-amber-900 hover:bg-amber-200">
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

function NavLink({ href, label, badge }: { href: string; label: string; badge?: string }) {
  return (
    <Link className="relative rounded-md px-3 py-2 hover:bg-green-100" href={href}>
      {label}
      {badge ? <span className="ml-1 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-black text-amber-950">{badge}</span> : null}
    </Link>
  );
}

function getLondonDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
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
    <div className="news-reel border-y border-green-900/10 bg-pitch text-white">
      <div className="news-reel-track">
        <NewsReelGroup message={news.message} />
        <NewsReelGroup message={news.message} ariaHidden />
      </div>
    </div>
  );
}

function NewsReelGroup({ message, ariaHidden = false }: { message: string; ariaHidden?: boolean }) {
  return (
    <div className="news-reel-group" aria-hidden={ariaHidden}>
      {Array.from({ length: 10 }).map((_, index) => (
        <span key={index} className="news-reel-item">
          {message}
        </span>
      ))}
    </div>
  );
}
