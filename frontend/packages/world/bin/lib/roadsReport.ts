import { ROAD_KINDS } from '../../src/roadRecords.ts';
import type { Chain } from '../../src/roads/network.ts';
import { fromWorld } from '../../src/sphere.ts';

/*
 * What `world:roads` made, in numbers for the hand-over: how much road of each grade, the bridges of each kind on each
 * axis, and the settlements no road reaches and why. See docs/plans/settlements-and-roads.md.
 */

export interface RoadsMade {
  readonly chains: readonly Chain[];
  readonly settlements: readonly { id: string; name: string }[];
  /** The places some road reaches, and the ones any join was made for at all. */
  readonly reached: ReadonlySet<string>;
  readonly joined: ReadonlySet<string>;
  readonly longestKm: number;
  readonly stoneFrom: number;
  readonly kmPerUnit: (y: number) => number;
  /** The world's side in units, for where on the map a bridge is. */
  readonly width: number;
  /** Where the examples of each bridge are looked for nearest: a town, Dantzic unless told. */
  readonly near: { x: number; y: number };
  readonly say: (line: string) => void;
}

export function reportRoads(made: RoadsMade): void {
  const { chains, say, kmPerUnit } = made;
  const kmOf = (chain: Chain) =>
    chain.points.slice(1).reduce((sum, point, at) => {
      const from = chain.points[at]!;
      return sum + Math.hypot(point.x - from.x, point.y - from.y) * kmPerUnit((point.y + from.y) / 2);
    }, 0);
  const km = new Map<string, number>();
  for (const chain of chains) {
    const name = chain.bridge === null ? chain.grade : 'bridge';
    km.set(name, (km.get(name) ?? 0) + kmOf(chain));
  }
  say(
    `${Math.round([...km.values()].reduce((a, b) => a + b, 0)).toLocaleString()} km of road: ` +
      ROAD_KINDS.map((grade) => `${Math.round(km.get(grade) ?? 0).toLocaleString()} km of ${grade}`).join(
        ', ',
      ),
  );
  const bridges = chains.filter((chain) => chain.bridge !== null);
  const counted = new Map<string, number>();
  for (const chain of bridges) {
    const name = `${chain.bridge!.span >= made.stoneFrom ? 'stone' : 'timber'} ${chain.bridge!.axis}`;
    counted.set(name, (counted.get(name) ?? 0) + 1);
  }
  say(
    `${bridges.length.toLocaleString()} bridges: ${[...counted]
      .sort()
      .map(([name, count]) => `${count} ${name}`)
      .join(', ')}`,
  );
  // One of each kind on each axis, the nearest the town, where the map can be opened on it: a bridge reads the same
  // from either end, so four axes are its eight directions.
  const nearest = new Map<string, { away: number; x: number; y: number }>();
  for (const chain of bridges) {
    const name = `${chain.bridge!.span >= made.stoneFrom ? 'stone' : 'timber'} ${chain.bridge!.axis}`;
    const [a, b] = chain.points as [{ x: number; y: number }, { x: number; y: number }];
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const away = Math.hypot(x - made.near.x, y - made.near.y);
    if (away < (nearest.get(name)?.away ?? Infinity)) nearest.set(name, { away, x, y });
  }
  const examples = new Map(
    [...nearest].map(([name, { x, y }]) => {
      const { lng, lat } = fromWorld(x, y, made.width);
      return [name, `?at=${lat.toFixed(4)},${lng.toFixed(4)}&zoom=11`];
    }),
  );
  say(
    `a bridge of each: ${[...examples]
      .sort()
      .map(([name, at]) => `${name} ${at}`)
      .join('; ')}`,
  );
  const lonely = made.settlements.filter((place) => !made.reached.has(place.id));
  const alone = lonely.filter((place) => !made.joined.has(place.id)).length;
  say(
    `${lonely.length.toLocaleString()} settlements no road reaches: ${alone.toLocaleString()} with no place within ` +
      `${made.longestKm} km, the others every road from them barred` +
      (lonely.length === 0
        ? ''
        : `, among them ${lonely
            .slice(0, 6)
            .map((one) => one.name)
            .join('; ')}`),
  );
}
