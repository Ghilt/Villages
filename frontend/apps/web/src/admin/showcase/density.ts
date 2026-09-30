import { useEffect, useState } from 'react';

/**
 * How many screen pixels this window draws for each CSS pixel, kept current.
 *
 * It changes when the browser is zoomed and when the window is dragged onto another monitor, and it is
 * the number a nine-slice border's seams depend on: at 1.25 and 1.5, which is what Windows' own scaling
 * gives, an edge's repeats fall between screen pixels. The page says it so that a picture of a seam can be
 * read with the density it was taken at.
 */
export function useDensity(): number {
  const [density, setDensity] = useState(() => window.devicePixelRatio);
  useEffect(() => {
    // A media query for the density there is now fires once when it stops being true, whichever way the
    // density moved; the next one is asked for when this effect runs again with the new value.
    const now = matchMedia(`(resolution: ${density}dppx)`);
    const moved = () => setDensity(window.devicePixelRatio);
    now.addEventListener('change', moved);
    return () => now.removeEventListener('change', moved);
  }, [density]);
  return density;
}
