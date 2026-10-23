/**
 * A challenge's slice as a catalogue writes it, the way the challenges page's draft does: an opponent's in a quest's
 * challenge node, and the starting slices every house holds. Strict as the server's reader is, through whoever reads
 * the file it is in. See decision record 0107, amended.
 */

/** What stands in a slot of a slice: a key figure lending a stat, or a building of a level. */
export type CatalogueStandIn =
  | { readonly kind: 'keyFigure'; readonly name: string; readonly stats: Readonly<Record<string, number>> }
  | { readonly kind: 'building'; readonly name: string; readonly level: number };

/** A slice: its aspect, its power, integrity and summon count, its effects by their ids, and what is in its slots. */
export interface CatalogueSlice {
  readonly aspect: string;
  readonly power: number;
  readonly integrity: number;
  readonly summonCount: number;
  readonly effects: readonly string[];
  readonly slotted: Readonly<Record<string, CatalogueStandIn>>;
}

type Node = Record<string, unknown>;

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The slice written at `at`, or `refuse` naming the first field of it that cannot be read. */
export function parseSlice(node: unknown, at: string, refuse: (at: string) => never): CatalogueSlice {
  if (!isObject(node)) return refuse(at);
  const string = (from: Node, field: string, where: string) =>
    typeof from[field] === 'string' ? (from[field] as string) : refuse(`${where}.${field}`);
  const number = (field: string) =>
    typeof node[field] === 'number' ? (node[field] as number) : refuse(`${at}.${field}`);
  const whole = (from: Node, field: string, where: string) =>
    Number.isInteger(from[field]) ? (from[field] as number) : refuse(`${where}.${field}`);
  const standInOf = (one: unknown, where: string): CatalogueStandIn => {
    if (!isObject(one)) return refuse(where);
    const name = string(one, 'name', where);
    if (one.kind === 'keyFigure') {
      const { stats } = one;
      if (!isObject(stats) || !Object.values(stats).every((value) => Number.isInteger(value)))
        refuse(`${where}.stats`);
      return { kind: 'keyFigure', name, stats: stats as Record<string, number> };
    }
    if (one.kind === 'building') return { kind: 'building', name, level: whole(one, 'level', where) };
    return refuse(`${where}.kind`);
  };
  const { effects, slotted } = node;
  if (!Array.isArray(effects) || !effects.every((one) => typeof one === 'string')) refuse(`${at}.effects`);
  if (slotted !== undefined && !isObject(slotted)) refuse(`${at}.slotted`);
  return {
    aspect: string(node, 'aspect', at),
    power: number('power'),
    integrity: number('integrity'),
    summonCount: whole(node, 'summonCount', at),
    effects: effects as string[],
    slotted: Object.fromEntries(
      Object.entries((slotted ?? {}) as Node).map(([effect, one]) => [
        effect,
        standInOf(one, `${at}.slotted.${effect}`),
      ]),
    ),
  };
}
