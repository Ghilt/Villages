import { ICE_LOOK } from './iceLook';

/**
 * The ice, the salt and the sand, a motion of the land and the fifth: a part of the land shader, `landShader.ts`, which
 * asks `iceHere` for it wherever the land under a pixel is ice, polar desert, salt flat or sand desert, which the mask
 * keeps in a texture of its own.
 *
 * Points of light flash for a moment and are gone, on the ice and the salt: one at the most to a small cell of the
 * ground, at a place of its own, now and again at moments of its own, a soft point with a little cross of light. And
 * drift: faint pale streamers running along the wind, faster than the gusts and strongest where a gust blows - snow
 * over the ice and the polar desert, and over the sand desert sand blowing off the crests of the dunes, which stand
 * across the wind. A kind's drift is blended between the world units about a pixel, so it never steps at a texel's
 * edge. Every number is in `iceLook.ts`, and the sliders' in `iceTuning.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => `vec3(${rgb.map(float).join(', ')})`;

const KINDS = Object.values(ICE_LOOK.kinds);
const G = ICE_LOOK.glints;
const D = ICE_LOOK.drift;

const floats = (pick: (kind: (typeof KINDS)[number]) => number): string =>
  `float[${KINDS.length}](${KINDS.map((kind) => float(pick(kind))).join(', ')})`;
const colours = (pick: (kind: (typeof KINDS)[number]) => readonly number[]): string =>
  `vec3[${KINDS.length}](${KINDS.map((kind) => colour(pick(kind))).join(', ')})`;

export const ICE_GLSL = `
// How the ice, the salt and the sand look, from the sliders: iceTuning.ts says what each is.
uniform float uGlints;
uniform float uSnow;
uniform float uSand;
// The drift's lattice, its cell along the wind and how many cells it comes round after, and how far it has run.
uniform vec2 uDriftLattice;
uniform float uDriftCarried;

const int ICE_LOOKS = ${KINDS.length};
const float ICE_GLINTS[ICE_LOOKS] = ${floats((kind) => kind.glints)};
const vec3 ICE_GLINT[ICE_LOOKS] = ${colours((kind) => kind.glint)};
const float ICE_DRIFT[ICE_LOOKS] = ${floats((kind) => kind.drift)};
const vec3 ICE_DRIFT_COLOUR[ICE_LOOKS] = ${colours((kind) => kind.colour)};
const float ICE_CRESTS[ICE_LOOKS] = ${floats((kind) => kind.crests)};
const float GLINT_CELL = ${float(G.cell)};
const float GLINT_SIZE = ${float(G.size)};
const float GLINT_FLASH = ${float(G.flash)};
const float GLINT_FROM = ${float(G.between[0])};
const float GLINT_TO = ${float(G.between[1])};
const float GLINT_SHINE = ${float(G.opacity)};
const float DRIFT_THIN = ${float(D.thin)};
const float DRIFT_ALPHA = ${float(D.opacity)};
const float DUNES = ${float(D.dunes)};

// What the kinds' looks give at a point - how strongly it drifts, in what, and how much of it is dunes - blended
// between the four world units about it, of those that are this motion's land.
struct IceLooks {
  float drift;
  vec3 colour;
  float crests;
};

IceLooks iceLooksAt(vec2 world) {
  vec2 at = world - uMaskOrigin - 0.5;
  ivec2 base = ivec2(floor(at));
  vec2 part = at - vec2(base);
  IceLooks blend = IceLooks(0.0, vec3(0.0), 0.0);
  float weight = 0.0;
  for (int dy = 0; dy <= 1; dy++) {
    for (int dx = 0; dx <= 1; dx++) {
      ivec2 texel = base + ivec2(dx, dy);
      if (any(lessThan(texel, ivec2(0))) || any(greaterThanEqual(texel, ivec2(uMaskSize)))) continue;
      if (texelFetch(uMaskMore, texel, 0).r < 0.5) continue;
      float w = (dx == 0 ? 1.0 - part.x : part.x) * (dy == 0 ? 1.0 - part.y : part.y);
      int look = clamp(int(texelFetch(uLooks, texel, 0).r * 255.0 + 0.5), 0, ICE_LOOKS - 1);
      blend.drift += ICE_DRIFT[look] * w;
      blend.colour += ICE_DRIFT_COLOUR[look] * w;
      blend.crests += ICE_CRESTS[look] * w;
      weight += w;
    }
  }
  if (weight > 0.0) {
    blend.drift /= weight;
    blend.colour /= weight;
    blend.crests /= weight;
  }
  return blend;
}

// The streamers: long and thin along the wind, running down it faster than the gusts, strongest where one blows.
float driftAt(vec2 world) {
  vec2 wind = vec2(dot(world, WIND) - uDriftCarried, dot(world, WIND_ACROSS));
  float streak = windNoise(vec2(wind.x / uDriftLattice.x, wind.y / DRIFT_THIN), uDriftLattice.y, 151);
  return smoothstep(0.55, 0.8, streak) * (0.35 + 0.65 * gustAt(world, uCarried));
}

// The crests of the dunes, standing across the wind, a little wandering: the sand blows off them.
float crestAt(vec2 world) {
  float along = dot(world, WIND) / DUNES + noise(world / (DUNES * 2.0) + vec2(3.0, 11.0)) * 1.5;
  return pow(0.5 + 0.5 * sin(TAU * along), 6.0);
}

// A point of light flashing now and again, a small star: one at the most to a small cell of the ground, at its own
// place and moments.
float glintsAt(vec2 world, out vec3 tint) {
  tint = vec3(1.0);
  float best = 0.0;
  ivec2 home = ivec2(floor(world / GLINT_CELL));
  float size = max(GLINT_SIZE, uPixel * 1.2);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 cell = home + ivec2(dx, dy);
      vec2 at = (vec2(cell) + vec2(hash(cell, 141), hash(cell, 142))) * GLINT_CELL;
      if (rootedIn(uMaskMore, at).r < 0.5) continue;
      int look = clamp(lookAt(at), 0, ICE_LOOKS - 1);
      if (hash(cell, 143) > ICE_GLINTS[look] * uGlints) continue;
      float every = mix(GLINT_FROM, GLINT_TO, hash(cell, 144)) + GLINT_FLASH;
      float into = mod(uTime + hash(cell, 145) * every, every);
      if (into > GLINT_FLASH) continue;
      float bright = sin(into / GLINT_FLASH * 3.14159265);
      vec2 off = vScreen - screenOf(at);
      float r = size * (0.6 + 0.4 * bright);
      float point = 1.0 - smoothstep(r * 0.4, r, length(off));
      float thin = uPixel * 0.8;
      float rays = max(
        (1.0 - smoothstep(0.0, thin, abs(off.x))) * (1.0 - smoothstep(0.0, r * 3.0, abs(off.y))),
        (1.0 - smoothstep(0.0, thin, abs(off.y))) * (1.0 - smoothstep(0.0, r * 3.0, abs(off.x)))
      );
      float on = max(point, rays * 0.7) * bright;
      if (on > best) {
        best = on;
        tint = ICE_GLINT[look];
      }
    }
  }
  return best;
}

// The ice, the salt or the sand over the ground under this pixel, premultiplied: its drift, and the glints over it.
vec4 iceHere(vec2 world) {
  IceLooks looks = iceLooksAt(world);
  vec3 rgb = vec3(0.0);
  float alpha = 0.0;
  float strength = looks.drift * mix(uSnow, uSand, looks.crests);
  if (strength > 0.0) {
    float dunes = mix(1.0, 0.5 + 1.2 * crestAt(world), looks.crests);
    float drift = min(1.0, driftAt(world) * strength * DRIFT_ALPHA * dunes);
    rgb = looks.colour * drift;
    alpha = drift;
  }
  if (uGlints > 0.0) {
    vec3 tint;
    float glint = glintsAt(world, tint) * GLINT_SHINE;
    rgb = tint * glint + rgb * (1.0 - glint);
    alpha = glint + alpha * (1.0 - glint);
  }
  return vec4(rgb, alpha);
}
`;
