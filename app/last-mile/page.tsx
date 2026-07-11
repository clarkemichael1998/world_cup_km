"use client";

import Link from "next/link";

export default function LastMilePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/80 via-teal-950/60 to-slate-900/80 p-8 shadow-xl shadow-emerald-950/40">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-400/60">KMXI · Final Week</p>
        <h1 className="mt-2 text-4xl font-black text-white tracking-tight">THE LAST MILE</h1>
        <p className="mt-2 text-sm font-semibold text-emerald-200/50">Your guide to the final week of KMXI</p>
      </div>

      <Section title="Daily Sprint">
        <p>Log 5km (or equivalent) each day from today until 18 July to unlock a mystery card pick. Each day presents three players — one defender, one midfielder, one attacker. Ratings are hidden. Pick one, keep it.</p>
        <p className="mt-2 font-bold text-white/80">No catch-ups — miss a day, miss the card.</p>
      </Section>

      <Section title="Activity Boost">
        <p>Pack credits are now awarded at 6× the normal rate. Use them. Completing a nation&apos;s full squad earns bonus pack credits — check your collection and see how close you are.</p>
      </Section>

      <Section title="Double Points">
        <p>From the semi-finals onwards (matchday starting 3pm, 12 July) all goals and assists from your locked XI score double. Lock your best squad now.</p>
      </Section>

      <Section title="Pack Odds">
        <p>More cards are in circulation this week but legend and icon cards are now half as likely to appear in packs. Rares are slightly more common.</p>
      </Section>

      <Section title="The Cups">
        <p>The Maradona Cup and Pele Cup are still live. Your cup results count — stay active on matchdays.</p>
      </Section>

      <Section title="Consistency">
        <p>The cards available this week are a different class — earned only by showing up every day. The app ends on 19 July. Whether the daily walk continues after that is up to you.</p>
      </Section>

      <Section title="Danger Swaps">
        <p>There may be a reason to keep swapping. No further comment.</p>
      </Section>

      <Section title="Final Whistle — 11pm, 19 July" highlight>
        <p>The app locks down for good. No logging, no trading, no packs. The leaderboard freezes. Whoever has the highest squad average at that moment wins the tournament.</p>
      </Section>

      <div className="pt-2">
        <Link href="/" className="inline-block rounded-xl bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15 transition">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}

function Section({ title, children, highlight = false }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "border-emerald-400/40 bg-emerald-950/30" : "border-white/10 bg-white/5"}`}>
      <h2 className={`text-sm font-black uppercase tracking-[0.2em] mb-2 ${highlight ? "text-emerald-300" : "text-white/50"}`}>{title}</h2>
      <div className="text-sm font-semibold text-white/75 leading-relaxed">{children}</div>
    </div>
  );
}
