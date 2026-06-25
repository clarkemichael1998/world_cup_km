"use client";

import { useState } from "react";
import { LegendSilhouette } from "@/components/LegendSilhouette";

// Tries the real photo at imagePath first (drop a file under /public to use
// it — see lib/cupLegends.ts). Falls back to the faceless pictogram
// silhouette automatically if no file exists yet, so nothing breaks today.
// `className` should only carry position/size (e.g. "absolute -bottom-2
// -right-4 h-32 w-24") — opacity is handled internally so the silhouette
// fallback stays subtle while a real photo, once added, renders at full
// strength.
export function LegendPortrait({
  imagePath,
  shirtNumber,
  alt,
  className = "",
  silhouetteOpacity = "opacity-40"
}: {
  imagePath: string;
  shirtNumber: number;
  alt: string;
  className?: string;
  silhouetteOpacity?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) return <LegendSilhouette shirtNumber={shirtNumber} className={`${className} ${silhouetteOpacity}`} />;

  return <img src={imagePath} alt={alt} className={`${className} object-cover`} onError={() => setFailed(true)} />;
}
