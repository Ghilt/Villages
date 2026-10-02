import type * as maplibregl from 'maplibre-gl';
import { MercatorCoordinate } from 'maplibre-gl';

import { note } from '../log/log';
import { classesOfTile, terrainPalette } from '../geometry/terrainClasses';
import { pixelsPerWorldUnit } from '../geometry/cameraMath';
import { FLAT_MAX_ZOOM, WORLD_MASTER_WIDTH } from '../geometry/world';

import { WATER_LOOK } from './look';
import { DEEP_RANGE, SHORE_RANGE, SIDE, maskOf } from './waterMask';
import type { WaterKinds } from './waterMask';
import { waterStore } from './waterMode';

/**
 * WIP SPIKE: the water, as a MapLibre custom layer drawn over the terrain and under the ink and the fog.
 *
 * Where the water is, how far from the shore and how deep, comes from the flat tiles through `waterMask.ts`,
 * one mask texture a tile. Everything that moves is worked out in the fragment shader from the ground's own
 * coordinates, so it pans with the map and needs no art. Each pattern comes in several sizes that cross-fade
 * by zoom, so it stays put on the ground and about the same size on the screen.
 *
 * The realistic water is five things laid over the painted sea: a tint from turquoise shallows to a dark deep;
 * waves, a sum of travelling slopes lit by a sun in the north-west, which shade the water and throw glints;
 * caustics, a shifting net of light on the bottom of shallow water, bent by the waves above it; and surf, foam
 * along the shore and lines of it rolling in. The wavelets are the first spike's, kept to compare against.
 *
 * MapLibre resets its own GL state after a custom layer draws, so everything here sets what it needs; textures
 * are uploaded only inside `render`, never from a callback, because that would change a binding MapLibre
 * thinks it knows.
 */

export const WATER_LAYER = 'water';

/** Mask tiles kept as textures, a quarter of a megabyte each. */
const REMEMBER = 120;
/** At most this many mask tiles uploaded in one frame, so a jump to a new place does not hitch. */
const UPLOADS_PER_FRAME = 4;
/** How many zooms up a tile may borrow an ancestor's mask while its own is on its way. */
const BORROW = 4;

/**
 * The Flow renderer draws from this zoom in, over at most so many of the flow tiles, which are all zoom 7; an
 * arrow's cell is about so many pixels across.
 */
const FLOW_FROM_ZOOM = 6;
const FLOW_MOST_TILES = 400;
const FLOW_CELL_PIXELS = 26;

const R = WATER_LOOK.realistic;
const W = WATER_LOOK.wavelets;

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const vec = (values: readonly number[]): string => values.map(float).join(', ');

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

const VERTEX = `#version 300 es
precision highp float;
uniform mat4 uMatrix;
// The tile's west and north edges and its side, in mercator from nought to one.
uniform vec3 uTile;
// Which part of the mask texture this tile reads: all of it, or a part of an ancestor's.
uniform vec4 uTexRect;
in vec2 aPos;
out vec2 vTex;
out vec2 vWorld;
void main() {
  vec2 mercator = uTile.xy + aPos * uTile.z;
  vTex = uTexRect.xy + aPos * uTexRect.zw;
  vWorld = mercator * ${float(WORLD_MASTER_WIDTH)};
  gl_Position = uMatrix * vec4(mercator, 0.0, 1.0);
}
`;

const HELPERS = `
in vec2 vTex;
in vec2 vWorld;
uniform sampler2D uMask;
uniform float uTime;
uniform float uScale;
uniform float uFade;
out vec4 fragColor;

const float PI = 3.14159265;
const float TAU = 6.2831853;

float hash(ivec3 cell) {
  uvec3 u = uvec3(cell) * uvec3(1597334673u, 3812015801u, 2798796415u);
  uint n = (u.x ^ u.y ^ u.z) * 1597334673u;
  n ^= n >> 16u;
  n *= 2246822519u;
  n ^= n >> 13u;
  return float(n) / 4294967296.0;
}

float noise(vec2 at) {
  vec2 whole = floor(at);
  vec2 part = at - whole;
  vec2 w = part * part * (3.0 - 2.0 * part);
  ivec2 c = ivec2(whole);
  return mix(
    mix(hash(ivec3(c, 0)), hash(ivec3(c + ivec2(1, 0), 0)), w.x),
    mix(hash(ivec3(c + ivec2(0, 1), 0)), hash(ivec3(c + ivec2(1, 1), 0)), w.x),
    w.y
  );
}

// How far from the shore, in world units and negative inland; how far over the deep ocean; whether a lake;
// whether a river.
vec4 waterAt() {
  vec4 m = texture(uMask, vTex);
  return vec4(
    m.r * ${float(SHORE_RANGE.to - SHORE_RANGE.from)} + ${float(SHORE_RANGE.from)},
    m.g * ${float(DEEP_RANGE.to - DEEP_RANGE.from)} + ${float(DEEP_RANGE.from)},
    m.b,
    m.a
  );
}
`;

const REALISTIC = `#version 300 es
precision highp float;
precision highp int;
${HELPERS}
uniform float uWaves[${R.waves.sizes}];
uniform float uCaustics[${R.caustics.sizes}];
// Which way the rivers run on the map, red east and green south about a half, and blue how big a river.
uniform sampler2D uFlow;

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

void main() {
  vec4 here = waterAt();
  vec4 current = texture(uFlow, vTex);
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
  vec2 drift = downstream * mix(RIVER_SLOWEST, RIVER_FASTEST, current.b) * RIVER_CYCLE;
  // Two copies of the surface slide downstream, each starting over once a cycle and faded out as it does, half
  // a cycle apart: the water moves, and a bend never stretches the pattern further than one cycle's slide.
  float phase = fract(uTime / RIVER_CYCLE);
  vec2 first = vWorld - drift * phase;
  vec2 second = vWorld - drift * fract(phase + 0.5);
  float between = abs(1.0 - 2.0 * phase);

  // The surface, lit.
  vec2 slope = slopeAt(vWorld);
  if (flowing > 0.0) {
    slope = mix(slope, mix(slopeAt(first), slopeAt(second), between), flowing);
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
      caustic = mix(caustic, mix(causticAt(first, slope), causticAt(second, slope), between), flowing);
    }
    caustic *= bottom * CAUSTIC_STRENGTH;
  }

  // Surf: foam along the edge, and lines of it coming in, broken up along the shore.
  float wobbly = shore;
  float rolling = fract(wobbly / SURF_SPACING + uTime / SURF_PERIOD);
  float line = smoothstep(0.0, 0.05, rolling) * (1.0 - smoothstep(0.05, 0.4, rolling));
  float broken = smoothstep(0.3, 0.7, noise(vWorld / 1.3 + vec2(uTime * 0.07, 0.0)));
  float edge = (1.0 - smoothstep(0.0, SURF_EDGE, wobbly)) * SURF_EDGE_ALPHA * mix(0.55, 1.0, broken);
  float coming = line * (1.0 - smoothstep(0.0, SURF_REACH, shore)) * SURF_ALPHA * broken;
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
  rgb += CAUSTIC * caustic + vec3(glint);
  rgb = SURF * foam + rgb * (1.0 - foam);
  alpha = foam + alpha * (1.0 - foam);
  fragColor = vec4(rgb, alpha) * water;
}
`;

const WAVELETS = `#version 300 es
precision highp float;
precision highp int;
${HELPERS}
uniform float uWeights[${W.sizes}];

const int SIZES = ${W.sizes};
const float FIRST_CELL = ${float(W.firstCell)};
const float STEP = ${float(W.step)};
const float DENSITY = ${float(W.density)};
const float SHORTEST = ${float(W.shortestLife)};
const float LONGEST = ${float(W.longestLife)};
const vec2 WIND = vec2(${vec(W.wind)});
const float DRIFT = ${float(W.drift)};
const float ARCH = ${float(W.arch)};
const vec3 CREST = vec3(${vec(W.crest.colour)});
const float CREST_ALPHA = ${float(W.crest.opacity)};
const vec3 TROUGH = vec3(${vec(W.trough.colour)});
const float TROUGH_ALPHA = ${float(W.trough.opacity)};

// The crest and the trough of the wavelet in one size of cell, nought to one each. jx and jy are how far the
// cell coordinates move for one pixel across and one down, worked out before any branch, so the line is as
// thick on the screen however far the camera is tipped.
vec2 wavelet(vec2 world, float cell, int size, vec2 jx, vec2 jy) {
  vec2 g = world / cell;
  vec2 whole = floor(g);
  vec2 f = g - whole;
  ivec2 id = ivec2(whole);
  int salt = size * 16;
  float life = uTime / mix(SHORTEST, LONGEST, hash(ivec3(id, salt))) + hash(ivec3(id, salt + 1));
  float turn = floor(life);
  float u = life - turn;
  int k = int(turn) * 128 + salt;
  if (hash(ivec3(id, k + 2)) > DENSITY) {
    return vec2(0.0);
  }
  vec2 at = vec2(mix(0.3, 0.7, hash(ivec3(id, k + 3))), mix(0.15, 0.85, hash(ivec3(id, k + 4))));
  at += WIND * (u - 0.5) * DRIFT;
  float len = mix(0.12, 0.26, hash(ivec3(id, k + 5))) * (0.8 + 0.35 * u);
  float arch = ARCH * mix(0.6, 1.3, hash(ivec3(id, k + 6)));
  float lean = (hash(ivec3(id, k + 7)) - 0.5) * 0.9;
  vec2 p = f - at;
  float x = p.x / len;
  if (abs(x) >= 1.0) {
    return vec2(0.0);
  }
  float F = p.y + arch * len * (1.0 - x * x) * (1.0 + lean * x);
  vec2 gradient = vec2(arch * (lean - 2.0 * x - 3.0 * lean * x * x), 1.0);
  float perPixel = length(vec2(dot(gradient, jx), dot(gradient, jy)));
  float px = F / max(perPixel, 1e-6);
  float lengthOnScreen = len * cell * uScale;
  float width = clamp(lengthOnScreen * 0.09, 1.3, 3.2) * sqrt(1.0 - x * x);
  float crest = 1.0 - smoothstep(width * 0.5 - 0.5, width * 0.5 + 0.6, abs(px));
  float trough = 1.0 - smoothstep(width * 0.5 - 0.5, width * 0.5 + 0.6, abs(px - width * 1.4));
  float rise = smoothstep(0.0, 0.3, u) * (1.0 - smoothstep(0.55, 1.0, u));
  return vec2(crest, trough) * rise;
}

void main() {
  vec2 jx = dFdx(vWorld);
  vec2 jy = dFdy(vWorld);
  float shore = waterAt().x;
  float aa = max(fwidth(shore), 0.02);
  float water = smoothstep(-aa, aa, shore - 0.3) * uFade;
  if (water <= 0.0) {
    discard;
  }
  float crest = 0.0;
  float trough = 0.0;
  for (int size = 0; size < SIZES; size++) {
    float weight = uWeights[size];
    if (weight <= 0.0) {
      continue;
    }
    float cell = FIRST_CELL * pow(STEP, float(size));
    vec2 mark = wavelet(vWorld, cell, size, jx / cell, jy / cell) * weight;
    crest = max(crest, mark.x);
    trough = max(trough, mark.y);
  }
  float a1 = trough * TROUGH_ALPHA * (1.0 - crest);
  float a2 = crest * CREST_ALPHA;
  vec3 rgb = TROUGH * a1;
  float alpha = a1;
  rgb = CREST * a2 + rgb * (1.0 - a2);
  alpha = a2 + alpha * (1.0 - a2);
  fragColor = vec4(rgb, alpha) * water;
}
`;

/*
 * The Flow renderer, in place of the water: which way every river runs, read straight from the flow tiles and
 * nearest, so a texel is a square and nothing is smoothed over. A colour for each way - east red, south
 * yellow-green, west cyan, north violet - and close enough in, a white arrow in every cell that marches
 * downstream at the river's own speed and starts again at the back. Black is a stranded river, with no way to
 * any sea or lake: a break in the master's rivers to mend.
 */
const FLOW = `#version 300 es
precision highp float;
precision highp int;

in vec2 vTex;
in vec2 vWorld;
uniform sampler2D uFlow;
uniform float uTime;
uniform float uScale;
// How big a cell of arrows is, in world units, and how much of the arrows to draw at this zoom.
uniform float uCell;
uniform float uMarch;
out vec4 fragColor;

const float TAU = 6.2831853;
const float SLOWEST = ${float(R.rivers.slowest)};
const float FASTEST = ${float(R.rivers.fastest)};

float hash(ivec2 cell) {
  uvec2 u = uvec2(cell) * uvec2(1597334673u, 3812015801u);
  uint n = (u.x ^ u.y) * 1597334673u;
  n ^= n >> 16u;
  return float(n) / 4294967296.0;
}

vec3 hueOf(float turn) {
  return clamp(abs(mod(turn * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

void main() {
  vec4 current = texelFetch(uFlow, ivec2(clamp(vTex * ${float(SIDE)}, 0.0, ${float(SIDE - 1)})), 0);
  vec2 towards = (current.rg - 0.5) * 2.0;
  float size = current.b;
  bool stranded = size < 0.002 && length(towards) > 1.2;
  bool flowing = size >= 0.002 && length(towards) > 0.3;
  if (!stranded && !flowing) {
    discard;
  }
  if (stranded) {
    fragColor = vec4(0.05, 0.05, 0.06, 1.0);
    return;
  }
  vec2 downstream = normalize(towards);
  vec3 colour = hueOf(fract(atan(downstream.y, downstream.x) / TAU)) * 0.85 + 0.1;
  if (uMarch > 0.0) {
    // Pixels from the middle of this pixel's cell, turned so x runs downstream; the arrow slides along x.
    vec2 cell = floor(vWorld / uCell);
    vec2 local = (vWorld - (cell + 0.5) * uCell) * uScale;
    float across = uCell * uScale;
    float march = fract(uTime * mix(SLOWEST, FASTEST, size) * uScale / across + hash(ivec2(cell)));
    vec2 q = vec2(dot(local, downstream), dot(local, vec2(-downstream.y, downstream.x)));
    q.x -= (march - 0.5) * across * 0.8;
    float arrow = min(segment(q, vec2(5.0, 0.0), vec2(-2.0, 5.0)), segment(q, vec2(5.0, 0.0), vec2(-2.0, -5.0)));
    arrow = min(arrow, segment(q, vec2(5.0, 0.0), vec2(-7.0, 0.0)));
    float ink = (1.0 - smoothstep(0.9, 1.9, arrow)) * (1.0 - smoothstep(0.32, 0.46, abs(march - 0.5)));
    colour = mix(colour, vec3(1.0), ink * uMarch);
  }
  fragColor = vec4(colour, 1.0);
}
`;

interface MaskTile {
  /** Null while it is being worked out, or once it is known to hold no water. */
  texture: WebGLTexture | null;
  /** A mask worked out and waiting to be uploaded in the next frame. */
  pending: Uint8Array | null;
  state: 'loading' | 'ready' | 'dry';
  used: number;
  /** Which way its rivers run, from `npm run world:flow`, once it has arrived; null for a tile with none. */
  flow: WebGLTexture | null;
  flowPending: Uint8Array | null;
}

interface Program {
  program: WebGLProgram;
  where: Record<string, WebGLUniformLocation | null>;
}

const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** How much of each size of a pattern to draw, by how big it is on the screen against its size band. */
function weightsOf(first: number, step: number, sizes: number, band: readonly number[], scale: number) {
  const [fadeIn, whole, fading, gone] = band as [number, number, number, number];
  const weights = new Float32Array(sizes);
  for (let size = 0; size < sizes; size += 1) {
    const onScreen = first * step ** size * scale;
    weights[size] = smoothstep(fadeIn, whole, onScreen) * (1 - smoothstep(fading, gone, onScreen));
  }
  return weights;
}

function link(gl: WebGL2RenderingContext, fragment: string, uniforms: readonly string[]): Program {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`water shader: ${gl.getShaderInfoLog(shader) ?? 'did not compile'}`);
    }
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`water program: ${gl.getProgramInfoLog(program) ?? 'did not link'}`);
  }
  const where: Record<string, WebGLUniformLocation | null> = {};
  for (const name of ['uMatrix', 'uTile', 'uTexRect', 'uMask', 'uTime', 'uScale', 'uFade', ...uniforms]) {
    where[name] = gl.getUniformLocation(program, name);
  }
  return { program, where };
}

export function createWaterLayer(worldRoot: string): maplibregl.CustomLayerInterface {
  let map: maplibregl.Map | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let realistic: Program | null = null;
  let wavelets: Program | null = null;
  let flowProgram: Program | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let buffer: WebGLBuffer | null = null;
  const tiles = new Map<string, MaskTile>();
  let kinds: WaterKinds | null = null;
  let frame = 0;
  let nextFrame: ReturnType<typeof setTimeout> | null = null;
  let said = false;
  const started = performance.now();

  void terrainPalette().then((palette) => {
    const ids = (names: readonly string[]) =>
      new Set(palette.classes.filter((one) => names.includes(one.name)).map((one) => one.id));
    kinds = {
      deep: ids(['ocean']),
      shallow: ids(['shallow-sea', 'lake', 'river']),
      lake: ids(['lake']),
      river: ids(['river']),
    };
    map?.triggerRepaint();
  });

  let flowSet: Set<string> | null = null;
  // Which tiles have their rivers' flow worked out. A master never run through `npm run world:flow` has none,
  // and its rivers stand still, which the log says once.
  const flowTiles = fetch(`${worldRoot}/flow/flow.json`)
    .then(async (response) => (response.ok ? ((await response.json()) as { tiles: string[] }) : null))
    .catch(() => null)
    .then((file) => {
      note(
        'water',
        file === null
          ? 'no river flow worked out for this master, so its rivers stand still: npm run world:flow --prefix frontend'
          : `rivers run downstream: their flow is worked out over ${file.tiles.length} tiles`,
      );
      flowSet = new Set(file?.tiles ?? []);
      return flowSet;
    });

  /** One tile of flow as RGBA, or null if it will not come. */
  const flowPixels = async (x: number, y: number): Promise<Uint8Array | null> => {
    try {
      const response = await fetch(`${worldRoot}/flow/${FLAT_MAX_ZOOM}/${x}/${y}.png`);
      if (!response.ok) {
        return null;
      }
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(SIDE, SIDE);
      const drawing = canvas.getContext('2d', { willReadFrequently: true });
      if (drawing === null) {
        return null;
      }
      drawing.drawImage(bitmap, 0, 0);
      bitmap.close();
      return new Uint8Array(drawing.getImageData(0, 0, SIDE, SIDE).data.buffer);
    } catch {
      return null;
    }
  };
  /** The Flow renderer's tiles, apart from the water's, because it needs no mask and reaches further out. */
  const viewTiles = new Map<
    string,
    { texture: WebGLTexture | null; pending: Uint8Array | null; used: number }
  >();

  const flowOf = async (z: number, x: number, y: number, tile: MaskTile) => {
    if (z !== FLAT_MAX_ZOOM || !(await flowTiles).has(`${x}/${y}`)) {
      return;
    }
    const pixels = await flowPixels(x, y);
    if (pixels !== null) {
      tile.flowPending = pixels;
      map?.triggerRepaint();
    }
  };

  // Working out a mask is a few distance transforms, a handful of milliseconds; one at a time, between frames.
  const jobs: (() => void)[] = [];
  let pumping = false;
  const pump = () => {
    jobs.shift()?.();
    if (jobs.length > 0) {
      setTimeout(pump, 0);
    } else {
      pumping = false;
    }
  };
  const later = (job: () => void) => {
    jobs.push(job);
    if (!pumping) {
      pumping = true;
      setTimeout(pump, 0);
    }
  };

  const read = (key: string, z: number, x: number, y: number): MaskTile => {
    const tile: MaskTile = {
      texture: null,
      pending: null,
      state: 'loading',
      used: frame,
      flow: null,
      flowPending: null,
    };
    tiles.set(key, tile);
    void flowOf(z, x, y, tile);
    void terrainPalette().then(async (palette) => {
      const around = await Promise.all(
        [-1, 0, 1].flatMap((dy) =>
          [-1, 0, 1].map((dx) => classesOfTile(worldRoot, z, x + dx, y + dy, palette)),
        ),
      );
      later(() => {
        if (tiles.get(key) !== tile) {
          return;
        }
        // Gone from the view while it waited: forgotten, to be asked for again if it comes back.
        if (tile.used < frame - 30) {
          tiles.delete(key);
          return;
        }
        const mask = kinds === null ? null : maskOf(around, 2 ** (FLAT_MAX_ZOOM - z), kinds);
        if (mask === null) {
          tile.state = 'dry';
          return;
        }
        tile.pending = mask;
        map?.triggerRepaint();
      });
    });
    return tile;
  };

  const textureOf = (data: Uint8Array, side: number): WebGLTexture => {
    const context = gl!;
    const texture = context.createTexture();
    context.bindTexture(context.TEXTURE_2D, texture);
    context.pixelStorei(context.UNPACK_ALIGNMENT, 1);
    context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, false);
    context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    context.texImage2D(
      context.TEXTURE_2D,
      0,
      context.RGBA8,
      side,
      side,
      0,
      context.RGBA,
      context.UNSIGNED_BYTE,
      data,
    );
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
    return texture;
  };
  const upload = (tile: MaskTile) => {
    tile.texture = textureOf(tile.pending!, SIDE);
    tile.pending = null;
    tile.state = 'ready';
  };
  /** For a tile with no rivers, or none worked out: no current anywhere in it. */
  let still: WebGLTexture | null = null;

  const forget = () => {
    if (tiles.size <= REMEMBER) {
      return;
    }
    const oldest = [...tiles.entries()]
      .filter(([, tile]) => tile.used < frame && tile.state !== 'loading')
      .sort((a, b) => a[1].used - b[1].used);
    for (const [key, tile] of oldest.slice(0, tiles.size - REMEMBER)) {
      if (tile.texture !== null) {
        gl!.deleteTexture(tile.texture);
      }
      if (tile.flow !== null) {
        gl!.deleteTexture(tile.flow);
      }
      tiles.delete(key);
    }
  };

  /** The tiles of a zoom the view covers, from its four corners, which a tipped camera needs. */
  const tilesInView = (level: number) => {
    const across = 2 ** level;
    const canvas = map!.getCanvas();
    let west = 1;
    let north = 1;
    let east = 0;
    let south = 0;
    for (const [x, y] of [
      [0, 0],
      [canvas.clientWidth, 0],
      [0, canvas.clientHeight],
      [canvas.clientWidth, canvas.clientHeight],
    ] as const) {
      const ground = MercatorCoordinate.fromLngLat(map!.unproject([x, y]));
      west = Math.min(west, ground.x);
      east = Math.max(east, ground.x);
      north = Math.min(north, ground.y);
      south = Math.max(south, ground.y);
    }
    return {
      across,
      fromX: Math.max(0, Math.floor(west * across)),
      toX: Math.min(across - 1, Math.floor(east * across)),
      fromY: Math.max(0, Math.floor(north * across)),
      toY: Math.min(across - 1, Math.floor(south * across)),
    };
  };

  /** Keeps the water moving at its own frame rate while something of it is on the screen. */
  const keepMoving = () => {
    if (nextFrame === null) {
      nextFrame = setTimeout(() => {
        nextFrame = null;
        map?.triggerRepaint();
      }, 1000 / WATER_LOOK.framesPerSecond);
    }
  };

  /** The Flow renderer: every river in view coloured by which way it runs, from the flow tiles alone. */
  const drawFlow = (context: WebGL2RenderingContext, options: maplibregl.CustomRenderMethodInput) => {
    const zoom = map!.getZoom();
    if (flowProgram === null || flowSet === null || zoom < FLOW_FROM_ZOOM) {
      return;
    }
    const { across, fromX, toX, fromY, toY } = tilesInView(FLAT_MAX_ZOOM);
    if ((toX - fromX + 1) * (toY - fromY + 1) > FLOW_MOST_TILES) {
      return;
    }
    const scale = pixelsPerWorldUnit(zoom);
    const { program, where } = flowProgram;
    context.useProgram(program);
    context.bindVertexArray(vao);
    context.disable(context.DEPTH_TEST);
    context.disable(context.STENCIL_TEST);
    context.enable(context.BLEND);
    context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
    context.activeTexture(context.TEXTURE0);
    context.uniformMatrix4fv(where.uMatrix!, false, options.defaultProjectionData.mainMatrix);
    context.uniform1i(where.uFlow!, 0);
    context.uniform1f(where.uTime!, ((performance.now() - started) / 1000) % 3600);
    context.uniform1f(where.uScale!, scale);
    context.uniform1f(where.uCell!, FLOW_CELL_PIXELS / scale);
    context.uniform1f(where.uMarch!, smoothstep(2.5, 4, scale));
    context.uniform4f(where.uTexRect!, 0, 0, 1, 1);
    let uploads = 0;
    let drawn = 0;
    for (let y = fromY; y <= toY; y += 1) {
      for (let x = fromX; x <= toX; x += 1) {
        const key = `${x}/${y}`;
        if (!flowSet.has(key)) {
          continue;
        }
        let tile = viewTiles.get(key);
        if (tile === undefined) {
          const fresh = { texture: null, pending: null, used: frame } as {
            texture: WebGLTexture | null;
            pending: Uint8Array | null;
            used: number;
          };
          viewTiles.set(key, fresh);
          void flowPixels(x, y).then((pixels) => {
            fresh.pending = pixels;
            map?.triggerRepaint();
          });
          tile = fresh;
        }
        tile.used = frame;
        if (tile.pending !== null && uploads < UPLOADS_PER_FRAME) {
          tile.texture = textureOf(tile.pending, SIDE);
          tile.pending = null;
          uploads += 1;
        }
        if (tile.texture === null) {
          continue;
        }
        context.bindTexture(context.TEXTURE_2D, tile.texture);
        context.uniform3f(where.uTile!, x / across, y / across, 1 / across);
        context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
        drawn += 1;
      }
    }
    context.bindVertexArray(null);
    if (viewTiles.size > FLOW_MOST_TILES) {
      const oldest = [...viewTiles.entries()].sort((a, b) => a[1].used - b[1].used);
      for (const [key, tile] of oldest.slice(0, viewTiles.size - FLOW_MOST_TILES)) {
        if (tile.used === frame) {
          break;
        }
        if (tile.texture !== null) {
          gl!.deleteTexture(tile.texture);
        }
        viewTiles.delete(key);
      }
    }
    if (drawn > 0) {
      keepMoving();
    }
  };

  return {
    id: WATER_LAYER,
    type: 'custom',
    renderingMode: '2d',

    onAdd(added, context) {
      map = added;
      gl = context as WebGL2RenderingContext;
      realistic = link(gl, REALISTIC, ['uWaves', 'uCaustics', 'uFlow']);
      still = textureOf(new Uint8Array([128, 128, 0, 255]), 1);
      wavelets = link(gl, WAVELETS, ['uWeights']);
      flowProgram = link(gl, FLOW, ['uFlow', 'uCell', 'uMarch']);
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindVertexArray(null);
    },

    render(context, options) {
      frame += 1;
      const { mode, flowView } = waterStore.get();
      if (flowView) {
        drawFlow(context, options);
        return;
      }
      const zoom = map!.getZoom();
      const fade = smoothstep(WATER_LOOK.fromZoom - 0.5, WATER_LOOK.fromZoom + 0.5, zoom);
      const drawing = mode === 'realistic' ? realistic : wavelets;
      if (mode === 'still' || fade <= 0 || kinds === null || drawing === null) {
        return;
      }

      // Which mask tiles the view needs: the flat tiles a zoom coarser than the camera, so a mask texel is
      // a couple of pixels until the master's own pixels run out at the flat tiles' deepest zoom.
      const level = Math.max(0, Math.min(FLAT_MAX_ZOOM, Math.floor(zoom)));
      const { across, fromX, toX, fromY, toY } = tilesInView(level);

      const scale = pixelsPerWorldUnit(zoom);
      const { program, where } = drawing;
      context.useProgram(program);
      context.bindVertexArray(vao);
      context.disable(context.DEPTH_TEST);
      context.disable(context.STENCIL_TEST);
      context.enable(context.BLEND);
      context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
      context.activeTexture(context.TEXTURE0);
      context.uniformMatrix4fv(where.uMatrix!, false, options.defaultProjectionData.mainMatrix);
      context.uniform1i(where.uMask!, 0);
      context.uniform1f(where.uTime!, ((performance.now() - started) / 1000) % 3600);
      context.uniform1f(where.uScale!, scale);
      context.uniform1f(where.uFade!, fade);
      if (mode === 'realistic') {
        context.uniform1fv(where.uWaves!, weightsOf(R.waves.first, 2, R.waves.sizes, R.waves.band, scale));
        context.uniform1fv(
          where.uCaustics!,
          weightsOf(R.caustics.first, 2, R.caustics.sizes, R.caustics.band, scale),
        );
        context.uniform1i(where.uFlow!, 1);
      } else {
        context.uniform1fv(where.uWeights!, weightsOf(W.firstCell, W.step, W.sizes, W.band, scale));
      }

      let uploads = 0;
      let drawn = 0;
      for (let y = fromY; y <= toY; y += 1) {
        for (let x = fromX; x <= toX; x += 1) {
          const key = `${level}/${x}/${y}`;
          const tile = tiles.get(key) ?? read(key, level, x, y);
          tile.used = frame;
          if (tile.pending !== null && uploads < UPLOADS_PER_FRAME) {
            upload(tile);
            uploads += 1;
          }
          if (tile.flowPending !== null && uploads < UPLOADS_PER_FRAME) {
            tile.flow = textureOf(tile.flowPending, SIDE);
            tile.flowPending = null;
            uploads += 1;
          }
          // Its own mask, or while that is on its way the part of an ancestor's that covers it.
          let source: MaskTile | undefined = tile;
          let up = 0;
          while (source !== undefined && source.state === 'loading' && up < BORROW && level - up > 0) {
            up += 1;
            source = tiles.get(`${level - up}/${x >> up}/${y >> up}`);
          }
          if (source === undefined || source.state !== 'ready' || source.texture === null) {
            continue;
          }
          source.used = frame;
          const part = 1 / 2 ** up;
          // A borrowed mask has no flow that lines up with it; the river stands still until its own arrives.
          context.activeTexture(context.TEXTURE1);
          context.bindTexture(context.TEXTURE_2D, up === 0 && source.flow !== null ? source.flow : still);
          context.activeTexture(context.TEXTURE0);
          context.bindTexture(context.TEXTURE_2D, source.texture);
          context.uniform3f(where.uTile!, x / across, y / across, 1 / across);
          context.uniform4f(
            where.uTexRect!,
            (x - ((x >> up) << up)) * part,
            (y - ((y >> up) << up)) * part,
            part,
            part,
          );
          context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
          drawn += 1;
        }
      }
      context.bindVertexArray(null);
      forget();

      if (drawn > 0 && !said) {
        said = true;
        note('water', `drawn over ${drawn} tiles of sea, lake and river at zoom ${level}`);
      }

      // The water moves at its own frame rate, and only while some of it is on the screen: this is the one
      // thing keeping the map redrawing while nothing else changes.
      if (drawn > 0) {
        keepMoving();
      }
    },

    onRemove() {
      if (nextFrame !== null) {
        clearTimeout(nextFrame);
      }
      for (const tile of tiles.values()) {
        if (tile.texture !== null) {
          gl?.deleteTexture(tile.texture);
        }
        if (tile.flow !== null) {
          gl?.deleteTexture(tile.flow);
        }
      }
      tiles.clear();
      gl?.deleteTexture(still);
      gl?.deleteProgram(realistic?.program ?? null);
      gl?.deleteProgram(wavelets?.program ?? null);
      gl?.deleteProgram(flowProgram?.program ?? null);
      for (const tile of viewTiles.values()) {
        if (tile.texture !== null) {
          gl?.deleteTexture(tile.texture);
        }
      }
      viewTiles.clear();
      gl?.deleteBuffer(buffer);
      gl?.deleteVertexArray(vao);
      map = null;
    },
  };
}

/** Puts the water on the map, over whichever renderer is drawing the terrain and under the ink lines. */
export function placeWater(map: maplibregl.Map, worldRoot: string): void {
  if (map.getLayer('lake-shore') === undefined) {
    // Someone else's map, through VITE_MAP_STYLE_URL: there are no flat tiles to find the water in.
    return;
  }
  if (map.getLayer(WATER_LAYER) === undefined) {
    map.addLayer(createWaterLayer(worldRoot), 'lake-shore');
  } else {
    map.moveLayer(WATER_LAYER, 'lake-shore');
  }
}
