/** Which way a figure on the field is turned: toward the east or the west, and never away from the eye. */
export type Facing = 'east' | 'west';

/** What a figure on the field is: one of a side's summons, a key figure, or one of the townsfolk. */
export type FigureKind = 'summon' | 'keyFigure' | 'townsperson';

/** What a figure pulled in a second, as it rises over its head: `+7.5`, `−12`. */
export function pullSaid(amount: number): string {
  const shown = Math.round(Math.abs(amount) * 10) / 10;
  return `${amount < 0 ? '−' : '+'}${shown}`;
}
