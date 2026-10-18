import { DUNE_GLSL } from './duneShader';
import { ICE_LOOK } from './iceLook';

/**
 * The ice, the salt and the sand, a motion of the land and the fifth: a part of the land shader, `landShader.ts`, which
 * asks `iceHere` for it wherever the land under a pixel is ice, polar desert, salt flat or sand desert, which the mask
 * keeps in a texture of its own.
 *
 * On the salt, points of light flash for a moment and are gone: one at the most to a small cell of the ground, at a
 * place and moments of its own, a soft point with a little cross of light. Over the ice and the polar desert snow
 * streams along the wind in faint streamers, faster than the gusts and strongest where one blows, and now and then a
 * little swirl of it spins and drifts down the wind, at a place and a moment a cell and a slot of the clock draw.
 *
 * The sand lies in clumps of dunes here and there, still sand between them, standing up the screen as the trees do,
 * with sand streaming over their crests: `duneShader.ts`. A kind's look is blended between the world units about a
 * pixel, so it never steps at a texel's edge. Every number is in `iceLook.ts`, and the sliders' in `iceTuning.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => `vec3(${rgb.map(float).join(', ')})`;

const KINDS = Object.values(ICE_LOOK.kinds);
const G = ICE_LOOK.glints;
const D = ICE_LOOK.drift;
const S = ICE_LOOK.swirls;

const floats = (pick: (kind: (typeof KINDS)[number]) => number): string =>
  `float[${KINDS.length}](${KINDS.map((kind) => float(pick(kind))).join(', ')})`;
const colours = (pick: (kind: (typeof KINDS)[number]) => readonly number[]): string =>
  `vec3[${KINDS.length}](${KINDS.map((kind) => colour(pick(kind))).join(', ')})`;

export const ICE_GLSL = `
// How the ice, the salt and the sand look, from the sliders: iceTuning.ts says what each is.
uniform float uGlints;
uniform float uSnow;
uniform float uSwirls;
uniform float uSand;
// The drift's lattice, its cell along the wind and how many cells it comes round after, and how far it has run.
uniform vec2 uDriftLattice;
uniform float uDriftCarried;

const int ICE_LOOKS = ${KINDS.length};
const float ICE_GLINTS[ICE_LOOKS] = ${floats((kind) => kind.glints)};
const vec3 ICE_GLINT[ICE_LOOKS] = ${colours((kind) => kind.glint)};
const float ICE_DRIFT[ICE_LOOKS] = ${floats((kind) => kind.drift)};
const vec3 ICE_DRIFT_COLOUR[ICE_LOOKS] = ${colours((kind) => kind.colour)};
const float ICE_SWIRLS[ICE_LOOKS] = ${floats((kind) => kind.swirls)};
const float ICE_DUNES[ICE_LOOKS] = ${floats((kind) => kind.dunes)};
const float GLINT_CELL = ${float(G.cell)};
const float GLINT_SIZE = ${float(G.size)};
const float GLINT_FLASH = ${float(G.flash)};
const float GLINT_FROM = ${float(G.between[0])};
const float GLINT_TO = ${float(G.between[1])};
const float GLINT_SHINE = ${float(G.opacity)};
const float DRIFT_THIN = ${float(D.thin)};
const float DRIFT_ALPHA = ${float(D.opacity)};
const float SWIRL_CELL = ${float(S.cell)};
const float SWIRL_SLOT = ${float(S.slot)};
const float SWIRL_CHANCE = ${float(S.chance)};
const float SWIRL_SECONDS = ${float(S.seconds)};
const float SWIRL_RADIUS = ${float(S.radius)};
const float SWIRL_DRIFT = ${float(S.drift)};
const float SWIRL_TURNS = ${float(S.turns)};
const float SWIRL_SPIN = ${float(S.spin)};
const vec3 SWIRL_COLOUR = ${colour(S.colour)};
const float SWIRL_ALPHA = ${float(S.opacity)};

// What the kinds' looks give at a point - how strongly it drifts and in what, how often it swirls, whether it lies in
// dunes - blended between the four world units about it, of those that are this motion's land.
struct IceLooks {
  float drift;
  vec3 colour;
  float swirls;
  float dunes;
};

IceLooks iceLooksAt(vec2 world) {
  vec2 at = world - uMaskOrigin - 0.5;
  ivec2 base = ivec2(floor(at));
  vec2 part = at - vec2(base);
  IceLooks blend = IceLooks(0.0, vec3(0.0), 0.0, 0.0);
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
      blend.swirls += ICE_SWIRLS[look] * w;
      blend.dunes += ICE_DUNES[look] * w;
      weight += w;
    }
  }
  if (weight > 0.0) {
    blend.drift /= weight;
    blend.colour /= weight;
    blend.swirls /= weight;
    blend.dunes /= weight;
  }
  return blend;
}

// The streamers: long and thin along the wind, running down it faster than the gusts, strongest where one blows.
float driftAt(vec2 world) {
  vec2 wind = vec2(dot(world, WIND) - uDriftCarried, dot(world, WIND_ACROSS));
  float streak = windNoise(vec2(wind.x / uDriftLattice.x, wind.y / DRIFT_THIN), uDriftLattice.y, 151);
  return smoothstep(0.55, 0.8, streak) * (0.35 + 0.65 * gustAt(world, uCarried));
}

// A little swirl of snow now and then: one at the most to a cell of the ground and a slot of the clock, at a place and
// a moment of its own, two arms winding out from its middle, spinning as it drifts down the wind and fading as it goes.
float swirlsAt(vec2 world) {
  float best = 0.0;
  ivec2 home = ivec2(floor(world / SWIRL_CELL));
  float slot = floor(uTime / SWIRL_SLOT);
  for (int back = 0; back <= 1; back++) {
    float slotAt = slot - float(back);
    int salt = int(mod(slotAt, 4093.0));
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        ivec2 cell = home + ivec2(dx, dy);
        ivec2 key = cell + ivec2(salt * 173, salt * 59);
        if (hash(key, 161) > SWIRL_CHANCE * uSwirls) continue;
        float age = uTime - (slotAt + hash(key, 164) * 0.8) * SWIRL_SLOT;
        if (age < 0.0 || age > SWIRL_SECONDS) continue;
        vec2 start = (vec2(cell) + vec2(hash(key, 162), hash(key, 163))) * SWIRL_CELL;
        vec2 off = world - (start + WIND * SWIRL_DRIFT * age);
        float r = length(off) / SWIRL_RADIUS;
        if (r > 1.0) continue;
        float k = age / SWIRL_SECONDS;
        float way = hash(key, 165) < 0.5 ? -1.0 : 1.0;
        float arm = atan(off.y, off.x) * way + r * SWIRL_TURNS * TAU - TAU * SWIRL_SPIN * age;
        float arms = pow(0.5 + 0.5 * cos(2.0 * arm), 6.0);
        float fade = pow(1.0 - r, 1.2) * smoothstep(0.0, 0.2, k) * (1.0 - smoothstep(0.6, 1.0, k));
        best = max(best, arms * fade * smoothstep(0.05, 0.25, r));
      }
    }
  }
  return best;
}

${DUNE_GLSL}

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

vec4 over(vec3 colour, float strength, vec4 under) {
  return vec4(colour * strength + under.rgb * (1.0 - strength), strength + under.a * (1.0 - strength));
}

// The ice, the salt or the sand over the ground under this pixel, premultiplied: the dunes' lit and shaded faces, the
// drift over them, a swirl of snow now and then, and the glints.
vec4 iceHere(vec2 world) {
  IceLooks looks = iceLooksAt(world);
  vec4 drawn = vec4(0.0);
  vec2 ground = world;
  // The frontmost dune the pixel sees, lit and shaded, whole wherever one stands. The sand streams most over the crests
  // and the slip faces just past them, and a little everywhere on the sand; the snow streams everywhere it lies.
  float crest = 0.0;
  if (looks.dunes > 0.0 && uDunes > 0.0) {
    ground = duneSeen(world, looks.dunes);
    vec2 dune = duneAt(ground);
    float lit = duneLight(ground, dune.y) * looks.dunes;
    drawn = lit > 0.0 ? over(DUNE_LIT, lit * DUNE_LIT_ALPHA, drawn) : over(DUNE_SHADE, -lit * DUNE_SHADE_ALPHA, drawn);
    float ridge = dune.y < 0.0 ? 0.0 : 1.0 - smoothstep(0.0, DUNE_CREST_WIDTH, abs(dune.y - DUNE_CREST));
    drawn = over(DUNE_LIT, ridge * DUNE_CREST_LIGHT * looks.dunes, drawn);
    crest = dune.y < 0.0 ? 0.0 : smoothstep(DUNE_CREST - 0.1, DUNE_CREST, dune.y) * (1.0 - smoothstep(DUNE_CREST + 0.05, 1.0, dune.y));
  }
  float drifting = mix(1.0, 0.3 + crest * 1.5, looks.dunes);
  float strength = looks.drift * mix(uSnow, uSand, looks.dunes) * drifting;
  if (strength > 0.0) {
    float streaks = mix(driftAt(ground), sandFlowAt(ground), looks.dunes);
    drawn = over(looks.colour, min(1.0, streaks * strength * DRIFT_ALPHA), drawn);
  }
  if (looks.swirls > 0.0 && uSwirls > 0.0) {
    drawn = over(SWIRL_COLOUR, swirlsAt(world) * looks.swirls * SWIRL_ALPHA, drawn);
  }
  if (uGlints > 0.0) {
    vec3 tint;
    float glint = glintsAt(world, tint) * GLINT_SHINE;
    drawn = over(tint, glint, drawn);
  }
  return drawn;
}
`;
