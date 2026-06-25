"use client";

import { useState } from "react";
import { LegendSilhouette } from "@/components/LegendSilhouette";

// Tries the real photo at imagePath first (drop a file under /public to use
// it — see lib/cupLegends.ts). Falls back to the faceless pictogram
// silhouette automatically if no file exists yet, so nothing breaks today.
// `className` should only carry position/size (e.g. "absolute -bottom-2
// -right-4 h-32 w-24") — rounding/ring/shadow are applied on a stable outer
// wrapper so a real photo and the silhouette fallback always look framed
// the same way, rather than a hard-edged rectangle dropped on the gradient.
export function LegendPortrait({
  imagePath,
  shirtNumber,
  alt,
  className = "",
  silhouetteOpacity = "opacity-40",
  rounded = "rounded-2xl"
}: {
  imagePath: string;
  shirtNumber: number;
  alt: string;
  className?: string;
  silhouetteOpacity?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`${className} ${rounded} overflow-hidden ring-2 ring-white/30 shadow-lg`}>
      {failed ? (
        <LegendSilhouette shirtNumber={shirtNumber} className={`h-full w-full ${silhouetteOpacity}`} />
      ) : (
        <img src={imagePath} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
