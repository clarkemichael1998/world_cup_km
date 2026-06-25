// A faceless, pictogram-style football figure (in the spirit of Olympic
// sport pictograms) — deliberately generic rather than a likeness of any
// real person. Carries the cup's iconic shirt number like a trading card.
export function LegendSilhouette({ shirtNumber, className = "" }: { shirtNumber: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 150" className={className} aria-hidden="true">
      <g fill="#ffffff" opacity="0.92">
        {/* head */}
        <circle cx="52" cy="20" r="11" />
        {/* torso, leaning into the strike */}
        <path d="M44 30 Q40 55 46 78 L62 78 Q66 50 58 30 Z" />
        {/* standing leg */}
        <path d="M47 76 L42 128 L52 128 L56 80 Z" />
        {/* kicking leg, swung forward */}
        <path d="M58 76 L82 96 L90 88 L78 76 Q70 70 58 76 Z" />
        {/* arms for balance */}
        <path d="M45 36 L22 46 L25 54 L48 46 Z" />
        <path d="M58 36 L74 28 L78 36 L60 44 Z" />
        {/* ball */}
        <circle cx="92" cy="98" r="7" opacity="0.85" />
      </g>
      <g>
        <circle cx="52" cy="58" r="13" fill="rgba(0,0,0,0.28)" />
        <text x="52" y="63" textAnchor="middle" fontSize="14" fontWeight="900" fill="#ffffff">
          {shirtNumber}
        </text>
      </g>
    </svg>
  );
}
