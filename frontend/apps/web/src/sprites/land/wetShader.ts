import { latticeNear } from '../clouds/cloudClock';

import { channelOf } from './landMask';
import { LAND_LOOK } from './look';

/**
 * The wet land, a motion of the land: a part of the land shader, `landShader.ts`, which asks `wetHere` for it wherever
 * the land under a pixel is marsh, bog, paddy, floodplain, mangrove or swamp forest.
 *
 * Open water lies among the growth where a slow pattern over the ground is high, dark, catching the light in glints
 * where the wind ruffles it - ripples carried slowly down the wind by the wall clock - and now and then a ring spreads on
 * it, at a place and a moment a cell of the ground and a slot of the clock draw. Stems stand in it: reeds in clumps
 * in the marsh, tufts on the floodplain, shoots in rows in the paddy's terraces, each a stroke bending with the gusts.
 * Over the marsh and the bog mist lies in long thin banks along the screen, rising and falling along their length and
 * swaying slowly to and fro with the wall clock, thin enough to see through. How much of
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
// The reeds look at five cells across, less than two world units, so the roots they look at stand in at most three by
// three of the mask's world units, which is what the tallest stem about a pixel is read from.
if (5 * S.cell >= 2)
  throw new Error(`a stem's cell of ${S.cell} world units is too big for the reeds' reach`);

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
// How far the wind has carried the ripples on the water, in world units modulo the world's width: slower than the gusts.
uniform float uRippleCarried;

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
const float SHORE_REACH = ${float(P.shore.reach)};
const float SHORE_APART = ${float(P.shore.apart)};
const float SHORE_PERIOD = ${float(P.shore.period)};
const float SHORE_ALPHA = ${float(P.shore.opacity)};
const float SHORE_RECEDE = ${float(P.shore.recede)};
// How far apart, in world units, the pattern is read to find how steeply it rises towards a pool's middle.
const float SHORE_STEP = 0.1;
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
const float MIST_LONG = ${float(M.long)};
const float MIST_THIN = ${float(M.thin)};
const float MIST_WAVE = ${float(M.wave)};
const float MIST_SWAY = ${float(M.sway)};
const float MIST_PERIOD = ${float(M.period)};
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

// The slow pattern over the ground the pools are cut from: open water where it is high.
float poolPatternAt(vec2 world) {
  return noise(world / POOL_SIZE + vec2(17.0, 3.0)) * 0.65 + noise(world / (POOL_SIZE * 0.4) + vec2(5.0, 41.0)) * 0.35;
}

// How far in from a pool's edge a point is, in the pattern: below nought, dry. Drawing back from the wet land's own
// edge, so where it meets dry land is a shore like any pool's.
float poolAt(vec2 world, float share) {
  float inland = softenedIn(uMask, world)[WET];
  float edge = 0.72 - 0.5 * share * uPools;
  return poolPatternAt(world) - (1.0 - inland) * SHORE_RECEDE - edge;
}

// How far in from a pool's edge a point is, in world units: how far in it is in the pattern, over how steeply the
// pattern rises there.
float shoreDistanceAt(vec2 world, float inside) {
  float here = poolPatternAt(world);
  vec2 rise = vec2(
    poolPatternAt(world + vec2(SHORE_STEP, 0.0)) - here,
    poolPatternAt(world + vec2(0.0, SHORE_STEP)) - here
  ) / SHORE_STEP;
  return inside / max(length(rise), 0.02);
}

// The little waves near a pool's edge, so many world units in from it: bands along its shore, lapping in towards it,
// coming round with the clock.
float shoreAt(float away) {
  float near = 1.0 - smoothstep(0.0, SHORE_REACH, away);
  float lap = pow(0.5 + 0.5 * sin(TAU * (away / SHORE_APART + uTime / SHORE_PERIOD)), 4.0);
  return near * lap * smoothstep(0.0, SHORE_APART * 0.5, away);
}

// The light the water catches: fine ripples carried slowly down the wind, a little brighter where a gust blows.
float glintAt(vec2 world) {
  vec2 wind = vec2(dot(world, WIND) - uRippleCarried, dot(world, WIND_ACROSS));
  float ripple = windNoise(wind / RIPPLE_CELL, RIPPLE_AROUND, 131) * 0.6 + windNoise(wind / (RIPPLE_CELL * 0.5), RIPPLE_AROUND * 2.0, 132) * 0.4;
  return smoothstep(0.6, 0.85, ripple) * (0.6 + 0.4 * gustAt(world, uCarried));
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

// The mist, in long thin banks along the screen's horizontal, streaked, rising and falling along their length and
// swaying slowly to and fro: every motion of it a whole number of turns an hour, so it comes round with the clock.
float mistAt(vec2 world) {
  vec2 across = vec2(uTilt.x, uTilt.y);
  vec2 up = vec2(-uTilt.y, uTilt.x);
  float s = dot(world, across);
  float t = dot(world, up);
  float phase = TAU * uTime / MIST_PERIOD;
  float wave = sin(s / MIST_WAVE + phase) * MIST_SWAY + sin(s / (MIST_WAVE * 0.43) - 2.0 * phase) * MIST_SWAY * 0.5;
  float shift = sin(phase) * MIST_LONG * 0.15 + cos(3.0 * phase) * MIST_LONG * 0.05;
  float bank = noise(vec2((s + shift) / MIST_LONG, (t + wave) / MIST_THIN) + vec2(17.0, 41.0));
  float streak = noise(vec2((s - shift * 2.0) / (MIST_LONG * 0.35), (t + wave * 1.3) / (MIST_THIN * 0.4)) + vec2(5.0, 3.0));
  return smoothstep(0.5, 0.8, bank * 0.65 + streak * 0.35);
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
  float inside = poolAt(world, looks.pools);
  float pool = smoothstep(-POOL_SOFT, POOL_SOFT, inside);
  float waterAlpha = pool * POOL_ALPHA;
  vec3 rgb = looks.water * waterAlpha;
  float alpha = waterAlpha;
  // Near the shore the waves follow it, and the wind's ripples give way to them.
  float away = inside > 0.0 ? shoreDistanceAt(world, inside) : 0.0;
  float shore = inside > 0.0 ? shoreAt(away) : 0.0;
  float near = inside > 0.0 ? 1.0 - smoothstep(0.0, SHORE_REACH, away) : 1.0;
  float glint = max(glintAt(world) * GLINT_ALPHA * (1.0 - 0.8 * near), shore * SHORE_ALPHA) * pool;
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
      // Only the shoots that could reach this pixel are worked out (landShader.ts's reachOf), each on its row's line.
      vec2 firstShoot = field.middle + along * (float(at0) * PADDY_ALONG) + across * (float(row0) * PADDY_ROW);
      vec4 shootInk = strokeInk(tallest, downWind, blow * STEM_BEND - STEM_SWAY, blow * STEM_BEND + STEM_SWAY, thick * 0.5 + uPixel);
      Reach rows = reachOf(firstShoot, along * PADDY_ALONG, across * PADDY_ROW, vec2(0.0), vec2(0.0), shootInk);
      for (int dr = -2; dr <= 2; dr++) {
        for (int da = -2; da <= 2; da++) {
          if (!reaches(rows, ivec2(da, dr))) continue;
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
      // Only the cells whose stems could reach this pixel are worked out (landShader.ts's reachOf), as tall as the tallest
      // a root in them can grow: of the looks of every world unit one can stand in, read as the stems read theirs.
      ivec2 fromTexel = ivec2(floor(vec2(middle - 2) * STEM_CELL - uMaskOrigin));
      ivec2 toTexel = ivec2(floor(vec2(middle + 3) * STEM_CELL - uMaskOrigin));
      float tallestHere = 0.0;
      for (int ty = 0; ty <= 2; ty++) {
        for (int tx = 0; tx <= 2; tx++) {
          int look = clamp(lookOfTexel(min(fromTexel + ivec2(tx, ty), toTexel)), 0, WET_LOOKS - 1);
          tallestHere = max(tallestHere, WET_TALL[look]);
        }
      }
      float reachable = tallestHere * uStems * uScale * 1.2;
      Reach near = squareReach(middle, STEM_CELL, strokeInk(reachable, downWind, blow * STEM_BEND - STEM_SWAY, blow * STEM_BEND + STEM_SWAY, thick * 0.5 + uPixel));
      for (int dy = -2; dy <= 2; dy++) {
        for (int dx = -2; dx <= 2; dx++) {
          if (!reaches(near, ivec2(dx, dy))) continue;
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
