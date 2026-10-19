import { channelOf } from './landMask';
import { LAND_LOOK } from './look';

/**
 * The heath, the scrub and the tundra, a motion of the land: a part of the land shader, `landShader.ts`, which asks
 * `heathHere` for them wherever the land under a pixel is one of the three.
 *
 * Low woody growth that a gust only stirs: the gusts show far more faintly than on the grass, and close in a low clump
 * stands in most small cells of the ground, shaded under and lit on top, nudged down the wind as a gust passes and
 * swaying a very little when none does. Each kind has its own clumps, read from the look the mask keeps for the world
 * unit a clump is rooted in: heather's small purple ones close together, scrub's bigger grey-green bushes with bare
 * ground between, the tundra's low mat; and on the tundra, cotton grass, a thin stem with a white head that nods with
 * the wind. Every number is in `look.ts`, under `heath`, and the sliders' in `heathTuning.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => `vec3(${rgb.map(float).join(', ')})`;

const H = LAND_LOOK.heath;
const KINDS = Object.values(H.kinds);
const C = H.cotton;

/** One number of each kind, as a GLSL array the look of a clump picks from. */
const floats = (pick: (kind: (typeof KINDS)[number]) => number): string =>
  `float[${KINDS.length}](${KINDS.map((kind) => float(pick(kind))).join(', ')})`;
const colours = (pick: (kind: (typeof KINDS)[number]) => readonly number[]): string =>
  `vec3[${KINDS.length}](${KINDS.map((kind) => colour(pick(kind))).join(', ')})`;

export const HEATH_GLSL = `
// How the heath grows, from the sliders: heathTuning.ts says what each is.
uniform float uHeathSize;
uniform float uHeathDensity;
uniform float uCotton;
uniform float uStir;
uniform float uHeathTrails;

const int HEATH = ${channelOf('heath')};
const int HEATH_LOOKS = ${KINDS.length};
const float HEATH_RADIUS[HEATH_LOOKS] = ${floats((kind) => kind.radius)};
const float HEATH_THICK[HEATH_LOOKS] = ${floats((kind) => kind.thick)};
const vec3 HEATH_DARK[HEATH_LOOKS] = ${colours((kind) => kind.dark)};
const vec3 HEATH_LIGHT[HEATH_LOOKS] = ${colours((kind) => kind.light)};
const float HEATH_ALPHA[HEATH_LOOKS] = ${floats((kind) => kind.opacity)};
const float HEATH_COTTON[HEATH_LOOKS] = ${floats((kind) => kind.cotton)};
const float HEATH_CELL = ${float(H.cell)};
const float HEATH_FROM_PIXELS = ${float(H.fromPixels)};
const float HEATH_WHOLE_PIXELS = ${float(H.wholePixels)};
const vec3 HEATH_SHEEN = ${colour(H.sheen)};
const float HEATH_SHEEN_ALPHA = ${float(H.sheenOpacity)};
const float HEATH_NUDGE = ${float(H.nudge)};
const float HEATH_SWAY = ${float(H.sway)};
const float HEATH_SWAY_SPEED = ${float(H.swaySpeed)};
const float COTTON_HEIGHT = ${float(C.height)};
const float COTTON_HEAD = ${float(C.head)};
const float COTTON_BEND = ${float(C.bend)};
const float COTTON_SWAY = ${float(C.sway)};
const float COTTON_SWAY_SPEED = ${float(C.swaySpeed)};
const vec3 COTTON_STEM = ${colour(C.stem)};
const float COTTON_STEM_ALPHA = ${float(C.stemOpacity)};
const vec3 COTTON_WHITE = ${colour(C.white)};
const float COTTON_WHITE_ALPHA = ${float(C.whiteOpacity)};

// The heath, the scrub or the tundra over the ground under this pixel, premultiplied: a gust's faint paler side, and
// close in the clumps and the cotton grass rooted about it, each in its own kind's look.
vec4 heathHere(vec2 world) {
  float gust = gustAt(world, uCarried);
  vec3 rgb = HEATH_SHEEN * gust * HEATH_SHEEN_ALPHA;
  float alpha = gust * HEATH_SHEEN_ALPHA;

  float cell = HEATH_CELL * uHeathSize;
  float worth = smoothstep(HEATH_FROM_PIXELS, HEATH_WHOLE_PIXELS, cell * uScale);
  if (worth <= 0.0) {
    return vec4(rgb, alpha);
  }
  vec2 downWind = screenOf(uCentre + WIND) - screenOf(uCentre);
  downWind /= max(length(downWind), 1e-6);
  float thick = max(1.0, uPixel * 1.1);
  // The tallest thing here is a stem of cotton grass, so the roots that can reach this pixel lie on the ground below
  // it, by about half of one, and up the wind from it: the cells about there are the ones looked at.
  float tallest = COTTON_HEIGHT * uScale * 1.2;
  vec2 reach = groundUnder(vScreen + vec2(0.0, tallest * 0.5) - downWind * tallest * 0.3) / cell;
  ivec2 middle = ivec2(floor(reach));
  // The gust changes slowly over the ground, so it is read once for the cells about here.
  float blow = gustAt(reach * cell, uCarried) * uStir;
  // The animal trails about here, where a clump is missing: trailShader.ts.
  vec2 about = reach * cell;
  vec4 trails = trailsAbout(about, uHeathTrails);
  float ink = 0.0;
  vec3 drawn = vec3(0.0);
  float inkAlpha = 0.0;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      ivec2 at = middle + ivec2(dx, dy);
      vec2 rootWorld = (vec2(at) + vec2(hash(at, 61), hash(at, 62))) * cell;
      if (rootsAt(rootWorld)[HEATH] < 0.5) {
        continue;
      }
      int look = clamp(lookAt(rootWorld), 0, HEATH_LOOKS - 1);
      if (hash(at, 63) > HEATH_THICK[look] * uHeathDensity) {
        continue;
      }
      // None grows on an animal trail.
      if (onTrail(trails, about, rootWorld)) {
        continue;
      }
      vec2 root = screenOf(rootWorld);
      if (hash(at, 64) < HEATH_COTTON[look] * uCotton) {
        // Cotton grass: a thin stem and its white head, nodding down the wind.
        float sway = sin(TAU * (uTime * COTTON_SWAY_SPEED + hash(at, 65))) * COTTON_SWAY;
        float size = COTTON_HEIGHT * uScale * mix(0.8, 1.2, hash(at, 66));
        vec2 tip = root + vec2(0.0, -size) + downWind * size * (blow * COTTON_BEND + sway);
        float head = max(COTTON_HEAD * uScale, uPixel * 1.2);
        float white = 1.0 - smoothstep(head - uPixel * 0.5, head + uPixel * 0.5, length(vScreen - tip));
        float stem = 1.0 - smoothstep(thick * 0.5, thick * 0.5 + uPixel, segment(vScreen, root, tip));
        if (white > ink) {
          ink = white;
          drawn = COTTON_WHITE * COTTON_WHITE_ALPHA;
          inkAlpha = COTTON_WHITE_ALPHA;
        } else if (stem > ink) {
          ink = stem;
          drawn = COTTON_STEM * COTTON_STEM_ALPHA;
          inkAlpha = COTTON_STEM_ALPHA;
        }
      } else {
        // A low clump, a little wider than it is tall, shaded under and lit on top, that a gust only nudges.
        float r = HEATH_RADIUS[look] * uHeathSize * uScale * mix(0.7, 1.3, hash(at, 67));
        float sway = sin(TAU * (uTime * HEATH_SWAY_SPEED + hash(at, 68))) * HEATH_SWAY;
        vec2 centre = root + vec2(0.0, -r * 0.7) + downWind * r * (blow * HEATH_NUDGE + sway);
        float d = length((vScreen - centre) * vec2(1.0, 1.25)) - r;
        float on = 1.0 - smoothstep(-uPixel * 0.5, uPixel * 0.5, d);
        if (on > ink) {
          ink = on;
          float top = clamp((centre.y - vScreen.y) / max(r, 1e-3) * 0.5 + 0.5, 0.0, 1.0);
          drawn = mix(HEATH_DARK[look], HEATH_LIGHT[look], top) * HEATH_ALPHA[look];
          inkAlpha = HEATH_ALPHA[look];
        }
      }
    }
  }
  ink *= worth;
  float strokeAlpha = inkAlpha * ink;
  rgb = drawn * ink + rgb * (1.0 - strokeAlpha);
  alpha = strokeAlpha + alpha * (1.0 - strokeAlpha);
  return vec4(rgb, alpha);
}
`;
