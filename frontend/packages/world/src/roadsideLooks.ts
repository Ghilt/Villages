import { BRIDGE_WAYS } from './bridgeModel.ts';
import type { BridgeWay } from './bridgeModel.ts';
import { WALL_STYLES } from './wallModel.ts';
import type { WallStyle } from './wallModel.ts';

/*
 * The roadside: what stands along either side of a road, chosen by the biome under it so that it fits in. Low walls of
 * dry stone where people farmed - mossy in the green and wet country, bare and pale in the dry - for a share of a
 * road's length, in runs; and between them the biome's own small growth, the scenery's tufts of grass, heather, ferns,
 * scrub, boulders and cacti, smaller than they grow in the open. The walls are pictures of their own,
 * `world/sprites/roadside/wall-<style>-<way>.png`, modelled in 3D (`wallModel.ts`) and cut into the settlements' atlas;
 * the growth is the scenery's own pictures. Matters of taste, to be tuned by eye. See
 * docs/plans/houses-bridges-and-road-render.md.
 */

/** What lines a road in a biome: its walls' style or none, the share of its length walled, and its growth by weight. */
export interface RoadsideLook {
  readonly wall: WallStyle | null;
  readonly walled: number;
  readonly growth: Readonly<Record<string, number>>;
}

/** How a road is lined in each biome of `world/biomes.json`, by its name; a biome not named is lined as `none`. */
export const ROADSIDE: Readonly<Record<string, RoadsideLook>> = {
  oceanic: { wall: 'mossy', walled: 0.45, growth: { grass: 4, fern: 2, boulder: 1 } },
  temperate: { wall: 'mossy', walled: 0.35, growth: { grass: 5, fern: 1, scrub: 1, boulder: 1 } },
  'northern-woods': { wall: 'mossy', walled: 0.25, growth: { fern: 3, grass: 3, boulder: 1 } },
  'boreal-dense': { wall: null, walled: 0, growth: { fern: 3, boulder: 2, grass: 2 } },
  'boreal-open': { wall: null, walled: 0, growth: { fern: 2, boulder: 2, grass: 3 } },
  'northern-heath': { wall: 'bare', walled: 0.3, growth: { heather: 4, boulder: 2, grass: 1 } },
  highland: { wall: 'bare', walled: 0.35, growth: { boulder: 3, heather: 2, grass: 2 } },
  arctic: { wall: null, walled: 0, growth: { boulder: 3 } },
  mediterranean: { wall: 'bare', walled: 0.4, growth: { scrub: 3, grass: 2, boulder: 1 } },
  steppe: { wall: 'bare', walled: 0.1, growth: { grass: 5, scrub: 1 } },
  'desert-margin': { wall: 'bare', walled: 0.15, growth: { scrub: 2, boulder: 2, cactus: 1 } },
  savanna: { wall: null, walled: 0, growth: { grass: 4, scrub: 2 } },
  monsoon: { wall: null, walled: 0, growth: { fern: 3, grass: 3, scrub: 1 } },
  tropical: { wall: null, walled: 0, growth: { fern: 3, grass: 2, scrub: 2 } },
  none: { wall: 'mossy', walled: 0.2, growth: { grass: 3, boulder: 1 } },
};

/** How much smaller the roadside's growth is than the same kind growing in the open. */
export const ROADSIDE_GROWTH_SCALE = 0.45;

/** The look of a road in a biome, by its name. */
export function roadsideOf(biome: string): RoadsideLook {
  return ROADSIDE[biome] ?? ROADSIDE['none']!;
}

/** The file a wall's picture is in: `wall-mossy-u.png`. */
export function wallFile(style: WallStyle, way: BridgeWay): string {
  return `wall-${style}-${way}.png`;
}

/** The name the map asks the settlements' atlas for a wall's picture by: `roadside:wall-mossy-u`. */
export function wallKey(style: WallStyle, way: BridgeWay): string {
  return `roadside:wall-${style}-${way}`;
}

/** The key of a picture in `world/sprites/roadside/`, or null for a file that is not one. */
export function keyOfRoadsideFile(file: string): string | null {
  for (const style of WALL_STYLES) {
    for (const way of BRIDGE_WAYS) if (file === wallFile(style, way)) return wallKey(style, way);
  }
  return null;
}
