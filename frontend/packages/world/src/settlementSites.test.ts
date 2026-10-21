import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { settlementSites } from './settlementSites.ts';
import { cornerNear, scoreAt } from './siteScore.ts';
import type { RuinPlace, Site, SiteGround } from './settlementSites.ts';
import { parseSettlements, unitsOfKm } from './settlements.ts';

const file = parseSettlements(
  readFileSync(new URL('../../../../world/settlements.json', import.meta.url), 'utf8'),
);
const WIDTH = 32_768;
const SIDE = 9;
/** A stretch of the world about 45 north, some five hundred kilometres across. */
const BOX = { fromX: 16_000, fromY: 11_500, toX: 16_600, toY: 12_100 };

/**
 * Made-up ground: farmland, the sea to the east, a lake, a small river and a large one, a sheet of ice and a range of
 * mountains, with `painted` laid over it where a test repaints.
 */
function groundOf(painted: (x: number, y: number) => string | null = () => null): SiteGround {
  return {
    classAt(x, y) {
      const over = painted(x, y);
      if (over !== null) return over;
      if (x > 16_480) return 'ocean';
      if (Math.hypot(x - 16_150, y - 11_650) < 25) return 'lake';
      if (Math.abs(x - 16_300) < 1) return 'river';
      if (Math.abs(y - 11_900) < 1) return 'river';
      if (x < 16_080 && y > 12_000) return 'ice';
      return 'farmland';
    },
    heightAt(x, y) {
      return x > 16_020 && x < 16_090 && y < 11_600
        ? ((Math.floor(x) * 7 + Math.floor(y) * 13) % 9) * 300
        : 100;
    },
    riverAt(x, y) {
      return Math.abs(y - 11_900) < 1 ? 0.9 : Math.abs(x - 16_300) < 1 ? 0.2 : 0;
    },
  };
}

const ruins: RuinPlace[] = [
  { id: 'Q90', x: 16_250, y: 11_800, reach: 30, tier: 'great' },
  { id: 'Q123', x: 16_420, y: 12_020, reach: 7, tier: 'small' },
];

const sites = settlementSites(file, groundOf(), ruins, BOX, WIDTH, SIDE);
const inside = (site: Site): boolean =>
  site.x > BOX.fromX + 80 && site.x < BOX.toX - 80 && site.y > BOX.fromY + 80 && site.y < BOX.toY - 80;

describe('where the settlements stand', () => {
  it('stands some in open country and some beside every ruin, each id once', () => {
    expect(sites.filter((site) => site.by === null).length).toBeGreaterThan(10);
    expect(sites.filter((site) => site.by === 'Q90')).toHaveLength(4);
    expect(sites.filter((site) => site.by === 'Q123')).toHaveLength(1);
    expect(new Set(sites.map((site) => site.id)).size).toBe(sites.length);
  });

  it('chooses the same sites whatever order the ruins come in', () => {
    expect(settlementSites(file, groundOf(), [...ruins].reverse(), BOX, WIDTH, SIDE)).toEqual(sites);
  });

  it('stands every middle on land a settlement can stand on, on a corner of the lattice', () => {
    const ground = groundOf();
    for (const site of sites) {
      expect(['farmland']).toContain(ground.classAt(site.x + 0.3, site.y + 0.3));
      expect(cornerNear(site.x, site.y)).toEqual({ u: site.u, v: site.v, x: site.x, y: site.y });
    }
  });

  it('stands nothing on the ice, in the mountains, or on the lake', () => {
    for (const site of sites) {
      expect(site.x < 16_080 && site.y > 12_000).toBe(false);
      expect(site.x > 16_020 && site.x < 16_090 && site.y < 11_600).toBe(false);
      expect(Math.hypot(site.x - 16_150, site.y - 11_650)).toBeGreaterThan(25);
    }
  });

  it('keeps sites in open country the spacing apart, and those by a ruin apart from each other', () => {
    const open = sites.filter((site) => site.by === null);
    for (const one of open) {
      for (const other of sites) {
        if (other !== one) {
          expect(Math.hypot(other.x - one.x, other.y - one.y)).toBeGreaterThanOrEqual(
            unitsOfKm(file.spacingKm, one.y, WIDTH) - 1,
          );
        }
      }
    }
    const beside = sites.filter((site) => site.by !== null);
    for (const one of beside) {
      for (const other of beside) {
        if (other !== one) {
          expect(Math.hypot(other.x - one.x, other.y - one.y)).toBeGreaterThanOrEqual(
            unitsOfKm(file.beside.apartKm, one.y, WIDTH) - 1,
          );
        }
      }
    }
  });

  it('stands none inside a ruin, and those beside it just past its edge', () => {
    for (const site of sites) {
      for (const ruin of ruins) {
        expect(Math.hypot(site.x - ruin.x, site.y - ruin.y)).toBeGreaterThan(ruin.reach + SIDE / 2 - 1);
      }
    }
    for (const site of sites.filter((one) => one.by === 'Q90')) {
      expect(Math.hypot(site.x - 16_250, site.y - 11_800)).toBeLessThan(
        30 + unitsOfKm(file.beside.gapKm, site.y, WIDTH) + SIDE,
      );
    }
  });

  it('makes fishing villages only where water lies about them', () => {
    const ground = groundOf();
    const wet = (site: Site): boolean => {
      for (let dx = -6; dx <= 6; dx += 1) {
        for (let dy = -6; dy <= 6; dy += 1) {
          const terrain = ground.classAt(site.x + dx, site.y + dy);
          if (
            terrain === 'ocean' ||
            terrain === 'lake' ||
            (terrain === 'river' && ground.riverAt(site.x + dx, site.y + dy) > 0.5)
          ) {
            return true;
          }
        }
      }
      return false;
    };
    const fishing = sites.filter((site) => site.type === 'fishingVillage');
    expect(fishing.length).toBeGreaterThan(0);
    expect(fishing.every(wet)).toBe(true);
    expect(sites.filter((site) => site.type === 'village' && site.x > 16_490)).toHaveLength(0);
  });

  it('moves no site more than two spacings from ground that was painted over', () => {
    const marshed = sites.find((site) => site.by === null && inside(site))!;
    const patch = (x: number, y: number): string | null =>
      Math.hypot(x - marshed.x, y - marshed.y) < 15 ? 'marsh' : null;
    const repainted = settlementSites(file, groundOf(patch), ruins, BOX, WIDTH, SIDE);
    const far = (site: Site): boolean =>
      inside(site) &&
      Math.hypot(site.x - marshed.x, site.y - marshed.y) >
        15 + 2 * unitsOfKm(file.spacingKm, site.y, WIDTH) + SIDE;
    expect(repainted.map((site) => site.id)).not.toContain(marshed.id);
    expect(repainted.filter(far)).toEqual(sites.filter(far));
    expect(repainted.filter(far).length).toBeGreaterThan(0);
    expect(repainted).not.toEqual(sites);
  });

  it('gives a town carried onto the master twice its sites once, each id once', () => {
    const twice = [...ruins, { ...ruins[1]!, x: 16_150, y: 11_560 }];
    const all = settlementSites(file, groundOf(), twice, BOX, WIDTH, SIDE);
    expect(all.filter((site) => site.by === 'Q123')).toHaveLength(1);
    expect(new Set(all.map((site) => site.id)).size).toBe(all.length);
  });

  it("keeps a ruin's sites by their ids when its town moves", () => {
    const moved = ruins.map((ruin) =>
      ruin.id === 'Q90' ? { ...ruin, x: ruin.x - 40, y: ruin.y + 20 } : ruin,
    );
    const ids = (all: Site[]): string[] => all.filter((site) => site.by === 'Q90').map((site) => site.id);
    expect(ids(settlementSites(file, groundOf(), moved, BOX, WIDTH, SIDE))).toEqual(ids(sites));
  });

  it('scores nothing where the middle is water, and less where the ground is poorer', () => {
    const sea = cornerNear(16_550, 11_800);
    expect(scoreAt(file, groundOf(), sea.u, sea.v, SIDE)).toBeNull();
    const farm = cornerNear(16_200, 11_550);
    const heath = { ...groundOf(), classAt: () => 'heath' };
    expect(scoreAt(file, groundOf(), farm.u, farm.v, SIDE)!.score).toBeGreaterThan(
      scoreAt(file, heath, farm.u, farm.v, SIDE)!.score,
    );
  });
});
