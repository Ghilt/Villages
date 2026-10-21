import { describe, expect, it } from 'vitest';

import type { RoadPlace } from './graph.ts';
import { Networks, lonelyOffers } from './lonely.ts';

const village = (id: string, x: number, y: number): RoadPlace => ({ id, kind: 'settlement', x, y });
const ruin = (id: string, x: number, y: number): RoadPlace => ({ id, kind: 'ruin', x, y });
const flat = () => 1;

describe('the villages the roads leave alone', () => {
  it('are those with no other village in their network, a ruin not counting', () => {
    const places = [village('a', 0, 0), village('b', 10, 0), village('c', 100, 0), ruin('r', 105, 0)];
    const networks = new Networks(places);
    networks.join('a', 'b');
    networks.join('c', 'r');
    expect(networks.joinedToAnother('a')).toBe(true);
    expect(networks.joinedToAnother('c')).toBe(false);
    // Through a ruin, two villages are in one network.
    networks.join('r', 'b');
    expect(networks.joinedToAnother('c')).toBe(true);
  });

  it('are offered the nearest villages outside their own network within the far limit, nearest first', () => {
    const places = [
      village('lone', 0, 0),
      village('near', 30, 0),
      village('nearer', 20, 0),
      village('far', 500, 0),
      village('pair1', 40, 40),
      village('pair2', 41, 40),
    ];
    const networks = new Networks(places);
    networks.join('pair1', 'pair2');
    networks.join('near', 'nearer');
    const offered = lonelyOffers(places, networks, 100, 2, flat);
    expect(offered.map((one) => one.id)).toEqual(['lone']);
    expect(offered[0]!.offers.map((offer) => offer.b)).toEqual(['nearer', 'near']);
  });

  it('are offered nothing when no village lies within the far limit', () => {
    const places = [village('island', 0, 0), village('mainland', 300, 0)];
    expect(lonelyOffers(places, new Networks(places), 100, 4, flat).map((one) => one.id)).toEqual([]);
  });

  it('come the nearest offer first, the same in any order', () => {
    const places = [village('x', 0, 0), village('y', 50, 0), village('z', 1000, 0), village('w', 1080, 0)];
    const one = lonelyOffers(places, new Networks(places), 200, 1, flat);
    const other = lonelyOffers([...places].reverse(), new Networks([...places].reverse()), 200, 1, flat);
    expect(one).toEqual(other);
    expect(one.map((offer) => offer.id)).toEqual(['x', 'y', 'w', 'z']);
  });
});
