import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";

const cupLegendCards = [
  { name: "Henrik Larsson", rating: 105 },
  { name: "Kenny Dalglish", rating: 110 },
  { name: "Diego Maradona", rating: 115 },
  { name: "Pele", rating: 120 }
];

const rounds = [
  ["Day 1", "Play-off", "Two randomly drawn players fight for the final Round of 16 place. Winner gets 10 stickers."],
  ["Day 2", "Round of 16", "Sixteen players become eight."],
  ["Day 3", "Quarter-finals", "Eight players become four. Quarter-final eliminations get 15 stickers."],
  ["Day 4", "Semi-finals", "Four players become two. Semi-final eliminations get 25 stickers."],
  ["Day 5", "Final", "Runner-up gets 30 stickers plus a guaranteed Icon. Winner gets 35 stickers plus the Cup Legend."]
];

export default function CupRulesPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          title="Cup Rules"
          subtitle="Four back-to-back knockout cups to close the tournament: random head-to-head fixtures, daily scores, and Cup Legend prizes."
        />
        <Link href="/cups" className="rounded-md bg-pitch px-4 py-2 text-sm font-black text-white hover:bg-green-800">
          View Cup Draw
        </Link>
      </div>

      <div className="grid gap-5">
        <Section title="The Setup">
          <p>
            There are four separate five-day cups. Every cup starts with a random draw. With 17 players, Day 1 is a play-off match, then the winner joins the Round of 16.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {["Cup 1", "Cup 2", "Cup 3", "Cup 4"].map((cup, index) => (
              <div key={cup} className="rounded-lg bg-green-950/5 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-green-900/50">{cup}</p>
                <p className="mt-1 font-black text-green-950">5 matchdays</p>
                <p className="text-xs font-bold text-green-900/60">Random draw #{index + 1}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Cup Format">
          <div className="grid gap-2">
            {rounds.map(([day, title, body]) => (
              <div key={day} className="rounded-lg border border-green-900/10 bg-white p-3">
                <p className="text-xs font-black uppercase tracking-wide text-green-900/45">{day}</p>
                <p className="font-black text-green-950">{title}</p>
                <p className="text-sm font-semibold text-green-900/70">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="How Head-To-Head Scoring Works">
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Total score:</strong> activity points plus football points.</li>
            <li><strong>Activity points:</strong> 1 point per activity credit logged that matchday, capped at 40 points.</li>
            <li><strong>Football points:</strong> nation wins, goals, and assists, capped at 40 points.</li>
            <li><strong>Nation win:</strong> +2 football points for every locked player whose nation wins that matchday.</li>
            <li><strong>Goal boosts:</strong> the goal boost amount counts as football points.</li>
            <li><strong>Assist boosts:</strong> the assist boost amount counts as football points.</li>
            <li><strong>Tie-breaker:</strong> if total scores are level, higher uncapped daily activity wins.</li>
            <li>If still tied after activity, admins can apply a manual ruling.</li>
          </ul>
        </Section>

        <Section title="Prizes">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-amber-800/60">Cup Winner</p>
              <p className="mt-1 text-lg font-black text-amber-950">35 stickers + Cup Legend card</p>
              <div className="mt-3 grid gap-2">
                {cupLegendCards.map((card) => (
                  <div key={card.name} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm font-black text-green-950">
                    <span>{card.name}</span>
                    <span>{card.rating}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-green-900/10 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-green-900/50">Runner-Up</p>
              <p className="mt-1 text-lg font-black text-green-950">30 stickers + guaranteed Icon</p>
              <p className="mt-2 text-sm font-semibold text-green-900/70">The losing finalist still walks away with a massive pack hit and a guaranteed Icon card.</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Reward label="Play-off winner" value="10 stickers" />
            <Reward label="Quarter-final elimination" value="15 stickers" />
            <Reward label="Semi-final elimination" value="25 stickers" />
          </div>
        </Section>

        <Section title="Repeat Winners">
          <p>
            Repeat winners are allowed. If someone wins multiple cups, they keep winning prizes. Dynasties are allowed; knocking them out is part of the fun.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Reward({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-green-950/5 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-green-900/50">{label}</p>
      <p className="mt-1 font-black text-green-950">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-green-900/10 bg-white p-5 text-sm font-semibold leading-6 text-green-900/80 shadow-sm">
      <h2 className="mb-3 text-xl font-black text-green-950">{title}</h2>
      {children}
    </section>
  );
}
