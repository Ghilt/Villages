import { WORLD_MASTER_WIDTH } from '../../geometry/world';

import { CLOUD_LOOK } from './look';

/**
 * The clouds, worked out a pixel at a time over the whole screen, as the grass is: one triangle that covers it,
 * and for each pixel the ground under it, found by the sprites' own projection backwards.
 *
 * The field the clouds are cut from is laid out along the wind: a slow pattern of patches, stretched along it so
 * the clumps gather in loose rows with clear stretches between, and the clumps themselves, a sum of noise at
 * halving sizes, each faded in and out by how big it is on the screen. Every size repeats along the wind once
 * every 32768 world units, the world's width, and the wind's carrying is handed in modulo that, worked out on
 * the processor from the wall clock: `cloudClock.ts`. Every number is in `look.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => rgb.map(float).join(', ');

const WIND = (CLOUD_LOOK.wind * Math.PI) / 180;

export const CLOUD_VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 uSize;
out vec2 vScreen;
void main() {
  vScreen = vec2((aPosition.x + 1.0) * 0.5 * uSize.x, (1.0 - aPosition.y) * 0.5 * uSize.y);
  // Drawn into a picture of its own, which WebGL keeps bottom row first and Pixi shows the other way up: so it
  // is drawn upside down, to be shown the right way.
  gl_Position = vec4(aPosition.x, -aPosition.y, 0.0, 1.0);
}
`;

export const CLOUD_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vScreen;
uniform vec2 uSize;
uniform vec2 uCentre;
uniform float uScale;
uniform vec3 uTilt;
// How much of the clouds the camera's band draws, nought to one: cloudBands.ts.
uniform float uAmount;
// How far the wind has carried the patches, the clumps and their finer detail, in world units modulo the period.
uniform vec3 uCarried;
// Each lattice's cell along the wind, in world units, and how many of its cells go round the period.
uniform vec2 uClumps;
uniform vec2 uPatches;
// How much of the sky is cloud, how much the patches decide where, and how soft an edge is.
uniform float uCover;
uniform float uPatchWeight;
uniform float uEdge;
out vec4 fragColor;

const float TAU = 6.2831853;
const float WORLD = ${float(WORLD_MASTER_WIDTH)};
const vec2 ALONG = vec2(${float(Math.cos(WIND))}, ${float(Math.sin(WIND))});
const vec2 ACROSS = vec2(${float(-Math.sin(WIND))}, ${float(Math.cos(WIND))});
const vec3 THIN = vec3(${colour(CLOUD_LOOK.thin)});
const vec3 THICK = vec3(${colour(CLOUD_LOOK.thick)});
const float OPACITY = ${float(CLOUD_LOOK.opacity)};

float hash(ivec2 cell, int salt) {
  uvec3 u = uvec3(ivec3(cell, salt)) * uvec3(1597334673u, 3812015801u, 2798796415u);
  uint n = (u.x ^ u.y ^ u.z) * 1597334673u;
  n ^= n >> 16u;
  n *= 2246822519u;
  n ^= n >> 13u;
  return float(n) / 4294967296.0;
}

// One corner's slope, for a lattice that comes round every \`around\` cells along the wind.
float corner(vec2 cell, vec2 from, float around, int salt) {
  float angle = TAU * hash(ivec2(int(mod(cell.x, around)), int(cell.y)), salt);
  return dot(vec2(cos(angle), sin(angle)), from);
}

// Gradient noise, about -0.7 to 0.7, repeating every \`around\` cells along the wind.
float noise(vec2 at, float around, int salt) {
  vec2 whole = floor(at);
  vec2 part = at - whole;
  vec2 w = part * part * part * (part * (part * 6.0 - 15.0) + 10.0);
  float a = corner(whole, part, around, salt);
  float b = corner(whole + vec2(1.0, 0.0), part - vec2(1.0, 0.0), around, salt);
  float c = corner(whole + vec2(0.0, 1.0), part - vec2(0.0, 1.0), around, salt);
  float d = corner(whole + vec2(1.0, 1.0), part - vec2(1.0, 1.0), around, salt);
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

vec2 groundUnder(vec2 screen) {
  vec2 onScreen = screen - uSize * 0.5;
  float along = onScreen.y / max(uTilt.z, 0.0001);
  vec2 ground = vec2(onScreen.x * uTilt.x - along * uTilt.y, onScreen.x * uTilt.y + along * uTilt.x);
  return uCentre + ground / uScale;
}

// The patches the clumps gather in, about -1 to 1: four times longer along the wind than across it.
float patches(vec2 wind) {
  vec2 at = vec2((wind.x - uCarried.x) / uPatches.x, wind.y * 4.0 / uPatches.x);
  return noise(at, uPatches.y, 1) + 0.5 * noise(at * 2.0 + vec2(0.0, 17.0), uPatches.y * 2.0, 2);
}

// The clumps, about -1 to 1: noise at halving sizes, the two coarsest carried with the patches and the finer ones
// as the detail is, each faded out as it shrinks towards a couple of pixels on the screen.
float clumps(vec2 wind) {
  float sum = 0.0;
  float amplitude = 1.0;
  float cell = uClumps.x;
  float around = uClumps.y;
  for (int k = 0; k < 7; k += 1) {
    float shown = smoothstep(2.0, 6.0, cell * uScale);
    if (shown <= 0.0) break;
    float carried = k < 2 ? uCarried.y : uCarried.z;
    vec2 at = vec2((wind.x - carried) / cell, wind.y / cell + float(k) * 31.7);
    sum += amplitude * shown * noise(at, around, 10 + k);
    amplitude *= 0.5;
    cell *= 0.5;
    around *= 2.0;
  }
  return sum;
}

void main() {
  vec2 ground = groundUnder(vScreen);
  // Nothing off the world's square, where the desk shows; worked out to the end all the same, because the soft
  // edges are measured across each two by two block of pixels and a pixel that stopped early would spoil it.
  float inWorld = step(0.0, ground.x) * step(0.0, ground.y) * step(ground.x, WORLD) * step(ground.y, WORLD);
  // Across the wind is lifted by the world's width, so every lattice row the hash is asked about is positive.
  vec2 wind = vec2(dot(ground, ALONG), dot(ground, ACROSS) + WORLD);
  float field = 0.5 + 0.5 * clumps(wind) + uPatchWeight * patches(wind);
  float cut = 0.5 + 0.4 * (1.0 - 2.0 * uCover);
  float soft = max(uEdge, fwidth(field));
  float cloud = smoothstep(cut - soft, cut + soft, field);
  vec3 rgb = mix(THIN, THICK, smoothstep(cut, cut + 0.12, field));
  fragColor = vec4(rgb, 1.0) * (cloud * OPACITY * uAmount * inWorld);
}
`;
