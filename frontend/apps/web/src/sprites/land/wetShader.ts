import { latticeNear } from '../clouds/cloudClock';

import { channelOf } from './landMask';
import { LAND_LOOK } from './look';

/**
 * The wet land, a motion of the land: a part of the land shader, `landShader.ts`, which asks `wetHere` for it wherever
 * the land under a pixel is marsh, bog, paddy, floodplain, mangrove or swamp forest.
 *
 * Open water lies among the growth where a slow pattern over the ground is high, dark, catching the light in glints
 * where the wind ruffles it - the gusts' own ripples, carried by the wall clock - and now and then a ring spreads on
 * it, at a place and a moment a cell of the ground and a slot of the clock draw. Stems stand in it: reeds in clumps
 * in the marsh, tufts on the floodplain, shoots in rows in the paddy's terraces, each a stroke bending with the gusts.
 * Over the marsh and the bog mist lies in low banks drifting down the wind, thin enough to see through. How much of
 * each a kind has is its own look, blended between the world units about a pixel so nothing steps at a texel's edge;
 * every number is in `look.ts`, under `wet`, and the sliders' in `wetTuning.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => `vec3(${rgb.map(float).join(', ')})`;

const W = LAND_LOOK.wet;
const KINDS = Object.values(W.kinds);
const P = W.pools;
const R = W.rings;
const S = W.stems;
const M = W.mist;
/** The ripples' lattice, which comes round with the world's width as the gusts' does, so they never jump. */
const RIPPLES = latticeNear(P.ripple);

const floats = (pick: (kind: (typeof KINDS)[number]) => number): string =>
  `float[${KINDS.length}](${KINDS.map((kind) => float(pick(kind))).join(', ')})`;
const colours = (pick: (kind: (typeof KINDS)[number]) => readonly number[]): string =>
  `vec3[${KINDS.length}](${KINDS.map((kind) => colour(pick(kind))).join(', ')})`;

export const WET_GLSL = `
// How the wet land looks, from the sliders: wetTuning.ts says what each is.
uniform float uMist;
uniform float uPools;
uniform float uRings;
uniform float uStems;
// The mist's lattice, its cell along the wind and how many cells it comes round after, and how far it has drifted.
uniform vec2 uMistLattice;
uniform float uMistCarried;

const int WET = ${channelOf('wet')};
const int WET_LOOKS = ${KINDS.length};
const float WET_POOLS[WET_LOOKS] = ${floats((kind) => kind.pools)};
const vec3 WET_WATER[WET_LOOKS] = ${colours((kind) => kind.water)};
const float WET_STEMS[WET_LOOKS] = ${floats((kind) => kind.stems)};
const float WET_TALL[WET_LOOKS] = ${floats((kind) => kind.tall)};
const float WET_ROWS[WET_LOOKS] = ${floats((kind) => kind.rows)};
const vec3 WET_ROOT[WET_LOOKS] = ${colours((kind) => kind.root)};
const vec3 WET_TIP[WET_LOOKS] = ${colours((kind) => kind.tip)};
const float WET_MIST[WET_LOOKS] = ${floats((kind) => kind.mist)};
const float POOL_SIZE = ${float(P.size)};
const float POOL_ALPHA = ${float(P.opacity)};
const float POOL_SOFT = ${float(P.soft)};
const vec3 GLINT = ${colour(P.glint)};
const float GLINT_ALPHA = ${float(P.glintOpacity)};
const float RIPPLE_CELL = ${float(RIPPLES.cell)};
const float RIPPLE_AROUND = ${float(RIPPLES.around)};
const float RING_CELL = ${float(R.cell)};
const float RING_SLOT = ${float(R.slot)};
const float RING_SECONDS = ${float(R.seconds)};
const float RING_FROM = ${float(R.from)};
const float RING_TO = ${float(R.to)};
const float RING_ALPHA = ${float(R.opacity)};
const vec3 RING_COLOUR = ${colour(R.colour)};
const float STEM_CELL = ${float(S.cell)};
const float STEM_CLUMP = ${float(S.clump)};
const float PADDY_FIELD = ${float(S.field)};
const float PADDY_ROW = ${float(S.row)};
const float PADDY_ALONG = ${float(S.along)};
const float STEM_WIDTH = ${float(S.width)};
const float STEM_ALPHA = ${float(S.opacity)};
const float STEM_BEND = ${float(S.bend)};
const float STEM_SWAY = ${float(S.sway)};
const float STEM_SWAY_SPEED = ${float(S.swaySpeed)};
const float STEMS_FROM_PIXELS = ${float(S.fromPixels)};
const float STEMS_WHOLE_PIXELS = ${float(S.wholePixels)};
const vec3 MIST_COLOUR = ${colour(M.colour)};
const float MIST_ALPHA = ${float(M.opacity)};
const float TALLEST_STEM = ${float(Math.max(...KINDS.map((kind) => kind.tall)))};

// What the wet land's looks give at a point - how much of it is water, the water's colour, how much mist lies over it -
// blended between the four world units about it, of those that are wet land.
struct WetLooks {
  float pools;
  vec3 water;
  float mist;
};

WetLooks wetLooksAt(vec2 world) {
  vec2 at = world - uMaskOrigin - 0.5;
  ivec2 base = ivec2(floor(at));
  vec2 part = at - vec2(base);
  WetLooks blend = WetLooks(0.0, vec3(0.0), 0.0);
  float weight = 0.0;
  for (int dy = 0; dy <= 1; dy++) {
    for (int dx = 0; dx <= 1; dx++) {
      ivec2 texel = base + ivec2(dx, dy);
      if (any(lessThan(texel, ivec2(0))) || any(greaterThanEqual(texel, ivec2(uMaskSize)))) continue;
      if (texelFetch(uMask, texel, 0)[WET] < 0.5) continue;
      float w = (dx == 0 ? 1.0 - part.x : part.x) * (dy == 0 ? 1.0 - part.y : part.y);
      int look = clamp(int(texelFetch(uLooks, texel, 0).r * 255.0 + 0.5), 0, WET_LOOKS - 1);
      blend.pools += WET_POOLS[look] * w;
      blend.water += WET_WATER[look] * w;
      blend.mist += WET_MIST[look] * w;
      weight += w;
    }
  }
  if (weight > 0.0) {
    blend.pools /= weight;
    blend.water /= weight;
    blend.mist /= weight;
  }
  return blend;
}

// How much open water there is at a point, nought to one: where a slow pattern over the ground is high.
float poolAt(vec2 world, float share) {
  float pattern = noise(world / POOL_SIZE + vec2(17.0, 3.0)) * 0.65 + noise(world / (POOL_SIZE * 0.4) + vec2(5.0, 41.0)) * 0.35;
  float edge = 0.72 - 0.5 * share * uPools;
  return smoothstep(edge - POOL_SOFT, edge + POOL_SOFT, pattern);
}

// The light the water catches: fine ripples carried down the wind with the gusts, brightest where a gust blows.
float glintAt(vec2 world) {
  vec2 wind = vec2(dot(world, WIND) - uCarried, dot(world, WIND_ACROSS));
  float ripple = windNoise(wind / RIPPLE_CELL, RIPPLE_AROUND, 131) * 0.6 + windNoise(wind / (RIPPLE_CELL * 0.5), RIPPLE_AROUND * 2.0, 132) * 0.4;
  return smoothstep(0.6, 0.85, ripple) * (0.4 + 0.6 * gustAt(world, uCarried));
}

// A ring spreading on the water now and then: a cell of the ground and a slot of the clock may bring one, at a place
// and a moment of their own, the last slot's still spreading as this one's begin.
float ringsAt(vec2 world) {
  float best = 0.0;
  ivec2 home = ivec2(floor(world / RING_CELL));
  float slot = floor(uTime / RING_SLOT);
  for (int back = 0; back <= 1; back++) {
    float slotAt = slot - float(back);
    int salt = int(mod(slotAt, 4093.0));
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        ivec2 cell = home + ivec2(dx, dy);
        ivec2 key = cell + ivec2(salt * 131, salt * 71);
        if (hash(key, 81) > uRings) continue;
        float age = uTime - (slotAt + hash(key, 84)) * RING_SLOT;
        if (age < 0.0 || age > RING_SECONDS) continue;
        vec2 centre = (vec2(cell) + vec2(hash(key, 82), hash(key, 83))) * RING_CELL;
        float k = age / RING_SECONDS;
        float radius = mix(RING_FROM, RING_TO, sqrt(k));
        float off = abs(length(world - centre) - radius) * uScale;
        float on = 1.0 - smoothstep(uPixel * 0.6, uPixel * 1.6, off);
        best = max(best, on * pow(1.0 - k, 1.5) * smoothstep(0.0, 0.08, k));
      }
    }
  }
  return best;
}

// The mist, in low banks drifting slowly down the wind, with wisps in them.
float mistAt(vec2 world) {
  vec2 wind = vec2(dot(world, WIND) - uMistCarried, dot(world, WIND_ACROSS));
  float bank = windNoise(vec2(wind.x / uMistLattice.x, wind.y / (uMistLattice.x * 0.7)), uMistLattice.y, 121);
  float wisp = windNoise(wind / (uMistLattice.x * 0.25), uMistLattice.y * 4.0, 122);
  return smoothstep(0.42, 0.8, bank * 0.7 + wisp * 0.3);
}

// One stem, a stroke from its root bending down the wind: how much of this pixel it covers, and its colour.
void stemInk(vec2 root, float size, vec2 downWind, float blow, float swayAt, int look, float thick, inout float ink, inout vec3 drawn) {
  float sway = sin(TAU * (uTime * STEM_SWAY_SPEED + swayAt)) * STEM_SWAY;
  vec2 tip = root + vec2(0.0, -size) + downWind * size * (blow * STEM_BEND + sway);
  float on = 1.0 - smoothstep(thick * 0.5, thick * 0.5 + uPixel, segment(vScreen, root, tip));
  if (on > ink) {
    ink = on;
    vec2 rise = tip - root;
    float lit = clamp(dot(vScreen - root, rise) / max(dot(rise, rise), 1e-6), 0.0, 1.0);
    drawn = mix(WET_ROOT[look], WET_TIP[look], lit) * STEM_ALPHA;
  }
}

// The wet land over the ground under this pixel, premultiplied: its water with the light and the rings on it, the stems
// standing in it, and the mist over all of it.
vec4 wetHere(vec2 world) {
  WetLooks looks = wetLooksAt(world);
  float pool = poolAt(world, looks.pools);
  float waterAlpha = pool * POOL_ALPHA;
  vec3 rgb = looks.water * waterAlpha;
  float alpha = waterAlpha;
  float glint = glintAt(world) * GLINT_ALPHA * pool;
  rgb = GLINT * glint + rgb * (1.0 - glint);
  alpha = glint + alpha * (1.0 - glint);
  float ring = uRings > 0.0 ? ringsAt(world) * RING_ALPHA * pool : 0.0;
  rgb = RING_COLOUR * ring + rgb * (1.0 - ring);
  alpha = ring + alpha * (1.0 - ring);

  float worth = smoothstep(STEMS_FROM_PIXELS, STEMS_WHOLE_PIXELS, STEM_CELL * uScale);
  if (worth > 0.0 && uStems > 0.0) {
    vec2 downWind = screenOf(uCentre + WIND) - screenOf(uCentre);
    downWind /= max(length(downWind), 1e-6);
    float thick = max(STEM_WIDTH, uPixel * 1.1);
    float tallest = TALLEST_STEM * uStems * uScale * 1.2;
    vec2 reach = groundUnder(vScreen + vec2(0.0, tallest * 0.5) - downWind * tallest * 0.3);
    float blow = gustAt(reach, uCarried);
    float ink = 0.0;
    vec3 drawn = vec3(0.0);
    int here = clamp(lookAt(world), 0, WET_LOOKS - 1);
    if (WET_ROWS[here] > 0.5) {
      // The paddy: shoots in rows, a terrace to a way, with a bank between two terraces.
      Field field = fieldAt(reach, PADDY_FIELD);
      float way = hash(field.id, 95) * 3.14159265;
      vec2 along = vec2(cos(way), sin(way));
      vec2 across = vec2(-along.y, along.x);
      vec2 off = reach - field.middle;
      int row0 = int(floor(dot(off, across) / PADDY_ROW + 0.5));
      int at0 = int(floor(dot(off, along) / PADDY_ALONG + 0.5));
      for (int dr = -2; dr <= 2; dr++) {
        for (int da = -2; da <= 2; da++) {
          ivec2 shoot = ivec2(at0 + da, row0 + dr) + field.id * 4099;
          vec2 rootWorld = field.middle + along * (float(at0 + da) * PADDY_ALONG) + across * (float(row0 + dr) * PADDY_ROW);
          if (insideOf(field, rootWorld) < 0.12 || rootsAt(rootWorld)[WET] < 0.5) continue;
          int look = clamp(lookAt(rootWorld), 0, WET_LOOKS - 1);
          if (WET_ROWS[look] < 0.5) continue;
          float size = WET_TALL[look] * uStems * uScale * mix(0.85, 1.1, hash(shoot, 96));
          stemInk(screenOf(rootWorld), size, downWind, blow, hash(shoot, 97), look, thick, ink, drawn);
        }
      }
    } else {
      // Reeds and tufts, scattered in clumps.
      vec2 cells = reach / STEM_CELL;
      ivec2 middle = ivec2(floor(cells));
      for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
          ivec2 at = middle + ivec2(dx, dy);
          vec2 rootWorld = (vec2(at) + vec2(hash(at, 91), hash(at, 92))) * STEM_CELL;
          if (rootsAt(rootWorld)[WET] < 0.5) continue;
          int look = clamp(lookAt(rootWorld), 0, WET_LOOKS - 1);
          if (WET_ROWS[look] > 0.5) continue;
          float clump = smoothstep(0.3, 0.7, noise(rootWorld / STEM_CLUMP + vec2(23.0, 61.0)));
          if (hash(at, 93) > WET_STEMS[look] * mix(0.25, 1.0, clump)) continue;
          float size = WET_TALL[look] * uStems * uScale * mix(0.7, 1.2, hash(at, 94));
          stemInk(screenOf(rootWorld), size, downWind, blow, hash(at, 97), look, thick, ink, drawn);
        }
      }
    }
    ink *= worth;
    float strokeAlpha = STEM_ALPHA * ink;
    rgb = drawn * ink + rgb * (1.0 - strokeAlpha);
    alpha = strokeAlpha + alpha * (1.0 - strokeAlpha);
  }

  float mist = uMist > 0.0 ? mistAt(world) * looks.mist * uMist * MIST_ALPHA : 0.0;
  rgb = MIST_COLOUR * mist + rgb * (1.0 - mist);
  alpha = mist + alpha * (1.0 - mist);
  return vec4(rgb, alpha);
}
`;
