import { WATER_LOOK } from './look';
import { HELPERS, float, vec } from './glsl';

/**
 * WIP SPIKE: the first spike's water, kept to compare against: little wavelets coming and going, a crest and a
 * trough each, in a few sizes that cross-fade by zoom.
 */

const W = WATER_LOOK.wavelets;

export const WAVELETS = `#version 300 es
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
