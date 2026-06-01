"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageTitle } from "@/components/PageTitle";
import { calculateSquadRating } from "@/lib/squadUtils";
import { loadUserStateAsync } from "@/lib/storage";
import type { UserState } from "@/lib/types";

export default function Home() {
  const [state, setState] = useState<UserState | null>(null);
  const [communityKm, setCommunityKm] = useState<number | null>(null);

  useEffect(() => {
    loadUserStateAsync().then(setState);
    fetch("/api/community")
      .then((response) => response.json())
      .then((payload) => setCommunityKm(payload.community.totalKm))
      .catch(() => {});
  }, []);

  const squadRating = state ? calculateSquadRating(state) : 0;
  const nextRewardProgress = state ? Math.min(100, Math.round(state.kmBalance * 100)) : 0;

  return (
    <div>
      <PageTitle title="KMXI" subtitle="Log real-world distance, earn player cards, and shape your World Cup XI." />

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Total KM" value={state ? state.totalKm.toFixed(1) : "..."} />
        <Stat label="Community KM" value={communityKm === null ? "..." : communityKm.toFixed(1)} />
        <Stat label="Collection" value={state ? String(state.ownedPlayerIds.length) : "..."} />
        <Stat label="Squad Rating" value={state ? String(squadRating) : "..."} />
      </section>

      <section className="mt-4 rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-green-800/70">Next Reward</p>
            <p className="mt-1 font-semibold text-green-950">
              {state ? `${state.kmBalance.toFixed(2)}km banked, ${(1 - state.kmBalance).toFixed(2)}km to next card` : "Loading reward balance..."}
            </p>
          </div>
          <p className="text-2xl font-black text-pitch">{nextRewardProgress}%</p>
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

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <HomeLink href="/add-km" title="Add KM" text="Turn whole kilometres into random player rewards." />
        <HomeLink href="/collection" title="Collection" text="Browse cards, filter by role, rarity, and club." />
        <HomeLink href="/squad" title="Squad" text="Pick your XI manually or auto-select your strongest team." />
        <HomeLink href="/chat" title="Chat" text="Talk tactics, pulls, and live scores with the group." />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wide text-green-800/70">{label}</p>
      <p className="mt-2 text-4xl font-black text-green-950">{value}</p>
    </div>
  );
}

function HomeLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="rounded-lg bg-pitch p-5 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-green-800">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-2 text-sm font-medium text-green-50/85">{text}</p>
    </Link>
  );
}
