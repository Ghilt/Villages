import { WATER_LOOK } from '../water/look';
import { carried, latticeNear } from './clouds/cloudClock';

/**
 * The world's one wind, as everything that bends in it takes it: which way it blows, the sea's, and the gusts
 * that travel down it, the same for the grass and the trees, so a gust that crosses a meadow goes on into the
 * wood. The gusts are carried by the wall clock as the clouds are (`clouds/cloudClock.ts`), so every browser has
 * the same gust at the same place at the same moment: the scenery is the same for every player, moving too.
 *
 * The gusts are noise laid along the wind that comes round once every `CLOUD_PERIOD` world units along it, so how
 * far the wind has carried them since 1970, worked out here in full precision and handed over modulo that, never
 * jumps. A shader takes `GUSTS_GLSL` and two uniforms from here: `gustsCarried` and `windTime`.
 */
export const WIND_LOOK = {
  /** The way it blows, in degrees from east towards south: the sea's, so the waves and the gusts agree. */
  towards: WATER_LOOK.realistic.waves.wind,
  gusts: {
    /** How big a gust is, in world units, and how fast it travels down the wind, in world units a second. */
    size: 9,
    speed: 2.2,
  },
} as const;

const round = (WIND_LOOK.towards * Math.PI) / 180;

/** One world unit down the wind, east and south as world units run. */
export const DOWN_WIND = { east: Math.cos(round), south: Math.sin(round) } as const;

/** The two sizes of noise a gust is made of: the gust, and the flurries inside it. */
const GUST = latticeNear(WIND_LOOK.gusts.size);
const FLURRY = latticeNear(WIND_LOOK.gusts.size * 0.4);

/** How far the wind has carried the gusts at `nowMs` of the wall clock, modulo the period they come round at. */
export function gustsCarried(nowMs: number): number {
  return carried(nowMs, WIND_LOOK.gusts.speed);
}

/**
 * The wall clock's seconds modulo an hour, for what sways back and forth on its own: a motion of so many turns a
 * second comes round with it without a jump when that number times 3600 is whole.
 */
export function windTime(nowMs: number): number {
  const seconds = (nowMs / 1000) % 3600;
  return seconds < 0 ? seconds + 3600 : seconds;
}

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));

/**
 * The gusts, for a shader of either kind: `WIND` and `WIND_ACROSS`, one world unit down the wind and across it;
 * `windHash`, a number from nought to one for a cell and a salt; and `gustAt(world, carried)`, how hard the wind
 * blows at a place of the world, nought to one, given how far `gustsCarried` says it has carried the gusts.
 */
export const GUSTS_GLSL = `
const vec2 WIND = vec2(${float(DOWN_WIND.east)}, ${float(DOWN_WIND.south)});
const vec2 WIND_ACROSS = vec2(${float(-DOWN_WIND.south)}, ${float(DOWN_WIND.east)});
const float GUST_CELL = ${float(GUST.cell)};
const float GUST_AROUND = ${float(GUST.around)};
const float FLURRY_CELL = ${float(FLURRY.cell)};
const float FLURRY_AROUND = ${float(FLURRY.around)};

float windHash(ivec2 cell, int salt) {
  uvec3 u = uvec3(ivec3(cell, salt)) * uvec3(1597334673u, 3812015801u, 2798796415u);
  uint n = (u.x ^ u.y ^ u.z) * 1597334673u;
  n ^= n >> 16u;
  n *= 2246822519u;
  n ^= n >> 13u;
  return float(n) / 4294967296.0;
}

// Smooth noise, nought to one, on a lattice that comes round every \`around\` cells along the wind.
float windNoise(vec2 at, float around, int salt) {
  vec2 whole = floor(at);
  vec2 part = at - whole;
  vec2 w = part * part * (3.0 - 2.0 * part);
  int x0 = int(mod(whole.x, around));
  int x1 = int(mod(whole.x + 1.0, around));
  int y0 = int(whole.y);
  return mix(
    mix(windHash(ivec2(x0, y0), salt), windHash(ivec2(x1, y0), salt), w.x),
    mix(windHash(ivec2(x0, y0 + 1), salt), windHash(ivec2(x1, y0 + 1), salt), w.x),
    w.y
  );
}

// How hard the wind is blowing here, nought to one: gusts that travel down the wind.
float gustAt(vec2 world, float carried) {
  vec2 wind = vec2(dot(world, WIND) - carried, dot(world, WIND_ACROSS));
  float gust = windNoise(wind / GUST_CELL, GUST_AROUND, 101);
  float flurry = windNoise(wind / FLURRY_CELL, FLURRY_AROUND, 102);
  return smoothstep(0.42, 0.8, gust * 0.65 + flurry * 0.35);
}
`;
