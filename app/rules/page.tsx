import { PageTitle } from "@/components/PageTitle";
import { goLiveLabel, isPreLaunch } from "@/lib/launch";

export default function RulesPage() {
  const preLaunch = isPreLaunch();

  return (
    <div className="max-w-2xl">
      <PageTitle title="Rules" subtitle="How KMXI works." />

      <div className="space-y-6">
        {preLaunch ? (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <p className="text-sm font-black uppercase tracking-wide">Pre-launch</p>
            <p className="mt-1 text-sm font-semibold">
              KMXI goes live on {goLiveLabel()}. Until then, visitors are redirected here and only the rules are visible so everyone starts from a blank slate.
            </p>
          </section>
        ) : null}

        <Section title="1. Accounts &amp; Launch">
          <p>KMXI will not be playable until <strong>{goLiveLabel()}</strong>. Before Thursday, every page redirects to the Rules page so nobody can log activity, open packs, build a squad, or get an early advantage.</p>
          <p className="mt-2 text-green-900/70">Once the game is live, create or reopen your account from the Login page with a username and password. Your account keeps your activity, cards, credits, squad, chat messages, and leaderboard progress tied to you.</p>
          <p className="mt-2 text-green-900/70"><strong>There is no password recovery.</strong> If you forget your password, the account cannot be accessed again, so keep it somewhere safe.</p>
        </Section>

        <Section title="2. Log Your Activity">
          <p>Walks, runs, rides, strength workouts, sport sessions, and mobility work all earn <strong>player cards</strong>. Log your activity on the Add Activity page. Whole activity credits count toward cards, and any fraction carries over to your next session.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-green-900/70">
            <li>Maximum <strong>3 logs per day</strong></li>
            <li><strong>Walk/run:</strong> 1 km = 1 activity credit</li>
            <li><strong>Cycle:</strong> 3 km = 1 activity credit</li>
            <li><strong>Strength:</strong> 20 minutes = 1 activity credit</li>
            <li><strong>Sport:</strong> 15 minutes = 1 activity credit</li>
            <li><strong>Yoga/mobility:</strong> 30 minutes = 1 activity credit</li>
            <li>All logging closes permanently at the <strong>World Cup Final kick-off (19 July 2026)</strong></li>
          </ul>
        </Section>

        <Section title="3. Collect Player Cards">
          <p>Each card pull randomly draws a player from the full World Cup 2026 squad pool. The rarity of the card you receive is determined by chance — rarer cards are harder to pull but represent higher-rated players.</p>
          <table className="mt-3 w-full text-sm rounded-lg overflow-hidden border border-green-900/10">
            <thead>
              <tr className="bg-green-950/5 text-left text-xs font-black uppercase tracking-wide text-green-900/60">
                <th className="px-3 py-2">Rarity</th>
                <th className="px-3 py-2">Rating range</th>
                <th className="px-3 py-2 text-right">Pull chance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-900/10">
              {[
                { rarity: "Icon",   rating: "93+",    chance: "0.5%", colour: "text-zinc-950 font-black" },
                { rarity: "Legend", rating: "86–92",  chance: "2.5%", colour: "text-amber-700 font-black" },
                { rarity: "Epic",   rating: "78–85",  chance: "8%",   colour: "text-fuchsia-700 font-black" },
                { rarity: "Rare",   rating: "70–77",  chance: "25%",  colour: "text-sky-700 font-black" },
                { rarity: "Common", rating: "58–69",  chance: "63%",  colour: "text-slate-600 font-black" },
                { rarity: "Clowns", rating: "< 58",   chance: "1%",   colour: "text-red-600 font-black" },
              ].map((row) => (
                <tr key={row.rarity}>
                  <td className={`px-3 py-2 ${row.colour}`}>{row.rarity}</td>
                  <td className="px-3 py-2 text-green-950">{row.rating}</td>
                  <td className="px-3 py-2 text-right text-green-900/70">{row.chance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-green-900/70">You cannot hold duplicate cards — if you pull a player you already own, it is counted as a duplicate on that card instead.</p>
        </Section>

        <Section title="4. Pack Credits">
          <p>As well as earning cards directly from activity, you accumulate <strong>pack credits</strong> that can be spent on additional card pulls at any time.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-green-900/70">
            <li><strong>2 free credits</strong> are added to your balance every day you log in during the tournament</li>
            <li><strong>Match credits</strong> are earned when players in your locked squad represent a winning nation — <strong>3 credits per player per match win</strong></li>
            <li>Credits can be spent on the home page — <strong>1 credit = 1 card pull</strong>, up to 20 at a time</li>
            <li>Credits do not expire and carry over until spent</li>
          </ul>
        </Section>

        <Section title="5. Build Your XI">
          <p>Use the Squad page to pick your best 11 players from your collection. You must fill all positions in a <strong>4-3-3 formation</strong>: 1 GK, 4 DF, 3 MF, 3 FW. Use Auto-pick to automatically fill with your highest-rated available players.</p>
          <p className="mt-2 text-green-900/70">Your squad can be changed freely at any time up until the daily lock. The average rating of your best possible XI is shown on the leaderboard.</p>
        </Section>

        <Section title="6. Daily Lock &amp; Match Rewards">
          <p>Each day at <strong>11:00 AM (UK time)</strong>, your current squad is locked in for that matchday. You earn <strong>3 credits</strong> for every player in your locked XI whose nation wins a World Cup match that day.</p>
          <p className="mt-2 text-green-900/70">Your squad resets for the next lock window at 11:00 AM the following day, allowing you to update your XI based on form, fitness, or tournament progression.</p>
        </Section>

        <Section title="7. Player Rating Boosts">
          <p>When a player in your <strong>locked squad</strong> scores a goal or provides an assist in a real World Cup match, their rating on your card is permanently boosted. Boosts stack across the tournament.</p>
          <p className="mt-2 text-green-900/70">Viral moments throughout the tournament can also impact player ratings, including standout performances, infamous mistakes, iconic celebrations, and other admin-awarded moments.</p>
          <table className="mt-3 w-full text-sm rounded-lg overflow-hidden border border-green-900/10">
            <thead>
              <tr className="bg-green-950/5 text-left text-xs font-black uppercase tracking-wide text-green-900/60">
                <th className="px-3 py-2">Rarity</th>
                <th className="px-3 py-2 text-center">Per goal</th>
                <th className="px-3 py-2 text-center">Per assist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-900/10">
              {[
                { rarity: "Icon",   goal: "+2",  assist: "+1", colour: "text-zinc-950 font-black" },
                { rarity: "Legend", goal: "+2",  assist: "+1", colour: "text-amber-700 font-black" },
                { rarity: "Epic",   goal: "+3",  assist: "+2", colour: "text-fuchsia-700 font-black" },
                { rarity: "Rare",   goal: "+5",  assist: "+3", colour: "text-sky-700 font-black" },
                { rarity: "Common", goal: "+10", assist: "+5", colour: "text-slate-600 font-black" },
                { rarity: "Clowns", goal: "−5",  assist: "−3", colour: "text-red-600 font-black" },
              ].map((row) => (
                <tr key={row.rarity}>
                  <td className={`px-3 py-2 ${row.colour}`}>{row.rarity}</td>
                  <td className="px-3 py-2 text-center text-green-950">{row.goal}</td>
                  <td className="px-3 py-2 text-center text-green-950">{row.assist}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-green-900/70">
            <li>Boosts apply per goal and per assist — a hattrick earns 3× the boost</li>
            <li>The boost only applies if the player was in your <strong>locked squad on the day they scored</strong></li>
            <li>Packing a player after they have scored gives no retroactive boost for those earlier goals</li>
            <li>Clown cards lose rating for goals and assists — choose your squad wisely</li>
          </ul>
        </Section>

        <Section title="8. Final Submission &amp; Leaderboard">
          <p>At the <strong>World Cup Final kick-off (19 July 2026)</strong>, all squad selections and activity logging are permanently locked. Your final squad is your entry.</p>
          <p className="mt-2">The <strong>Ranking page</strong> tracks three leaderboards throughout the tournament:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-green-900/70">
            <li><strong>Activity Credits</strong> — cumulative reward-equivalent activity logged across the tournament</li>
            <li><strong>Best Squad Rating</strong> — average rating of your strongest possible 4-3-3 XI from your collection, including all accrued boosts</li>
            <li><strong>Games Won</strong> — number of matches in which at least one of your locked players represented a winning nation</li>
          </ul>
        </Section>

        <Section title="General Rules">
          <ul className="list-disc space-y-1 pl-5">
            <li>Log activity honestly — this is based on real physical activity only.</li>
            <li>One account per person. Do not share accounts.</li>
            <li><strong>If you forget your password, access cannot be recovered.</strong> There is no password reset — keep it safe.</li>
            <li>Keep chat respectful. Abusive messages will be removed.</li>
            <li>The admin reserves the right to correct any match data or scoring errors throughout the tournament.</li>
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
