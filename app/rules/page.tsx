import { PageTitle } from "@/components/PageTitle";

export default function RulesPage() {
  return (
    <div className="max-w-2xl">
      <PageTitle title="Rules" subtitle="How KMXI works." />

      <div className="space-y-6">
        <Section title="1. Log Your KM">
          <p>Every kilometre you run, walk, or cycle earns you a <strong>player card</strong>. Log your distance on the Add KM page after each activity. Whole kilometres count — fractions carry over to your next session.</p>
        </Section>

        <Section title="2. Collect Player Cards">
          <p>Each kilometre triggers a card pull. Cards are randomly drawn from the full World Cup 2026 squad pool. Rarity is determined by the player&apos;s overall rating:</p>
          <table className="mt-3 w-full text-sm rounded-lg overflow-hidden border border-green-900/10">
            <thead>
              <tr className="bg-green-950/5 text-left text-xs font-black uppercase tracking-wide text-green-900/60">
                <th className="px-3 py-2">Rarity</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2 text-right">Pull Chance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-900/10">
              {[
                { rarity: "Icon", rating: "93+", chance: "0.2%", colour: "text-zinc-950 font-black" },
                { rarity: "Legend", rating: "86–92", chance: "1.8%", colour: "text-amber-700 font-black" },
                { rarity: "Epic", rating: "78–85", chance: "8%", colour: "text-fuchsia-700 font-black" },
                { rarity: "Rare", rating: "70–77", chance: "25%", colour: "text-sky-700 font-black" },
                { rarity: "Common", rating: "58–69", chance: "64%", colour: "text-slate-600 font-black" },
                { rarity: "Clowns", rating: "< 58", chance: "1%", colour: "text-red-600 font-black" },
              ].map((row) => (
                <tr key={row.rarity}>
                  <td className={`px-3 py-2 ${row.colour}`}>{row.rarity}</td>
                  <td className="px-3 py-2 text-green-950">{row.rating}</td>
                  <td className="px-3 py-2 text-right text-green-900/70">{row.chance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-green-900/70">Duplicate cards are tracked — you can&apos;t have the same player twice but duplicates are counted on your card.</p>
        </Section>

        <Section title="3. Build Your XI">
          <p>Pick your best 11 players from your collection using the Squad page. You must fill all positions in a <strong>4-3-3 formation</strong>: 1 GK, 4 DF, 3 MF, 3 FW. Use Auto-pick to fill your squad with your highest rated players automatically.</p>
        </Section>

        <Section title="4. Lock In &amp; Score Points">
          <p>Before each World Cup matchday, <strong>lock your squad</strong> on the Live page. Points are awarded for every player in your locked XI whose nation wins a match. The better your squad rating, the stronger your position.</p>
        </Section>

        <Section title="5. Leaderboard">
          <p>The <strong>KM Leaderboard</strong> ranks all players by total kilometres logged. Keep running to stay at the top. The more you move, the more cards you earn and the stronger your squad becomes.</p>
        </Section>

        <Section title="General Rules">
          <ul className="list-disc space-y-1 pl-5">
            <li>Log KM honestly — this is based on real physical activity.</li>
            <li>One account per person.</li>
            <li>Keep chat respectful.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-green-900/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-green-950">{title}</h2>
      <div className="mt-3 space-y-2 text-sm font-semibold leading-relaxed text-green-900/80">
        {children}
      </div>
    </section>
  );
}
