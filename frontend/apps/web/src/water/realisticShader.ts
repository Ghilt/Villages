import { WATER_LOOK } from './look';
import { HELPERS, float, vec } from './glsl';

/**
 * The realistic water's fragment shader, five things laid over the painted sea: a tint from turquoise
 * shallows to a dark deep; waves, a sum of travelling slopes lit by a sun in the north-west, which shade the
 * water and throw glints; caustics, a shifting net of light on the bottom of shallow water, bent by the waves
 * above it; surf, foam along the shore and lines of it rolling in; and on the rivers a look of their own, laid
 * along them by the flow tiles. Every number is from `look.ts`, and the rivers' from the Water sliders.
 */

const R = WATER_LOOK.realistic;

/** The realistic water's own uniforms, beyond those every water shader has. */
export const REALISTIC_UNIFORMS: readonly string[] = [
  'uWaves',
  'uCaustics',
  'uFlow',
  'uAlong',
  'uAlongPeriod',
  'uRiverSpeed',
  'uRippleSpacing',
  'uRippleBow',
  'uRippleSharpness',
  'uRippleBright',
  'uSpeckBright',
  'uRiverWaves',
  'uRiverCaustics',
];

const SUN = (() => {
  const [east, south] = R.sun.towards;
  const flat = Math.hypot(east, south);
  const up = (R.sun.elevation * Math.PI) / 180;
  return [(east / flat) * Math.cos(up), (south / flat) * Math.cos(up), Math.sin(up)];
})();
const HALF = (() => {
  const sum = [SUN[0]!, SUN[1]!, SUN[2]! + 1];
  const length = Math.hypot(...sum);
  return sum.map((one) => one / length);
})();

export const REALISTIC = `#version 300 es
precision highp float;
precision highp int;
${HELPERS}
uniform float uWaves[${R.waves.sizes}];
uniform float uCaustics[${R.caustics.sizes}];
// Which way the rivers run on the map, red east and green south about a half, and blue how big a river.
uniform sampler2D uFlow;
// How far down the river, as the cosine and sine of a turn every uAlongPeriod world units.
uniform sampler2D uAlong;
uniform float uAlongPeriod;
// The rivers' own look, from the sliders in the Water part of the debug panel's Shaders section.
uniform float uRiverSpeed;
uniform float uRippleSpacing;
uniform float uRippleBow;
uniform float uRippleSharpness;
uniform float uRippleBright;
uniform float uSpeckBright;
uniform float uRiverWaves;
uniform float uRiverCaustics;

const float SHELF = ${float(R.depth.shelf)};
const float SHELF_EDGE = ${float(R.depth.shelfEdge)};
const float SHORE_REACH = ${float(R.depth.shoreReach)};
const float SHOALING = ${float(R.depth.shoaling)};
const float LAKE_DEPTH = ${float(R.depth.lake)};
const float RIVER_DEPTH = ${float(R.depth.river)};
const vec3 SHALLOW = vec3(${vec(R.shallow.colour)});
const float SHALLOW_ALPHA = ${float(R.shallow.opacity)};
const vec3 DEEP = vec3(${vec(R.deep.colour)});
const float DEEP_ALPHA = ${float(R.deep.opacity)};

const vec3 SUN = vec3(${vec(SUN)});
const vec3 HALF = vec3(${vec(HALF)});
const int WAVE_SIZES = ${R.waves.sizes};
const float WAVE_FIRST = ${float(R.waves.first)};
const float WIND = ${float((R.waves.wind * Math.PI) / 180)};
const float SPREAD = ${float((R.waves.spread * Math.PI) / 180)};
const float STEEPNESS = ${float(R.waves.steepness)};
const float WAVE_PERIOD = ${float(R.waves.period)};
const float RELIEF = ${float(R.waves.relief)};
const float GLINT = ${float(R.waves.glint)};
const float SHININESS = ${float(R.waves.shininess)};

const int CAUSTIC_SIZES = ${R.caustics.sizes};
const float CAUSTIC_FIRST = ${float(R.caustics.first)};
const vec3 CAUSTIC = vec3(${vec(R.caustics.colour)});
const float CAUSTIC_STRENGTH = ${float(R.caustics.strength)};
const float SHARPNESS = ${float(R.caustics.sharpness)};
const float CAUSTIC_SPEED = ${float(R.caustics.speed)};
const float REFRACTION = ${float(R.caustics.refraction)};
const float CAUSTIC_DEEPEST = ${float(R.caustics.deepest)};

const vec3 SURF = vec3(${vec(R.surf.colour)});
const float SURF_EDGE = ${float(R.surf.edge)};
const float SURF_EDGE_ALPHA = ${float(R.surf.edgeOpacity)};
const float SURF_SPACING = ${float(R.surf.spacing)};
const float SURF_REACH = ${float(R.surf.reach)};
const float SURF_PERIOD = ${float(R.surf.period)};
const float SURF_ALPHA = ${float(R.surf.opacity)};
const float SURF_LAKE = ${float(R.surf.lake)};
const float SURF_RIVER = ${float(R.surf.river)};
const float RIVER_SLOWEST = ${float(R.rivers.slowest)};
const float RIVER_FASTEST = ${float(R.rivers.fastest)};
const float RIVER_CYCLE = ${float(R.rivers.cycle)};

// The slope of the sea's surface: in every size, four waves spread about the wind, travelling at speeds that
// grow with their length. The ground under them is warped a little and their height swells in groups, so the
// sum reads as a sea rather than as a lattice.
vec2 slopeAt(vec2 p) {
  vec2 slope = vec2(0.0);
  for (int size = 0; size < WAVE_SIZES; size++) {
    float weight = uWaves[size];
    if (weight <= 0.0) {
      continue;
    }
    float lambda = WAVE_FIRST * exp2(float(size));
    vec2 wander = vec2(noise(p / (lambda * 3.1) + 3.7), noise(p / (lambda * 3.1) + 11.3)) - 0.5;
    vec2 q = p + wander * lambda * 1.6;
    float groups = 0.5 + noise(p / (lambda * 7.0) + float(size) * 5.1);
    float period = WAVE_PERIOD * sqrt(lambda / WAVE_FIRST);
    for (int i = 0; i < 4; i++) {
      float angle = WIND + (float(i) - 1.5) * SPREAD + float(size) * 0.61;
      vec2 towards = vec2(cos(angle), sin(angle));
      float l = lambda * (1.0 - 0.13 * float(i));
      float cycles = dot(towards, q) / l - uTime / (period * sqrt(l / lambda)) + hash(ivec3(size, i, 7));
      slope += towards * cos(TAU * fract(cycles)) * STEEPNESS * weight * groups;
    }
  }
  return slope;
}

// How far a point lies from the nearest edge of a shifting Voronoi net, in cells: its points circle about
// their own places, so the net flows rather than jumping.
float edgeOf(vec2 p, float t, int salt) {
  vec2 cell = floor(p);
  vec2 f = p - cell;
  float nearest = 8.0;
  float second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      ivec2 c = ivec2(cell) + ivec2(x, y);
      vec2 seed = vec2(hash(ivec3(c, salt)), hash(ivec3(c, salt + 1)));
      vec2 point = vec2(x, y) + 0.5 + 0.38 * sin(t * (0.7 + 0.6 * seed.yx) + TAU * seed) - f;
      float d = dot(point, point);
      if (d < nearest) {
        second = nearest;
        nearest = d;
      } else if (d < second) {
        second = d;
      }
    }
  }
  return sqrt(second) - sqrt(nearest);
}

// Caustics: two warped nets, bright along their lines and brightest where they cross, bent by the slope of
// the surface above them.
float causticAt(vec2 p, vec2 slope) {
  float light = 0.0;
  float t = uTime * CAUSTIC_SPEED;
  for (int size = 0; size < CAUSTIC_SIZES; size++) {
    float weight = uCaustics[size];
    if (weight <= 0.0) {
      continue;
    }
    float cell = CAUSTIC_FIRST * exp2(float(size));
    vec2 q = p / cell + slope * REFRACTION;
    q += (vec2(noise(q * 0.7 + vec2(t * 0.11, 0.0)), noise(q * 0.7 + vec2(17.3, -t * 0.09))) - 0.5) * 0.9;
    float a = exp(-edgeOf(q, t, size * 4) * SHARPNESS);
    float b = exp(-edgeOf(q * 1.31 + vec2(5.2, 9.7), t * 1.23, size * 4 + 2) * SHARPNESS);
    float net = 0.55 * (a + b) + 0.9 * a * b;
    light = max(light, net * weight);
  }
  return light;
}

// Value noise that comes round again every so many cells across, for patterns laid along a river's coordinate,
// which itself comes round every period.
float wrappedNoise(vec2 at, float period) {
  vec2 whole = floor(at);
  vec2 part = at - whole;
  vec2 w = part * part * (3.0 - 2.0 * part);
  int p = max(1, int(period + 0.5));
  ivec2 c = ivec2(whole);
  int x0 = ((c.x % p) + p) % p;
  int x1 = (x0 + 1) % p;
  return mix(
    mix(hash(ivec3(x0, c.y, 3)), hash(ivec3(x1, c.y, 3)), w.x),
    mix(hash(ivec3(x0, c.y + 1, 3)), hash(ivec3(x1, c.y + 1, 3)), w.x),
    w.y
  );
}

void main() {
  vec4 here = waterAt();
  vec4 current = texture(uFlow, vTex);
  vec4 downRiver = texture(uAlong, vTex);
  // A river is a pixel to three of the master wide, so it is never more than a texel and a half from a bank:
  // it keeps its edge where the master has it, firm, or the wander and the fade would wash it away.
  float river = smoothstep(0.2, 0.6, here.w);
  // The shore as the master has it is a staircase of its pixels, a kilometre each; the painted coast wanders
  // off it. So this one wanders too, and the water fades in across it rather than starting on a line.
  float wander = (noise(vWorld / 1.7) - 0.5) * 0.5 + (noise(vWorld / 0.6 + 9.1) - 0.5) * 0.25;
  float shore = here.x + wander * (1.0 - river);
  float aa = max(fwidth(here.x), 0.02);
  float water = smoothstep(-aa, mix(0.5, 0.15, river) + aa, shore) * uFade;
  if (water <= 0.0) {
    discard;
  }
  float lake = here.z;

  // Depth, nought to one: the shelf, the ocean past its edge, the lakes, and the shoaling at the shore.
  float depth = mix(SHELF, 1.0, smoothstep(-SHELF_EDGE, SHELF_EDGE, here.y));
  depth = mix(depth, LAKE_DEPTH, lake);
  float near = 1.0 - smoothstep(0.0, SHORE_REACH, shore);
  depth *= 1.0 - SHOALING * near;
  // A river is all bank, so the shoaling would take it to nothing: it keeps a depth of its own.
  depth = mix(depth, RIVER_DEPTH, river);

  // The water calms towards a beach; a river is all bank and is never calm for it.
  float calm = near * (1.0 - river);

  // A river's current: which way it runs and how fast, nought off the rivers and where no flow is worked out.
  vec2 towards = (current.rg - 0.5) * 2.0;
  // A stranded river is marked with no size at all, and stands still.
  float flowing = clamp(length(towards) * 1.4 - 0.2, 0.0, 1.0) * river * step(0.002, current.b);
  vec2 downstream = flowing > 0.0 ? normalize(towards) : vec2(0.0);
  float riverSpeed = mix(RIVER_SLOWEST, RIVER_FASTEST, current.b) * uRiverSpeed;
  vec2 drift = downstream * riverSpeed * RIVER_CYCLE;
  // Two copies of the surface slide downstream, each starting over once a cycle and faded out as it does, half
  // a cycle apart: the water moves, and a bend never stretches the pattern further than one cycle's slide.
  float phase = fract(uTime / RIVER_CYCLE);
  vec2 first = vWorld - drift * phase;
  vec2 second = vWorld - drift * fract(phase + 0.5);
  float between = abs(1.0 - 2.0 * phase);

  // A river's own surface, laid along it rather than slid over it: ripples across the current, bowed so the
  // middle runs ahead, travelling downstream at the river's speed and broken up so they are not stripes. How far
  // down the river a pixel is runs round its bends, so they follow them. Nothing varies across a river by its
  // distance from the bank: a river is a pixel to three of the master wide, and across it that distance has the
  // pixels' square corners in it.
  float along = atan(downRiver.g - 0.5, downRiver.r - 0.5) / TAU * uAlongPeriod;
  // One speed for every ripple, whatever the river: a speed that changed across a river - and it does, fading
  // towards its banks - would run its middle further ahead of its edges every second, until the ripples
  // sheared into lines along it. Each river's own speed is the specks', which slide and start over.
  float rippleSpeed = mix(RIVER_SLOWEST, RIVER_FASTEST, 0.5) * uRiverSpeed;
  float moved = along + mod(uTime * rippleSpeed, uAlongPeriod);
  float middle = smoothstep(0.0, 1.2, here.x);
  float crestPhase = (moved + uRippleBow * middle) / uRippleSpacing;
  float swell = max(0.5 + 0.5 * cos(TAU * crestPhase), 1e-5);
  float whole = smoothstep(
    0.3,
    0.7,
    wrappedNoise(vec2(moved / (2.0 * uRippleSpacing), middle * 3.0), uAlongPeriod / (2.0 * uRippleSpacing))
  );
  float crest = pow(swell, uRippleSharpness) * whole;
  // Specks of light on the current: fine noise carried downstream on the water's two sliding copies.
  float specks = mix(
    smoothstep(0.72, 0.9, noise(first / 0.45)),
    smoothstep(0.72, 0.9, noise(second / 0.45)),
    between
  );
  float riverLight = (crest * uRippleBright + specks * uSpeckBright) * flowing;
  // The ripples tip the surface as well, so they catch the sun.
  vec2 rippleSlope =
    -downstream * sin(TAU * crestPhase) * pow(swell, max(uRippleSharpness - 1.0, 0.0)) * 0.3 * whole * uRippleBright;

  // The surface, lit.
  vec2 slope = slopeAt(vWorld);
  if (flowing > 0.0) {
    slope = mix(slope, mix(slopeAt(first), slopeAt(second), between) * uRiverWaves + rippleSlope, flowing);
  }
  slope *= 1.0 - 0.6 * calm;
  vec3 normal = normalize(vec3(-slope, 1.0));
  float relief = (dot(normal, SUN) - SUN.z) * RELIEF;
  float glint = pow(max(dot(normal, HALF), 0.0), SHININESS) * GLINT;

  // The light on the bottom, where there is a bottom to see.
  // Brightest a little way out rather than on the sand, where the foam is.
  float bottom = (1.0 - smoothstep(0.0, CAUSTIC_DEEPEST, depth)) * (1.0 - 0.6 * calm * calm);
  float caustic = 0.0;
  if (bottom > 0.0) {
    caustic = causticAt(vWorld, slope);
    if (flowing > 0.0) {
      caustic = mix(
        caustic,
        mix(causticAt(first, slope), causticAt(second, slope), between) * uRiverCaustics,
        flowing
      );
    }
    caustic *= bottom * CAUSTIC_STRENGTH;
  }

  // Surf: foam along the edge, and lines of it coming in, broken up along the shore.
  float wobbly = shore;
  float rolling = fract(wobbly / SURF_SPACING + uTime / SURF_PERIOD);
  float line = smoothstep(0.0, 0.05, rolling) * (1.0 - smoothstep(0.05, 0.4, rolling));
  float broken = smoothstep(0.3, 0.7, noise(vWorld / 1.3 + vec2(uTime * 0.07, 0.0)));
  float edge = (1.0 - smoothstep(0.0, SURF_EDGE, wobbly)) * SURF_EDGE_ALPHA * mix(0.55, 1.0, broken);
  // No surf rolls in on a river: its lines would only trace the square corners of its banks.
  float coming = line * (1.0 - smoothstep(0.0, SURF_REACH, shore)) * SURF_ALPHA * broken * (1.0 - river);
  float foam = max(edge, coming) * mix(1.0, SURF_LAKE, lake) * mix(1.0, SURF_RIVER, river);

  // Premultiplied: the tint, then the waves' light and shade, then the light added, then the foam over it.
  float alpha = mix(SHALLOW_ALPHA, DEEP_ALPHA, depth);
  vec3 rgb = mix(SHALLOW, DEEP, depth) * alpha;
  float lift = max(relief, 0.0);
  float shade = max(-relief, 0.0);
  rgb = rgb * (1.0 - lift) + vec3(lift);
  alpha = lift + alpha * (1.0 - lift);
  rgb *= 1.0 - shade;
  alpha = shade + alpha * (1.0 - shade);
  rgb += CAUSTIC * caustic + vec3(glint) + vec3(riverLight);
  rgb = SURF * foam + rgb * (1.0 - foam);
  alpha = foam + alpha * (1.0 - foam);
  fragColor = vec4(rgb, alpha) * water;
}
`;
