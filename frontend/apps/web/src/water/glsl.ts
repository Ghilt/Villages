import { WORLD_MASTER_WIDTH } from '../geometry/world';

import { DEEP_RANGE, SHORE_RANGE } from './waterMask';

/**
 * What every one of the water's shaders shares. A number as GLSL writes it, so a look's numbers can be
 * written into the shaders' text; the vertex shader, which lays a quad over one tile; and the fragment shaders'
 * common part: the tile's mask, read back as how far from the shore and the deep, a hash and value noise.
 */

export const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
export const vec = (values: readonly number[]): string => values.map(float).join(', ');

export const VERTEX = `#version 300 es
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

export const HELPERS = `
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
