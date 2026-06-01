import type { Player } from "@/lib/types";

const rarityStyles: Record<Player["rarity"], string> = {
  common: "border-slate-300 bg-slate-50 text-slate-900",
  rare: "border-sky-300 bg-sky-50 text-sky-950",
  epic: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950",
  legend: "border-amber-300 bg-amber-50 text-amber-950",
  icon: "border-zinc-300 bg-zinc-950 text-zinc-50"
};

function formatNumber(value: number | null) {
  return value === null ? "Unknown" : value.toLocaleString();
}

export function PlayerCard({ player, duplicateCount = 0, large = false }: { player: Player; duplicateCount?: number; large?: boolean }) {
  const detailClass = large ? "grid-cols-2" : "grid-cols-1";

  return (
    <article className={`card-sheen rounded-lg border-2 p-4 shadow-sm ${rarityStyles[player.rarity]} ${large ? "min-h-72" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide opacity-70">{player.rarity}</p>
          <h3 className={`${large ? "text-3xl" : "text-lg"} break-words font-black leading-tight`}>{player.name}</h3>
          <p className="mt-1 break-words text-xs font-bold opacity-70">{player.slug}</p>
        </div>
        <div className="shrink-0 rounded-md bg-white/70 px-3 py-2 text-center text-green-950">
          <div className={`${large ? "text-3xl" : "text-xl"} font-black`}>{player.rating}</div>
          <div className="text-xs font-bold">{player.pos}</div>
        </div>
      </div>

      <div className={`mt-5 grid ${detailClass} gap-2 text-xs font-semibold`}>
        <Detail label="Nation" value={player.nation} />
        <Detail label="Team ID" value={player.teamId} />
        <Detail label="Club" value={player.club} href={player.clubWiki} />
        <Detail label="Club country" value={player.clubCountry} />
        <Detail label="DOB" value={player.dob} />
        <Detail label="Caps" value={formatNumber(player.caps)} />
        <Detail label="Goals" value={formatNumber(player.goals)} />
        <Detail label="Sort name" value={player.sortName} />
      </div>

      {player.wiki ? (
        <a className="mt-4 inline-flex max-w-full break-words rounded-md bg-black/10 px-2 py-1 text-xs font-black hover:bg-black/15" href={player.wiki} target="_blank" rel="noreferrer">
          Wikipedia
        </a>
      ) : (
        <p className="mt-4 inline-flex rounded-md bg-black/10 px-2 py-1 text-xs font-black">No Wikipedia page</p>
      )}

      {duplicateCount > 0 ? (
        <p className="mt-4 inline-flex rounded-md bg-black/10 px-2 py-1 text-xs font-bold">+{duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}</p>
      ) : null}
    </article>
  );
}

function Detail({ label, value, href }: { label: string; value: string; href?: string | null }) {
  const content = href ? (
    <a className="break-words underline decoration-current/40 underline-offset-2 hover:decoration-current" href={href} target="_blank" rel="noreferrer">
      {value}
    </a>
  ) : (
    <span className="break-words">{value}</span>
  );

  return (
    <div className="min-w-0 rounded-md bg-black/5 px-2 py-1">
      <p className="text-[10px] font-black uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-0.5">{content}</p>
    </div>
  );
}
