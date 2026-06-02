"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { MobileNav } from "@/components/MobileNav";
import { NavActions } from "@/components/NavActions";
import { goLiveLabel, isPreLaunch } from "@/lib/launch";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [preLaunch, setPreLaunch] = useState(true);

  useEffect(() => {
    function refreshLaunchState() {
      setPreLaunch(isPreLaunch());
    }
    refreshLaunchState();
    const timer = window.setInterval(refreshLaunchState, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen pb-16 md:pb-0" style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}>
      <header className="nav-blur hidden border-b border-green-900/10 bg-white/80 md:block sticky top-0 z-40">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href={preLaunch ? "/rules" : "/"} className="text-xl font-black tracking-tight text-pitch">
            ⚽ KMXI
          </Link>
          <div className="flex gap-2 text-sm font-semibold text-green-950">
            {preLaunch ? (
              <>
                <span className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">Goes live {goLiveLabel()}</span>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/rules">Rules</Link>
              </>
            ) : (
              <>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/add-km">Add Activity</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/collection">Collection</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/squad">Squad</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/leaderboard">Leaderboard</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/chat">Chat</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/rules">Rules</Link>
                <Link className="rounded-md px-3 py-2 hover:bg-green-100" href="/login">Login</Link>
                <NavActions />
              </>
            )}
          </div>
        </nav>
      </header>

      <header
        className="nav-blur sticky top-0 z-40 flex items-center justify-between border-b border-green-900/10 bg-white/80 px-4 py-3 md:hidden"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
      >
        <Link href={preLaunch ? "/rules" : "/"} className="text-lg font-black tracking-tight text-pitch">⚽ KMXI</Link>
        <div className="flex items-center gap-3">
          {preLaunch ? (
            <span className="text-[10px] font-black uppercase tracking-wide text-amber-800">Live 4 Jun</span>
          ) : (
            <Link href="/chat" className="flex items-center gap-1.5 rounded-md bg-pitch px-3 py-1.5 text-xs font-black text-white hover:bg-green-800">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat
            </Link>
          )}
          <Link href="/rules" className="text-xs font-black uppercase tracking-wide text-green-900/60 hover:text-green-950">Rules</Link>
          {!preLaunch ? <NavActions /> : null}
        </div>
      </header>

      {!preLaunch ? <AuthGuard /> : null}
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</main>
      {!preLaunch ? <MobileNav /> : null}
    </div>
  );
}
