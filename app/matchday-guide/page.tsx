import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";

const boostRows = [
  { rarity: "Icon", goal: "+2", assist: "+1", colour: "text-zinc-900" },
  { rarity: "Legend", goal: "+2", assist: "+1", colour: "text-amber-700" },
  { rarity: "Epic", goal: "+3", assist: "+2", colour: "text-fuchsia-700" },
  { rarity: "Rare", goal: "+5", assist: "+3", colour: "text-sky-700" },
  { rarity: "Common", goal: "+10", assist: "+5", colour: "text-slate-600" },
  { rarity: "Clowns", goal: "−5", assist: "−3", colour: "text-red-600" }
];

export default function MatchdayGuidePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Matchday Guide" subtitle="Everything that matters for a single matchday — pick, lock, and cash in. The full rulebook lives on the Rules page." />

      <div className="space-y-5">
        <Step n={1} title="Build a 4-3-3">
          <p>Pick your strongest eleven on the <Link href="/squad" className="font-black text-pitch underline">Squad page</Link>: <strong>1 goalkeeper, 4 defenders, 3 midfielders, 3 forwards</strong>. Use <strong>Auto-pick</strong> to fill it with your highest-rated available stickers.</p>
        </Step>

        <Step n={2} title="Lock by 3:00 PM UK">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Your squad locks every day at <strong>3:00 PM UK time</strong> for that day&apos;s matches.</li>
            <li>Change it as much as you like <strong>before</strong> the lock. After 3pm your XI is set until the next day.</li>
            <li>Forget to lock? Your current draft is <strong>auto-locked</strong> for you — but only what you&apos;d already picked counts.</li>
            <li>Only players in your <strong>locked XI on the day</strong> earn anything. Pick players whose nations actually play that day.</li>
          </ul>
        </Step>

        <Step n={3} title="Win matches → earn pack credits">
          <div className="rounded-md bg-pitch/5 p-3">
            <p className="text-2xl font-black text-pitch">1 credit</p>
            <p className="text-sm font-bold text-green-950">per locked player whose nation wins their match</p>
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>Two locked players from the <strong>same winning nation</strong>? That&apos;s 1 each — 2 total.</li>
            <li><strong>Draws and losses pay nothing.</strong> Only a win triggers credits.</li>
            <li>Credits never expire. Spend them on the home page: <strong>1 credit = 1 sticker pull</strong>.</li>
          </ul>
        </Step>

        <Step n={4} title="Goals & assists boost your stickers">
          <p>If a locked player scores or assists in real life, their sticker&apos;s rating changes <strong>permanently</strong> — by rarity:</p>
          <div className="mt-3 overflow-hidden rounded-lg border border-green-900/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-green-950/5 text-left text-xs font-bold uppercase tracking-wide text-green-900/60">
                  <th className="px-3 py-2">Rarity</th>
                  <th className="px-3 py-2 text-right">Per goal</th>
                  <th className="px-3 py-2 text-right">Per assist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-900/10">
                {boostRows.map((row) => (
                  <tr key={row.rarity}>
                    <td className={`px-3 py-2 font-black ${row.colour}`}>{row.rarity}</td>
                    <td className="px-3 py-2 text-right font-bold text-green-950">{row.goal}</td>
                    <td className="px-3 py-2 text-right font-bold text-green-950">{row.assist}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li><strong>Every goal counts:</strong> the boost is the per-goal value times the goals scored. A Common scoring twice is +10 ×2 = +20; a hattrick is +30. Assists work the same way at the assist rate.</li>
            <li><strong>Commons climb fastest</strong> — a common scoring is worth +10, an icon only +2.</li>
            <li><strong>Clowns lose rating</strong> when they score (−5) or assist (−3). Start one at your peril.</li>
            <li>Boosts stack all tournament and apply to <strong>your own copy</strong> of the sticker. No boost for players you pack <em>after</em> the match.</li>
          </ul>
        </Step>

        <Step n={5} title="Win the matchday">
          <p>Each day there&apos;s a <strong>head-to-head</strong>: whoever earns the most pack credits that matchday takes the <strong>daily crown 👑</strong>.</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>The crown winner gets to <strong>set the next day&apos;s news reel</strong> — the headline scrolling across the top of everyone&apos;s app.</li>
            <li>See standings on the <Link href="/leaderboard" className="font-black text-pitch underline">Leaderboard</Link> under Matchday Head-to-Head.</li>
          </ul>
        </Step>

        <section className="rounded-lg border border-white/10 bg-white/8 p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-white/70">Quick reference</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Ref label="Formation" value="4-3-3 (GK · 4 DF · 3 MF · 3 FW)" />
            <Ref label="Lock time" value="3:00 PM UK daily" />
            <Ref label="Match win" value="+1 credit per locked player" />
            <Ref label="Draw / loss" value="Nothing" />
            <Ref label="Goal boost" value="+2 to +10 (clowns −5)" />
            <Ref label="Assist boost" value="+1 to +5 (clowns −3)" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/squad" className="inline-flex rounded-md bg-pitch px-5 py-3 text-sm font-black text-white hover:bg-green-800">
              Go pick your XI
            </Link>
            <Link href="/results" className="inline-flex rounded-md border border-green-900/15 bg-white px-5 py-3 text-sm font-black text-green-950 hover:bg-green-50">
              See results
            </Link>
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-sm font-semibold text-white/55">
        Want the whole picture? See the full <Link href="/rules" className="font-black text-amber-400 underline">Rules</Link>.
      </p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pitch text-sm font-black text-white">{n}</span>
        <h2 className="text-lg font-black text-green-950">{title}</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm font-semibold leading-relaxed text-green-900/80">{children}</div>
    </section>
  );
}

function Ref({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-green-900/45">{label}</p>
      <p className="mt-0.5 text-sm font-black text-green-950">{value}</p>
    </div>
  );
}
