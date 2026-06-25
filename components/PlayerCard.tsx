import type { Player } from "@/lib/types";
import { flagUrl } from "@/lib/flags";
import { getCupThemeById } from "@/lib/cupLegends";
import { CupMotif } from "@/components/CupMotif";
import { LegendPortrait } from "@/components/LegendPortrait";

const rarityStyles: Record<Player["rarity"], string> = {
  clowns: "border-red-400 bg-red-50 text-red-950",
  common: "border-slate-300 bg-slate-50 text-slate-900",
  rare: "border-sky-300 bg-sky-50 text-sky-950",
  epic: "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950",
  legend: "border-amber-300 bg-amber-50 text-amber-950 shadow-amber-200/60",
  icon: "border-zinc-300 bg-zinc-950 text-zinc-50 shadow-zinc-400/40"
};

const rarityCardClasses: Record<Player["rarity"], string> = {
  clowns: "sticker-clowns",
  common: "sticker-common",
  rare: "sticker-rare",
  epic: "sticker-epic",
  legend: "sticker-legend",
  icon: "sticker-icon"
};

const rarityLabels: Record<Player["rarity"], string> = {
  clowns: "Clowns",
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legend: "Legend",
  icon: "Icon"
};

const rarityMarks: Record<Player["rarity"], string> = {
  clowns: "!",
  common: "K",
  rare: "*",
  epic: "◆",
  legend: "★",
  icon: "XI"
};

function formatNumber(value: number | null) {
  return value === null ? "Unknown" : value.toLocaleString();
}

export function PlayerCard({
  player,
  duplicateCount = 0,
  large = false,
  ratingBoost = 0,
  variant = "default",
  hideRating = false
}: {
  player: Player;
  duplicateCount?: number;
  large?: boolean;
  ratingBoost?: number;
  variant?: "default" | "album";
  /** Used for unowned cup-prize previews — keeps the exact rating a surprise. */
  hideRating?: boolean;
}) {
  const detailClass = large ? "grid-cols-2" : "grid-cols-1";
  const flag = flagUrl(player.nation);
  const effectiveRating = player.rating + ratingBoost;
  const boostText = ratingBoost > 0 ? `+${ratingBoost}` : ratingBoost < 0 ? String(ratingBoost) : "";
  const album = variant === "album";
  const cupTheme = getCupThemeById(player.cupId);

  return (
    <article
      className={`card-sheen relative overflow-hidden rounded-lg border-2 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        cupTheme
          ? `bg-gradient-to-br ${cupTheme.colours} text-white ${cupTheme.border} card-cup-legend`
          : `${album ? rarityCardClasses[player.rarity] : ""} ${rarityStyles[player.rarity]} ${
              player.rarity === "icon" ? "card-icon" : player.rarity === "legend" ? "card-legend" : ""
            }`
      } ${large ? "min-h-72" : "min-h-64"} ${album ? "outline outline-4 outline-white ring-1 ring-green-950/10" : ""}`}
    >
      {cupTheme ? (
        <>
          <CupMotif cupId={cupTheme.cupId} className="pointer-events-none absolute inset-0 h-full w-full" />
          <LegendPortrait
            imagePath={cupTheme.imagePath}
            shirtNumber={cupTheme.shirtNumber}
            alt={cupTheme.legend}
            className="pointer-events-none absolute -bottom-3 -right-3 h-28 w-20"
            silhouetteOpacity="opacity-25"
          />
        </>
      ) : null}

      {/* Single positioned wrapper so all real content paints above the
          absolutely-positioned watermark/silhouette, regardless of branch. */}
      <div className="relative">
        {album ? (
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-black/10 pb-2">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] opacity-60">
              {cupTheme ? `${cupTheme.cupName} Champion Card` : "Official Tournament Sticker"}
            </span>
            <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tabular-nums opacity-90 ${cupTheme ? cupTheme.accent : "bg-black/10 opacity-70"}`}>
              {cupTheme ? "Cup Legend" : `${rarityLabels[player.rarity]} #${player.id}`}
            </span>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${cupTheme ? `${cupTheme.accent}` : "bg-black/10 opacity-80"}`}>
              {cupTheme ? "Cup Legend" : player.rarity}
            </p>
            <h3 className={`${large ? "text-3xl" : "text-lg"} break-words font-black leading-tight`}>{player.name}</h3>
            {cupTheme ? <p className="text-xs font-bold opacity-80">{cupTheme.cupName} · {cupTheme.country}</p> : null}
          </div>
          <div className={`shrink-0 rounded-lg border px-3 py-2 text-center shadow-sm ${cupTheme ? "border-white/30 bg-white/15 text-white" : "border-black/5 bg-white/80 text-green-950"}`}>
            <div className={`${large ? "text-3xl" : "text-xl"} font-black`}>{hideRating ? "??" : effectiveRating}</div>
            <div className="text-xs font-bold">{player.pos}</div>
            {!hideRating && ratingBoost > 0 && <div className={`text-[10px] font-black ${cupTheme ? "text-amber-200" : "text-green-600"}`}>+{ratingBoost} ⚽</div>}
          </div>
        </div>

        {hideRating ? (
          <p className="mt-5 rounded-md bg-black/10 px-3 py-2 text-center text-xs font-black uppercase tracking-wide opacity-80">
            Rating revealed only to the cup winner
          </p>
        ) : (
          <div className={`mt-5 grid ${detailClass} gap-2 text-xs font-semibold`}>
            <Detail label="Nation" value={player.nation} flag={flag} />
            <Detail label="Club" value={player.club} href={player.clubWiki} />
            <Detail label="DOB" value={player.dob} />
            <Detail label="Caps" value={formatNumber(player.caps)} />
            <Detail label="Goals" value={formatNumber(player.goals)} />
          </div>
        )}

        {player.wiki ? (
          <a className="mt-4 inline-flex max-w-full break-words rounded-md bg-black/10 px-2 py-1 text-xs font-black hover:bg-black/15" href={player.wiki} target="_blank" rel="noreferrer">
            Wikipedia
          </a>
        ) : (
          <p className="mt-4 inline-flex rounded-md bg-black/10 px-2 py-1 text-xs font-black">No Wikipedia page</p>
        )}

        {duplicateCount > 0 ? (
          <p className="mt-4 inline-flex rounded-md bg-black/10 px-2 py-1 text-xs font-bold">{album ? `Swap pile x${duplicateCount}` : `Duplicate pulls: ${duplicateCount}`}</p>
        ) : null}

        {album ? (
          <div className="mt-4 flex items-center justify-between border-t border-black/10 pt-2 text-[9px] font-black uppercase tracking-wide opacity-55">
            <span>KMXI 2026</span>
            <span>{player.teamId}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Detail({ label, value, href, flag }: { label: string; value: string; href?: string | null; flag?: string | null }) {
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
      <p className="mt-0.5 flex items-center justify-center gap-2">
        {flag ? <img className="h-4 w-6 shrink-0 rounded-sm object-cover shadow-sm" src={flag} alt={`${value} flag`} /> : null}
        {content}
      </p>
    </div>
  );
}
