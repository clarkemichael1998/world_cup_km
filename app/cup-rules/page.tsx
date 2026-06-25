import Link from "next/link";
import { PageTitle } from "@/components/PageTitle";

const cupLegendCards = [
  { name: "Henrik Larsson", rating: 95 },
  { name: "Kenny Dalglish", rating: 100 },
  { name: "Diego Maradona", rating: 105 },
  { name: "Pele", rating: 110 }
];

const rounds = [
  ["Day 1", "Play-in", "Two randomly drawn players fight for the final Round of 16 place."],
  ["Day 2", "Round of 16", "Sixteen players become eight."],
  ["Day 3", "Quarter-finals", "Eight players become four."],
  ["Day 4", "Semi-finals", "Four players become two."],
  ["Day 5", "Final", "Winner takes the Cup Legend card."]
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
            There are four separate five-day cups. Every cup starts with a random draw. With 17 players, Day 1 is a play-in match, then the winner joins the Round of 16.
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
            <li><strong>Nation win:</strong> +1 cup point for every locked player whose nation wins that matchday.</li>
            <li><strong>Goal boosts:</strong> the goal boost amount counts as cup points.</li>
            <li><strong>Assist boosts:</strong> the assist boost amount counts as cup points.</li>
            <li><strong>Tie-breaker:</strong> higher activity logged on that matchday wins the tie.</li>
            <li>If still tied after activity, admins can apply a manual ruling.</li>
          </ul>
        </Section>

        <Section title="Prizes">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-amber-800/60">Cup Winner</p>
              <p className="mt-1 text-lg font-black text-amber-950">Cup Legend card</p>
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
              <p className="mt-1 text-lg font-black text-green-950">Legend Elite card</p>
              <p className="mt-2 text-sm font-semibold text-green-900/70">The losing finalist gets a legend-tier reward from the existing player pool.</p>
            </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-green-900/10 bg-white p-5 text-sm font-semibold leading-6 text-green-900/80 shadow-sm">
      <h2 className="mb-3 text-xl font-black text-green-950">{title}</h2>
      {children}
    </section>
  );
}
