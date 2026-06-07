"use client";

import { useState } from "react";
import { PageTitle } from "@/components/PageTitle";

const rarityRows = [
  { rarity: "Icon", rating: "93+", chance: "0.5%", colour: "text-zinc-950 font-black" },
  { rarity: "Legend", rating: "86-92", chance: "2.5%", colour: "text-amber-700 font-black" },
  { rarity: "Epic", rating: "78-85", chance: "8%", colour: "text-fuchsia-700 font-black" },
  { rarity: "Rare", rating: "70-77", chance: "25%", colour: "text-sky-700 font-black" },
  { rarity: "Common", rating: "58-69", chance: "63%", colour: "text-slate-600 font-black" },
  { rarity: "Clowns", rating: "< 58", chance: "1%", colour: "text-red-600 font-black" }
];

const boostRows = [
  { rarity: "Icon", goal: "+2", assist: "+1", colour: "text-zinc-950 font-black" },
  { rarity: "Legend", goal: "+2", assist: "+1", colour: "text-amber-700 font-black" },
  { rarity: "Epic", goal: "+3", assist: "+2", colour: "text-fuchsia-700 font-black" },
  { rarity: "Rare", goal: "+5", assist: "+3", colour: "text-sky-700 font-black" },
  { rarity: "Common", goal: "+10", assist: "+5", colour: "text-slate-600 font-black" },
  { rarity: "Clowns", goal: "-5", assist: "-3", colour: "text-red-600 font-black" }
];

export default function RulesPage() {
  const [tab, setTab] = useState<"simple" | "detailed">("simple");

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="KMXI Rules"
        subtitle="A World Cup 2026 activity game: move your body, earn player stickers, build your XI, and ride the tournament chaos."
      />

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-green-900/10 bg-white p-1 shadow-sm">
        <TabButton active={tab === "simple"} onClick={() => setTab("simple")}>
          Simple Rules
        </TabButton>
        <TabButton active={tab === "detailed"} onClick={() => setTab("detailed")}>
          Detailed Rules
        </TabButton>
      </div>

      {tab === "simple" ? <SimpleRules /> : <DetailedRules />}

      <p className="mt-10 pb-4 text-center text-[10px] font-semibold uppercase tracking-[0.35em] text-green-950/20">
        Clarke Enterprises
      </p>
    </div>
  );
}

function SimpleRules() {
  return (
    <div className="space-y-6">
      <Section title="KMXI in 30 Seconds">
        <p>
          KMXI is a World Cup 2026 activity game. Move in real life, earn player stickers, build a 4-3-3 squad, and let the tournament chaos boost or bruise your stickers.
        </p>
        <ul className="mt-3 grid gap-2 text-green-900/75 sm:grid-cols-2">
          <Callout label="Move" text="Log walks, runs, cycling, workouts, sport, or mobility." />
          <Callout label="Pull" text="Whole activity credits become random player stickers." />
          <Callout label="Build" text="Pick your best XI and lock it before matchdays." />
          <Callout label="Win" text="Goals, assists, match wins, and viral moments can swing ratings." />
        </ul>
      </Section>

      <Section title="How You Earn Stickers">
        <ul className="list-disc space-y-1 pl-5">
          <li>Walk/run: <strong>1 km = 1 activity credit</strong>.</li>
          <li>Cycle: <strong>3 km = 1 activity credit</strong>.</li>
          <li>Strength: <strong>10 minutes = 1 activity credit</strong>.</li>
          <li>Sport: <strong>10 minutes = 1 activity credit</strong>.</li>
          <li>Yoga/mobility: <strong>30 minutes = 1 activity credit</strong>.</li>
          <li>Whole credits earn stickers. Fractions carry over.</li>
          <li>You can submit up to <strong>3 activity logs per day</strong>.</li>
        </ul>
      </Section>

      <Section title="Packs and Rarity">
        <p>
          Stickers come from the World Cup 2026 player pool. Icons and legends are rare, commons are everywhere, and clown stickers are dangerous fun.
        </p>
        <DataTable
          headers={["Rarity", "Rating", "Chance"]}
          rows={rarityRows.map((row) => [<span key={row.rarity} className={row.colour}>{row.rarity}</span>, row.rating, row.chance])}
        />
        <p className="mt-3 text-green-900/70">
          Log in during the tournament to receive <strong>2 free pack credits per day</strong>. Match wins can also earn pack credits from your locked squad.
        </p>
      </Section>

      <Section title="Squad Lock and Boosts">
        <ul className="list-disc space-y-1 pl-5">
          <li>Build a strict <strong>4-3-3</strong>: 1 GK, 4 DF, 3 MF, 3 FW.</li>
          <li>Your squad locks each day at <strong>11:00 AM UK time</strong>.</li>
          <li>Players must be in your locked XI on the day to earn match rewards.</li>
          <li>Goals and assists permanently change ratings.</li>
          <li>Viral World Cup moments can also affect ratings at admin discretion.</li>
        </ul>
      </Section>

      <Section title="How the Leaderboard Works">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your main score is your <strong>Best Squad Rating</strong>.</li>
          <li>Activity credits, games won, goal boosts, and assist boosts also show on the leaderboard.</li>
          <li>Everything locks at <strong>World Cup Final kick-off on 19 July 2026</strong>.</li>
        </ul>
      </Section>

      <Section title="Do Not Cheat" tone="danger">
        <p>
          KMXI suffers no fools. Log real activity only.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Admins can remove false logs.</li>
          <li>Admins can claw back stickers, credits, boosts, and leaderboard progress.</li>
          <li>Fraud, duplicate accounts, or suspicious behaviour can lead to penalties or removal from the game.</li>
        </ul>
      </Section>
    </div>
  );
}

function DetailedRules() {
  return (
      <div className="space-y-6">
        <Section title="What Is KMXI?">
          <p>
            KMXI is a World Cup 2026 sticker chase powered by real activity. Log workouts, earn sticker pulls, collect players from the tournament squad pool, then build the strongest 4-3-3 XI you can.
          </p>
          <ul className="mt-3 grid gap-2 text-green-900/75 sm:grid-cols-2">
            <Callout label="Move" text="Walk, run, ride, train, play sport, or do mobility work." />
            <Callout label="Collect" text="Activity turns into player stickers and pack credits." />
            <Callout label="Compete" text="Your best XI, match wins, and boosts feed the ranking." />
            <Callout label="React" text="Goals, assists, viral moments, and tournament drama can change ratings." />
          </ul>
        </Section>

        <Section title="1. Accounts">
          <p>
            Create or reopen your account from the Login page. Your account keeps your World Cup 2026 activity, stickers, credits, squad, chat messages, and leaderboard progress tied to you.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-green-900/70">
            <li><strong>There is no password recovery.</strong> If you forget your password, the account cannot be accessed again.</li>
            <li>One account per person. Shared accounts, duplicate accounts, and funny business are not part of the game.</li>
          </ul>
        </Section>

        <Section title="2. Log Your Activity">
          <p>
            Physical activity is the fuel. Log activity honestly on the Add Activity page. Whole activity credits count toward stickers, and any fraction carries over to your next session.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-green-900/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-950/5 text-left text-xs font-black uppercase tracking-wide text-green-900/60">
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-900/10">
                <Row left="Walk or run" right="1 km = 1 activity credit" />
                <Row left="Cycle" right="3 km = 1 activity credit" />
                <Row left="Strength" right="10 minutes = 1 activity credit" />
                <Row left="Sport" right="10 minutes = 1 activity credit" />
                <Row left="Yoga or mobility" right="30 minutes = 1 activity credit" />
              </tbody>
            </table>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-green-900/70">
            <li>Maximum <strong>3 activity logs per day</strong>.</li>
            <li>All logging closes permanently at the <strong>World Cup Final kick-off on 19 July 2026</strong>.</li>
          </ul>
        </Section>

        <Section title="3. Collect Player Stickers">
          <p>
            Every pull draws from the World Cup 2026 player pool. Rarer stickers are harder to find, higher rated, and much louder when they land.
          </p>
          <DataTable
            headers={["Rarity", "Rating range", "Pull chance"]}
            rows={rarityRows.map((row) => [<span key={row.rarity} className={row.colour}>{row.rarity}</span>, row.rating, row.chance])}
          />
          <p className="mt-3 text-green-900/70">
            You cannot hold duplicate stickers. If you pull a player you already own, it is counted as a duplicate on that sticker instead.
          </p>
        </Section>

        <Section title="4. Pack Credits">
          <p>
            Activity earns stickers directly, but pack credits give you extra shots at the sticker pile.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-green-900/70">
            <li><strong>2 free credits</strong> are added to your balance every day you log in during the tournament.</li>
            <li><strong>Match credits</strong> are earned when players in your locked squad represent a winning nation.</li>
            <li>A match win gives <strong>3 credits per eligible locked player</strong>.</li>
            <li>Credits can be spent on the home page. <strong>1 credit = 1 sticker pull</strong>, up to 20 at a time.</li>
            <li>Credits do not expire and carry over until spent.</li>
          </ul>
        </Section>

        <Section title="5. Build and Lock Your XI">
          <p>
            Use the Squad page to pick your best 11 from your collection. The formation is a strict <strong>4-3-3</strong>: 1 GK, 4 DF, 3 MF, and 3 FW.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-green-900/70">
            <li>Use Auto-pick to fill your squad with your highest-rated available players.</li>
            <li>Your squad can be changed freely until the daily lock.</li>
            <li>Each day at <strong>11:00 AM UK time</strong>, your current squad is locked for that matchday.</li>
            <li>Your squad resets for the next lock window at 11:00 AM the following day.</li>
          </ul>
        </Section>

        <Section title="6. Match Rewards and Rating Boosts">
          <p>
            The tournament matters. If players in your locked XI show up on the pitch, your collection can grow stronger.
          </p>
          <DataTable
            headers={["Rarity", "Per goal", "Per assist"]}
            rows={boostRows.map((row) => [<span key={row.rarity} className={row.colour}>{row.rarity}</span>, row.goal, row.assist])}
          />
          <ul className="mt-3 list-disc space-y-1 pl-5 text-green-900/70">
            <li>Goals and assists permanently boost that player sticker.</li>
            <li>Boosts stack across the tournament. A hattrick earns 3x the goal boost.</li>
            <li>The player must be in your <strong>locked squad on the day of the performance</strong>.</li>
            <li>Packing a player later gives no retroactive boost for earlier goals or assists.</li>
            <li>Clown stickers lose rating for goals and assists. Choose carefully. The game has jokes, but it also has consequences.</li>
          </ul>
        </Section>

        <Section title="7. Viral Moments">
          <p>
            World Cups are not tidy. A last-minute winner, a disasterclass, an iconic celebration, a heroic save, a penalty miss, or a clip that takes over the group chat can all affect ratings.
          </p>
          <p className="mt-2 text-green-900/70">
            Admins may award or remove rating based on viral tournament moments. These changes are part of the drama and apply at admin discretion.
          </p>
        </Section>

        <Section title="8. Leaderboard and Final Submission">
          <p>
            At the <strong>World Cup Final kick-off on 19 July 2026</strong>, all squad selections and activity logging are permanently locked. Your final squad is your entry.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-green-900/70">
            <li><strong>Best Squad Rating:</strong> average rating of your strongest possible 4-3-3 XI, including boosts.</li>
            <li><strong>Activity Credits:</strong> cumulative reward-equivalent activity logged across the tournament.</li>
            <li><strong>Games Won:</strong> matches where at least one locked player represented a winning nation.</li>
          </ul>
        </Section>

        <Section title="9. Fraud, Fools, and Admin Powers" tone="danger">
          <p>
            KMXI suffers no fools. This is a friendly game, but fraudulent logs, duplicate accounts, suspicious behaviour, or attempts to exploit the system will be dealt with.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>Admins can review, edit, or remove fraudulent activity logs.</li>
            <li>Admins can claw back stickers, pack credits, rating boosts, and leaderboard progress gained from bad logs.</li>
            <li>Admins can impose punishments, including rating penalties, sticker removals, account restrictions, or removal from the game.</li>
            <li>Admins can correct match data, scoring errors, rating boosts, and viral-moment awards throughout the tournament.</li>
            <li>Log honestly, play properly, and keep the chat respectful.</li>
          </ul>
        </Section>
      </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-4 py-3 text-sm font-black transition-colors ${
        active ? "bg-pitch text-white shadow-sm" : "text-green-950 hover:bg-green-950/8"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "danger" }) {
  const danger = tone === "danger";

  return (
    <section className={`rounded-lg border p-5 shadow-sm ${danger ? "border-red-200 bg-red-50 text-red-950" : "border-green-900/10 bg-white"}`}>
      <h2 className={`text-lg font-black ${danger ? "text-red-950" : "text-green-950"}`}>{title}</h2>
      <div className={`mt-3 space-y-2 text-sm font-semibold leading-relaxed ${danger ? "text-red-950/85" : "text-green-900/80"}`}>
        {children}
      </div>
    </section>
  );
}

function Callout({ label, text }: { label: string; text: string }) {
  return (
    <li className="rounded-md bg-green-950/5 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-wide text-green-900/55">{label}</p>
      <p className="mt-1 text-sm font-bold text-green-950">{text}</p>
    </li>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-green-900/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-green-950/5 text-left text-xs font-black uppercase tracking-wide text-green-900/60">
            {headers.map((header, index) => (
              <th key={header} className={`px-3 py-2 ${index > 0 ? "text-right" : ""}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-green-900/10">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={`px-3 py-2 text-green-950 ${cellIndex > 0 ? "text-right" : ""}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-black text-green-950">{left}</td>
      <td className="px-3 py-2 text-right text-green-900/70">{right}</td>
    </tr>
  );
}
