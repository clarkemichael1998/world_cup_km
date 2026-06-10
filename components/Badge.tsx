import type { ReactNode } from "react";

/**
 * KMXI semantic colour palette — keep these meanings consistent app-wide:
 *  - green  → primary / success / owned / a win
 *  - amber  → rewards & high value (pack credits, champion, locked, premium pulls)
 *  - red    → destructive / penalties / clowns
 *  - sky    → neutral informational status (kickoff time, live)
 *  - slate  → muted / removed / disabled
 *  - orange → streaks / on-fire
 *  - neutral→ default chip with no strong meaning
 */
export type BadgeTone = "neutral" | "green" | "amber" | "red" | "sky" | "slate" | "orange";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-green-950/8 text-green-950",
  green: "bg-green-200 text-green-900",
  amber: "bg-amber-200 text-amber-950",
  red: "bg-red-200 text-red-900",
  sky: "bg-sky-100 text-sky-700",
  slate: "bg-slate-200 text-slate-700",
  orange: "bg-orange-100 text-orange-800"
};

export function Badge({ tone = "neutral", className = "", children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${TONES[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}
