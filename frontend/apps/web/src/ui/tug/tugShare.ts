/**
 * The tug as a share: how much of the bar is the first side's, out of a hundred. At +100 the bar is all theirs, at
 * -100 all the other's, and even is half each, so a share drawn on a bar, a crowd or a field moves the same way.
 */
export function shareOf(tug: number): number {
  return (Math.max(-100, Math.min(100, tug)) + 100) / 2;
}

/** The tug in words, toward whichever side it leans: `28.3 toward Varga`, or `even`. */
export function towardSaid(tug: number, first: string, second: string): string {
  const shown = Math.round(Math.abs(tug) * 10) / 10;
  if (shown === 0) {
    return 'even';
  }
  return `${shown} toward ${tug > 0 ? first : second}`;
}
