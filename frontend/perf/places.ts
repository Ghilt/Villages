/**
 * Where the shaders are measured: a screen each of one kind of ground on the default master, terrain3_mended_2026-10-03,
 * found by reading its flat class tiles at zoom 7 for the screen-sized window most of one kind (2026-10-19). Each is
 * a fixed place so a point today and a point a month ago saw the same ground; the master behind them changed last on
 * 2026-10-03, and a point before that saw other ground and says so by its master.
 */
export interface Place {
  readonly name: string;
  /** What is on the screen there, and so what it measures. */
  readonly what: string;
  readonly lat: number;
  readonly lon: number;
  readonly zoom: number;
}

export const PLACES: readonly Place[] = [
  { name: 'tundra', what: 'tundra, the heath part of the land', lat: 71.07, lon: 108.28, zoom: 10 },
  { name: 'bog', what: 'bog, the wet part of the land', lat: 67.7094, lon: 81.2988, zoom: 10 },
  { name: 'ice', what: 'the ice sheet, the ice part of the land', lat: 77.77, lon: -40.78, zoom: 10 },
  { name: 'sand', what: 'sand desert, the dunes', lat: 25.8, lon: 4.22, zoom: 10 },
  {
    name: 'grassland',
    what: 'steppe and meadow, the grass part of the land',
    lat: 45.089,
    lon: 114.4336,
    zoom: 10,
  },
  { name: 'forest', what: 'taiga, the trees and the scenery', lat: 62.1039, lon: 106.6992, zoom: 10 },
  {
    name: 'coast',
    what: 'half shallow sea, half farmland and meadow: the water and the crops',
    lat: 55.3791,
    lon: 0.7031,
    zoom: 10,
  },
  // The zoom 7 tile with the most roads and trees together, 77/39, by the bytes of its stands (2026-10-22): where the
  // real world is busiest, and where the crossing into it is measured (`zoom.ts`).
  {
    name: 'settled',
    what: 'woods and farmland dense with roads and settlements: the roads, the roadside and the worn ground',
    lat: 56.56,
    lon: 37.97,
    zoom: 10,
  },
  // Clouds are drawn only from zoom 7 out (sprites/clouds/look.ts, inFrom), and whole from 6.
  { name: 'sky', what: 'the clouds over the land, from far out', lat: 50, lon: 10, zoom: 6 },
];

/** The moment the wall clock is held at for every place, so the clouds and the wind stand the same each time. */
export const HELD_AT = Date.UTC(2026, 9, 19, 12, 0, 0);

/** The places named, in the order named, or every place when none are. */
export function placesNamed(names: readonly string[]): Place[] {
  if (names.length === 0) return [...PLACES];
  const unknown = names.filter((name) => !PLACES.some((place) => place.name === name));
  if (unknown.length > 0) {
    throw new Error(
      `no place called ${unknown.join(', ')}; the places are ${PLACES.map((p) => p.name).join(', ')}`,
    );
  }
  return names.map((name) => PLACES.find((place) => place.name === name)!);
}
