// Decorative, wordless motifs per cup — inspired by each legend's nation
// (flag shapes, light, movement) rather than literal portraits or captions.
// Shared between the Cups page, themed PlayerCards, and the sticker album grid.
export function CupMotif({ cupId, className }: { cupId: number; className: string }) {
  switch (cupId) {
    case 1:
      return <LarssonMotif className={className} />;
    case 2:
      return <DalglishMotif className={className} />;
    case 3:
      return <MaradonaMotif className={className} />;
    case 4:
      return <PeleMotif className={className} />;
    default:
      return null;
  }
}

// Sweden / Larsson — braided gold arcs sweeping like a striker's run, plus
// cold floodlight beams fanning from the corner.
function LarssonMotif({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#fde68a" strokeWidth="2" opacity="0.28">
        <line x1="200" y1="0" x2="40" y2="200" />
        <line x1="200" y1="0" x2="90" y2="200" />
        <line x1="200" y1="0" x2="140" y2="200" />
        <line x1="200" y1="0" x2="190" y2="200" />
      </g>
      <g fill="none" stroke="#fde68a" strokeWidth="4" opacity="0.55" strokeLinecap="round">
        <path d="M -20 165 Q 100 95 220 165" />
        <path d="M -20 195 Q 100 125 220 195" />
      </g>
      <circle cx="34" cy="40" r="3" fill="#fde68a" opacity="0.7" />
    </svg>
  );
}

// Scotland / Dalglish — a fragmented saltire (the diagonal cross of the
// Scottish flag), broken into shards rather than a solid flag graphic.
function DalglishMotif({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#ffffff" strokeWidth="11" strokeLinecap="square" opacity="0.32" strokeDasharray="20 12">
        <line x1="-20" y1="-20" x2="220" y2="220" />
        <line x1="220" y1="-20" x2="-20" y2="220" />
      </g>
      <g stroke="#cfe0ff" strokeWidth="5" strokeLinecap="square" opacity="0.4" strokeDasharray="8 26">
        <line x1="-20" y1="-20" x2="220" y2="220" />
        <line x1="220" y1="-20" x2="-20" y2="220" />
      </g>
    </svg>
  );
}

// Argentina / Maradona — a sunburst halo fanning from the corner over the
// sky-blue-and-white stripes of the national shirt.
function MaradonaMotif({ className }: { className: string }) {
  const rays = [10, 28, 46, 64, 82, 100, 118, 136];
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g opacity="0.16" fill="#ffffff">
        <rect x="0" y="34" width="200" height="16" />
        <rect x="0" y="84" width="200" height="16" />
        <rect x="0" y="134" width="200" height="16" />
      </g>
      <g stroke="#fff7d6" strokeWidth="2.5" opacity="0.4">
        {rays.map((angle) => {
          const radians = (angle * Math.PI) / 180;
          const x2 = 220 * Math.cos(radians);
          const y2 = 220 - 220 * Math.sin(radians);
          return <line key={angle} x1="0" y1="200" x2={x2} y2={y2} />;
        })}
      </g>
    </svg>
  );
}

// Brazil / Pele — rolling samba waves with small gold flare bursts, in the
// green/gold/blue of the shirt.
function PeleMotif({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="#ffffff" strokeWidth="3.5" opacity="0.3" strokeLinecap="round">
        <path d="M -20 60 Q 30 35 80 60 T 220 60" />
        <path d="M -20 105 Q 30 80 80 105 T 220 105" />
        <path d="M -20 150 Q 30 125 80 150 T 220 150" />
      </g>
      <g fill="#fde68a" opacity="0.75">
        <path d="M42 26 L46 38 L58 42 L46 46 L42 58 L38 46 L26 42 L38 38 Z" />
        <path d="M162 152 L165 161 L174 164 L165 167 L162 176 L159 167 L150 164 L159 161 Z" />
      </g>
    </svg>
  );
}
