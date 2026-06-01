"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { formatDate } from "@/lib/formatDate";
import { calculateSquadRating } from "@/lib/squadUtils";
import { loadUserStateAsync } from "@/lib/storage";
import type { UserState } from "@/lib/types";

type FeedEntry = { username: string; distance_km: number; cards_earned: number; created_at: string };

export default function Home() {
  const [state, setState] = useState<UserState | null>(null);
  const [communityKm, setCommunityKm] = useState<number | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);

  useEffect(() => {
    loadUserStateAsync().then(setState);
    fetch("/api/community")
      .then((r) => r.json())
      .then((p) => setCommunityKm(p.community.totalKm))
      .catch(() => {});
    fetch("/api/km-log")
      .then((r) => r.json())
      .then((p) => setFeed(p.feed ?? []))
      .catch(() => {});
  }, []);

  const squadRating = state ? calculateSquadRating(state) : 0;
  const nextRewardProgress = state ? Math.min(100, Math.round(state.kmBalance * 100)) : 0;

  return (
    <div>
      <PageTitle title="KMXI" subtitle="Log real-world distance, earn player cards, and shape your World Cup XI." />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Stat label="My KM" value={state ? state.totalKm.toFixed(1) : "..."} />
        <Stat label="Community KM" value={communityKm === null ? "..." : communityKm.toFixed(1)} />
        <Stat label="Collection" value={state ? String(state.ownedPlayerIds.length) : "..."} />
        <Stat label="Squad Rating" value={state ? String(squadRating) : "..."} />
      </section>

      <section className="mt-4 rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-green-800/70">Next Reward</p>
            <p className="mt-1 text-sm font-semibold text-green-950">
              {state ? `${state.kmBalance.toFixed(2)}km banked · ${(1 - state.kmBalance).toFixed(2)}km to go` : "Loading..."}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-black text-pitch">{nextRewardProgress}%</p>
        </div>
        <div
          className="mt-4 h-3 overflow-hidden rounded-full bg-green-100"
          role="progressbar"
          aria-valuenow={nextRewardProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress to next reward"
        >
          <div className="h-full rounded-full bg-boot transition-all" style={{ width: `${nextRewardProgress}%` }} />
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-2 content-start">
          <HomeLink href="/add-km" title="Add KM" text="Turn whole kilometres into random player rewards." />
          <HomeLink href="/collection" title="Collection" text="Browse cards, filter by role, rarity, and club." />
          <HomeLink href="/squad" title="Squad" text="Pick your XI manually or auto-select your strongest team." />
          <HomeLink href="/chat" title="Chat" text="Talk tactics, pulls, and live scores with the group." />
        </section>

        <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
          <p className="text-sm font-black uppercase tracking-wide text-green-900/60">KM Activity</p>
          <div className="mt-3 space-y-2">
            {feed.length === 0 ? (
              <p className="text-sm font-semibold text-green-900/60">No activity yet — be the first to log a run!</p>
            ) : (
              feed.map((entry, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-md bg-green-950/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-green-950">{entry.username}</p>
                    <p className="text-xs font-semibold text-green-900/60">{formatDate(entry.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-pitch">+{entry.distance_km.toFixed(1)} km</p>
                    {entry.cards_earned > 0 && (
                      <p className="text-xs font-bold text-amber-700">+{entry.cards_earned} card{entry.cards_earned === 1 ? "" : "s"}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-4 shadow-sm md:p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-green-800/70 md:text-sm">{label}</p>
      <p className="mt-2 text-3xl font-black text-green-950 md:text-4xl">{value}</p>
    </div>
  );
}

function HomeLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-lg bg-pitch p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-800 md:p-5">
      <h2 className="text-xl font-black md:text-2xl">{title}</h2>
      <p className="mt-2 text-xs font-medium text-green-50/85 md:text-sm">{text}</p>
    </Link>
  );
}
