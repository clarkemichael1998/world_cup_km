export function BrandCrest({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="kmxi-crest" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#16a34a" />
          <stop offset="1" stopColor="#14532d" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#kmxi-crest)" />
      <rect x="2.75" y="2.75" width="42.5" height="42.5" rx="12.25" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
      {/* pitch markings */}
      <circle cx="24" cy="24" r="9.5" stroke="white" strokeOpacity="0.22" strokeWidth="1.4" />
      <line x1="24" y1="4" x2="24" y2="44" stroke="white" strokeOpacity="0.14" strokeWidth="1.4" />
      {/* gold ball accent */}
      <circle cx="37" cy="11" r="3" fill="#facc15" />
      {/* wordmark */}
      <text x="24" y="29.5" textAnchor="middle" fontSize="15" fontWeight="900" letterSpacing="0.5" fill="white" fontFamily="system-ui, sans-serif">XI</text>
    </svg>
  );
}

export function BrandLogo({ variant = "hero" }: { variant?: "hero" | "nav" }) {
  if (variant === "nav") {
    return (
      <span className="flex items-center gap-2">
        <BrandCrest className="h-7 w-7" />
        <span className="bg-gradient-to-br from-white via-amber-100 to-emerald-200 bg-clip-text text-xl font-black tracking-tight text-transparent drop-shadow-sm">KMXI</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      <BrandCrest className="h-11 w-11 shrink-0 drop-shadow-sm sm:h-14 sm:w-14" />
      <div className="leading-none">
        <span className="block bg-gradient-to-br from-white via-amber-100 to-emerald-200 bg-clip-text text-4xl font-black tracking-tight text-transparent drop-shadow-sm sm:text-5xl">KMXI</span>
        <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.3em] text-white/55 sm:mt-1.5 sm:text-[10px] sm:tracking-[0.32em]">World Cup 2026</span>
      </div>
    </div>
  );
}
