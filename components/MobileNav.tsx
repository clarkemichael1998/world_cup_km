"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  stickers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  squad: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="3" />
      <circle cx="5" cy="16" r="2.5" />
      <circle cx="19" cy="16" r="2.5" />
      <path d="M12 11v2M8.5 14.5l2 1.5M15.5 14.5l-2 1.5" />
    </svg>
  ),
  leaderboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  )
};

const coreTabs = [
  { href: "/", label: "Home", exact: true, icon: icons.home },
  { href: "/add-km", label: "Log", icon: icons.log },
  { href: "/collection", label: "Stickers", icon: icons.stickers },
  { href: "/squad", label: "Squad", icon: icons.squad },
  { href: "/leaderboard", label: "Leaders", icon: icons.leaderboard }
];

const moreLinks = [
  { href: "/cups", label: "Cups", emoji: "Cup" },
  { href: "/cup-rules", label: "Cup Rules", emoji: "Rules" },
  { href: "/results", label: "Results", emoji: "📋" },
  { href: "/trade", label: "Trade", emoji: "🔁" },
  { href: "/squads", label: "Rivals", emoji: "🆚" },
  { href: "/matchday-guide", label: "Matchday Guide", emoji: "📖" },
  { href: "/suggestions", label: "Suggestions", emoji: "💡" },
  { href: "/rules", label: "Rules", emoji: "⚖️" }
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [latestChatTs, setLatestChatTs] = useState(0);
  const moreActive = moreLinks.some((link) => pathname === link.href || pathname.startsWith(link.href + "/"));

  // Poll the newest chat timestamp so the Home tab can flag unread messages.
  useEffect(() => {
    let active = true;
    const check = () =>
      fetch("/api/chat")
        .then((r) => r.json())
        .then((p) => {
          if (!active) return;
          const newest = (p.messages ?? []).reduce((max: number, m: { created_at: string }) => Math.max(max, new Date(m.created_at).getTime()), 0);
          setLatestChatTs(newest);
        })
        .catch(() => {});
    check();
    const id = window.setInterval(() => {
      if (!document.hidden) check();
    }, 25000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  const lastSeen = typeof window !== "undefined" ? Number(window.localStorage.getItem("kmxi-last-chat-seen") ?? 0) : 0;
  const hasUnread = pathname !== "/" && latestChatTs > lastSeen;

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-green-950/30 backdrop-blur-sm" />
          <div
            className="absolute bottom-16 left-0 right-0 rounded-t-2xl border-t border-white/10 bg-green-950 p-4 text-white shadow-2xl"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
            <div className="grid grid-cols-3 gap-2">
              {moreLinks.map((link) => {
                const active = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center text-[11px] font-black transition ${
                      active ? "border-amber-300 bg-amber-300 text-amber-950" : "border-white/10 bg-white/10 text-white/75 hover:bg-white/15 hover:text-white"
                    }`}
                  >
                    <span className="text-lg">{link.emoji}</span>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-green-950/95 text-white backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-6">
          {coreTabs.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[9px] font-black uppercase tracking-wide transition-colors ${
                  active ? "text-amber-200" : "text-white/62"
                }`}
              >
                <span className={`relative ${active ? "text-amber-200" : "text-white/58"}`}>
                  {tab.icon}
                  {tab.href === "/" && hasUnread ? <span className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-green-950 bg-boot" /> : null}
                </span>
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center gap-0.5 px-1 py-2.5 text-[9px] font-black uppercase tracking-wide transition-colors ${
              moreOpen || moreActive ? "text-amber-200" : "text-white/62"
            }`}
            aria-expanded={moreOpen}
          >
            <span className={moreOpen || moreActive ? "text-amber-200" : "text-white/58"}>{icons.more}</span>
            More
          </button>
        </div>
      </nav>
    </>
  );
}
