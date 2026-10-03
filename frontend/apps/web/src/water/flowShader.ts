import { WATER_LOOK } from './look';
import { float } from './glsl';
import { SIDE } from './waterMask';

const R = WATER_LOOK.realistic;

/*
 * The Flow renderer, in place of the water: which way every river runs, read straight from the flow tiles and
 * nearest, so a texel is a square and nothing is smoothed over. A colour for each way - east red, south
 * yellow-green, west cyan, north violet - and close enough in, a white arrow in every cell that marches
 * downstream at the river's own speed and starts again at the back. Black is a stranded river, with no way to
 * any sea or lake: a break in the master's rivers to mend.
 */
export const FLOW = `#version 300 es
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
