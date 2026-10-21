import { describe, expect, it } from 'vitest';

import { BRIDGEABLE, RIVER, WATER } from './course.ts';
import type { CourseGround, Point } from './course.ts';
import { placesJoined } from './graph.ts';
import type { RoadPlace } from './graph.ts';
import { networkOf, routeJoins } from './network.ts';
import type { Chain, NetworkRules, RoadEnd } from './network.ts';
import { clearOver } from './shape.ts';

const RULES: NetworkRules = {
  climb: 0.01,
  bridge: 2,
  bridgeAt: 4,
  longestSpan: 4,
  trunk: 0.5,
  margin: 12,
  straightest: 6,
  smoothing: 2,
  grades: [2, 3],
  approach: 1.5,
};

/** A country of lakes and one river small enough to bridge, running north to south at x 60. */
function paint(x: number, y: number): string {
  if (x === 60 || x === 61) return 'r';
  const lakes = [
    [30, 30, 7],
    [85, 50, 9],
    [40, 75, 6],
    [100, 95, 8],
  ] as const;
  return lakes.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r) ? '~' : '.';
}
const ground: Omit<CourseGround, 'road'> = {
  cost: (x, y) => {
    const at = paint(x, y);
    return at === '~' ? WATER : at === 'r' ? BRIDGEABLE : 1;
  },
  height: (x, y) => Math.sin(x / 9) * 40 + Math.cos(y / 7) * 30,
  barred: () => false,
};
const clear = clearOver(ground.cost, ground.barred);

const PLACES: RoadPlace[] = [
  ['a', 10, 10],
  ['b', 20, 55],
  ['c', 45, 50],
  ['d', 75, 15],
  ['e', 80, 80],
  ['f', 110, 60],
  ['g', 15, 100],
  ['h', 60.5, 110],
  ['r', 115, 20],
].map(([id, x, y]) => ({
  id: id as string,
  kind: id === 'r' ? 'ruin' : 'settlement',
  x: x as number,
  y: y as number,
}));

const endsOf =
  (places: readonly RoadPlace[]) =>
  (id: string): RoadEnd[] => {
    const place = places.find((one) => one.id === id)!;
    return [{ x: place.x + 0.5, y: place.y + 0.5 }];
  };

function network(places: readonly RoadPlace[]): Chain[] {
  const joins = placesJoined(places, 60, () => 1);
  const { courses } = routeJoins(joins, endsOf(places), ground, RULES);
  return networkOf(courses, clear, RULES);
}

describe('the roads as a network', () => {
  const chains = network(PLACES);

  it('is shaped with every line of it over land, but its bridges', () => {
    expect(chains.length).toBeGreaterThan(5);
    for (const chain of chains) {
      if (chain.bridge !== null) continue;
      for (let at = 0; at + 1 < chain.points.length; at += 1) {
        expect(clear(chain.points[at]!, chain.points[at + 1]!)).toBe(true);
      }
    }
  });

  it('crosses the river on bridges, each met head on by the road on either bank', () => {
    const bridges = chains.filter((chain) => chain.bridge !== null);
    expect(bridges.length).toBeGreaterThan(0);
    for (const bridge of bridges) {
      const [a, b] = bridge.points as [Point, Point];
      const ux = (b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y);
      const uy = (b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y);
      for (const end of [a, b]) {
        const meeting = chains.find(
          (chain) =>
            chain !== bridge &&
            chain.bridge === null &&
            [chain.points[0]!, chain.points[chain.points.length - 1]!].some(
              (p) => p.x === end.x && p.y === end.y,
            ),
        );
        expect(meeting).toBeDefined();
        const points = meeting!.points;
        const next =
          points[0]!.x === end.x && points[0]!.y === end.y ? points[1]! : points[points.length - 2]!;
        const along = Math.abs(
          ((next.x - end.x) * ux + (next.y - end.y) * uy) / Math.hypot(next.x - end.x, next.y - end.y),
        );
        expect(along).toBeGreaterThan(0.97);
      }
    }
  });

  it('grades a stretch many roads share above a track: a bridge two roads must both cross', () => {
    // The river can be bridged at one place only, so the roads from both western places to the east cross there.
    const funnel: Omit<CourseGround, 'road'> = {
      cost: (x, y) => (x === 60 || x === 61 ? (y >= 50 && y < 58 ? BRIDGEABLE : RIVER) : 1),
      height: () => 0,
      barred: () => false,
    };
    const corners: RoadPlace[] = [
      { id: 'nw', kind: 'settlement', x: 20, y: 35 },
      { id: 'sw', kind: 'settlement', x: 20, y: 70 },
      { id: 'ne', kind: 'settlement', x: 100, y: 35 },
      { id: 'se', kind: 'settlement', x: 100, y: 70 },
    ];
    const joins = placesJoined(corners, 100, () => 1);
    const { courses, unreached } = routeJoins(joins, endsOf(corners), funnel, RULES);
    expect(unreached).toEqual([]);
    const shared = networkOf(courses, clearOver(funnel.cost, funnel.barred), RULES);
    const bridges = shared.filter((chain) => chain.bridge !== null);
    expect(bridges).toHaveLength(1);
    expect(bridges[0]!.grade).toBe('road');
    expect(shared.some((chain) => chain.bridge === null && chain.grade === 'road')).toBe(true);
    expect(shared.some((chain) => chain.grade === 'track')).toBe(true);
  });

  it('is the same network whatever order the places come in', () => {
    const shuffled = [...PLACES].sort(
      (a, b) => ((a.id.charCodeAt(0) * 7) % 11) - ((b.id.charCodeAt(0) * 7) % 11),
    );
    expect(network(shuffled)).toEqual(chains);
  });

  it('lays every point on the quarter of a unit', () => {
    for (const chain of chains) {
      for (const point of chain.points) {
        expect(point.x * 4).toBe(Math.round(point.x * 4));
        expect(point.y * 4).toBe(Math.round(point.y * 4));
      }
    }
  });
});
