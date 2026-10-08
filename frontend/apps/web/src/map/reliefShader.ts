import { WORLD_MASTER_WIDTH } from '../geometry/world';

/**
 * The relief's own shaders (experiment 0017): the ground shaded by its slope, worked out for every pixel from a
 * tile's heights, or with pixels on, once for the middle of the lattice cell the pixel lies in, the turned
 * diamonds the painted renderers draw their cells as, in a few hard tones.
 *
 * A tile's heights come with a margin of its neighbours' (`reliefTiles.ts`), so the slope at its edge reads the
 * ground on both sides of it and two tiles agree where they meet: no seam.
 */

/** How many of the neighbours' texels each side of a tile's own texture carries. */
export const MARGIN = 4;

const WORLD = WORLD_MASTER_WIDTH.toFixed(1);

export const RELIEF_VERTEX = `#version 300 es
precision highp float;
uniform mat4 uMatrix;
// The square drawn, its west and north edges and its side, in mercator from nought to one: the tile itself, or
// while it is on its way, the part of a coarser tile that stands in for it.
uniform vec3 uQuad;
in vec2 aPos;
out vec2 vWorld;
void main() {
  vec2 mercator = uQuad.xy + aPos * uQuad.z;
  vWorld = mercator * ${WORLD};
  gl_Position = uMatrix * vec4(mercator, 0.0, 1.0);
}
`;

export const RELIEF_FRAGMENT = `#version 300 es
precision highp float;
// Whole metres.
uniform highp isampler2D uHeights;
// The tile the heights are of, as uQuad is given.
uniform vec3 uTile;
// The lattice: the cosine and sine of its turn, and a cell's side in world units.
uniform vec3 uLattice;
uniform bool uPixels;
// How many hard tones each side of flat, or nought for none.
uniform float uTones;
uniform float uExaggeration;
// How far a slope is from flat before it is shaded or lit through.
uniform float uGain;
// The shade's and the light's alpha at their fullest.
uniform vec2 uAlpha;
// Towards the light: east, north and up.
uniform vec3 uSun;
uniform vec3 uShadeColour;
uniform vec3 uLightColour;
in vec2 vWorld;
out vec4 fragColor;

const float WORLD = ${WORLD};
const float EARTH = 40075016.686;
const float SIDE = 256.0;
const float MARGIN = ${MARGIN.toFixed(1)};

float texel(ivec2 at) {
  return float(texelFetch(uHeights, clamp(at, ivec2(0), textureSize(uHeights, 0) - 1), 0).r);
}

// The height at a place in world units, between the four nearest texel middles.
float heightAt(vec2 world) {
  vec2 t = (world / WORLD - uTile.xy) / uTile.z * SIDE + MARGIN - 0.5;
  vec2 whole = floor(t);
  vec2 w = t - whole;
  ivec2 i = ivec2(whole);
  return mix(
    mix(texel(i), texel(i + ivec2(1, 0)), w.x),
    mix(texel(i + ivec2(0, 1)), texel(i + ivec2(1, 1)), w.x),
    w.y
  );
}

// The middle of the lattice cell a place lies in, as painterly.ts's onLattice finds it.
vec2 cellMiddle(vec2 p) {
  float u = floor((p.x * uLattice.x + p.y * uLattice.y) / uLattice.z) + 0.5;
  float v = floor((p.y * uLattice.x - p.x * uLattice.y) / uLattice.z) + 0.5;
  return vec2(u * uLattice.x - v * uLattice.y, u * uLattice.y + v * uLattice.x) * uLattice.z;
}

void main() {
  vec2 p = uPixels ? cellMiddle(vWorld) : vWorld;
  // One texel either side, in world units: a slope over the ground the heights can tell apart.
  float step = uTile.z * WORLD / SIDE;
  float east = heightAt(p + vec2(step, 0.0)) - heightAt(p - vec2(step, 0.0));
  float north = heightAt(p - vec2(0.0, step)) - heightAt(p + vec2(0.0, step));
  float lat = atan(sinh(3.14159265 * (1.0 - 2.0 * p.y / WORLD)));
  float metres = 2.0 * step * EARTH / WORLD * cos(lat);
  vec3 normal = normalize(vec3(-vec2(east, north) / metres * uExaggeration, 1.0));
  // Nought on the flat, below it turned from the light, above it turned towards it.
  float lit = clamp((dot(normal, uSun) - uSun.z) * uGain, -1.0, 1.0);
  if (uTones > 0.5) {
    lit = floor(lit * uTones + 0.5) / uTones;
  }
  fragColor = lit < 0.0
    ? vec4(uShadeColour, 1.0) * (-lit * uAlpha.x)
    : vec4(uLightColour, 1.0) * (lit * uAlpha.y);
}
`;
