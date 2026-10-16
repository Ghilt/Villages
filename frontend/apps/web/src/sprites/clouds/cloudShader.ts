import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { LIGHT_COLOUR, SHADE_COLOUR, towardsTheLight } from '../../map/light';

import { CLOUD_LOOK } from './look';

/**
 * The clouds, worked out a pixel at a time over the whole screen, as the grass is: one triangle that covers it,
 * and for each pixel the ground under it, found by the sprites' own projection backwards.
 *
 * The field the clouds are cut from is laid out along the wind: a slow pattern of patches, stretched along it so
 * the clumps gather in loose rows with clear stretches between, and the clumps themselves, a sum of noise at
 * halving sizes, the second and third folded into rounded lobes, each faded in and out by how big it is on the
 * screen. A slow warp pushes the clumps about, and drifts past them with the finer detail, so they change shape as
 * they go; a brush stretched along the wind breaks their edges. They are painted in three flat tones by which way
 * the field falls off towards the light: the relief's cream on the side the sun strikes, white, and a violet-grey on
 * the far side, as the hills are shaded. Every size repeats along the wind once every 32768 world units, the world's
 * width, and the wind's carrying is handed in modulo that, worked out on the processor from the wall clock:
 * `cloudClock.ts`. Every number is in `look.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => rgb.map(float).join(', ');

const WIND = (CLOUD_LOOK.wind * Math.PI) / 180;
const ALONG = [Math.cos(WIND), Math.sin(WIND)] as const;
const ACROSS = [-Math.sin(WIND), Math.cos(WIND)] as const;
const LIGHT = towardsTheLight();
/** Towards the light in the wind's own frame: along it and across it. */
const SUN = [
  LIGHT.east * ALONG[0] + LIGHT.south * ALONG[1],
  LIGHT.east * ACROSS[0] + LIGHT.south * ACROSS[1],
];
const T = CLOUD_LOOK.tones;
const FAR_SIDE = SHADE_COLOUR.map((shade) => 1 + (shade - 1) * T.farSide);
const LIT_SIDE = LIGHT_COLOUR.map((light) => 1 + (light - 1) * T.litDepth);
const B = CLOUD_LOOK.brush;

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
// How far the wind has carried the patches, the clumps, and their detail with the warp, in world units modulo the
// period.
uniform vec3 uCarried;
// Each lattice's cell along the wind, in world units, and how many of its cells go round the period.
uniform vec2 uClumps;
uniform vec2 uPatches;
uniform vec2 uWarp;
// How much of the sky is cloud, how much the patches decide where, and how soft an edge is.
uniform float uCover;
uniform float uPatchWeight;
uniform float uEdge;
// How dark a shadow is, nought to one, already times how much of the shadows the band draws; and how far from its
// cloud it falls, away from the light, as a share of a clump.
uniform float uShadow;
uniform float uReach;
out vec4 fragColor;

const float TAU = 6.2831853;
const float WORLD = ${float(WORLD_MASTER_WIDTH)};
const vec2 ALONG = vec2(${float(ALONG[0])}, ${float(ALONG[1])});
const vec2 ACROSS = vec2(${float(ACROSS[0])}, ${float(ACROSS[1])});
const vec2 SUN = vec2(${float(SUN[0]!)}, ${float(SUN[1]!)});
const vec3 LIT = vec3(${colour(LIT_SIDE)});
const vec3 MIDDLE = vec3(${colour(T.middle)});
const vec3 FAR_SIDE = vec3(${colour(FAR_SIDE)});
const float LIT_REACH = ${float(T.litReach)};
const float FAR_REACH = ${float(T.farReach)};
const float WARP = ${float(CLOUD_LOOK.warp)};
const float BRUSH = ${float(B.strength)};
const float BRUSH_ALONG = ${float(B.along)};
const float BRUSH_ACROSS = ${float(B.across)};
const vec3 SHADE = vec3(${colour(SHADE_COLOUR)});
const float THIN = ${float(CLOUD_LOOK.thin)};
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

// How far the slow warp pushes the clumps about here, in world units; it drifts with the detail.
vec2 warp(vec2 wind) {
  vec2 at = vec2((wind.x - uCarried.z) / uWarp.x, wind.y / uWarp.x);
  return vec2(noise(at, uWarp.y, 40), noise(at + vec2(0.0, 23.0), uWarp.y, 41)) * (WARP * uClumps.x);
}

// The clumps, about -1 to 1: the first \`most\` sizes of noise at halving sizes, the two coarsest carried with the
// clumps and the finer ones as the detail is, the second and third folded into rounded lobes, each faded out as it
// shrinks towards a couple of pixels on the screen.
float clumps(vec2 wind, int most) {
  float sum = 0.0;
  float amplitude = 1.0;
  float cell = uClumps.x;
  float around = uClumps.y;
  for (int k = 0; k < 7; k += 1) {
    float shown = smoothstep(2.0, 6.0, cell * uScale);
    if (k >= most || shown <= 0.0) break;
    float carried = k < 2 ? uCarried.y : uCarried.z;
    vec2 at = vec2((wind.x - carried) / cell, wind.y / cell + float(k) * 31.7);
    float n = noise(at, around, 10 + k);
    if (k == 1 || k == 2) {
      // Folded: rounded bumps with creases between, the lumps a cumulus is built of.
      n = (abs(n) - 0.17) * 1.6;
    }
    sum += amplitude * shown * n;
    amplitude *= 0.5;
    cell *= 0.5;
    around *= 2.0;
  }
  return sum;
}

// The brush the edges are broken by, about -0.7 to 0.7: strokes long along the wind and thin across it.
float brush(vec2 wind) {
  vec2 at = vec2((wind.x - uCarried.y) / (uClumps.x * BRUSH_ALONG), wind.y / (uClumps.x * BRUSH_ACROSS));
  float shown = smoothstep(1.5, 4.0, uClumps.x * BRUSH_ACROSS * uScale);
  return shown * noise(at, uClumps.y / BRUSH_ALONG, 60);
}

void main() {
  vec2 ground = groundUnder(vScreen);
  // Nothing off the world's square, where the desk shows; worked out to the end all the same, because the soft
  // edges are measured across each two by two block of pixels and a pixel that stopped early would spoil it.
  float inWorld = step(0.0, ground.x) * step(0.0, ground.y) * step(ground.x, WORLD) * step(ground.y, WORLD);
  // Across the wind is lifted by the world's width, so every lattice row the hash is asked about is positive.
  vec2 wind = vec2(dot(ground, ALONG), dot(ground, ACROSS) + WORLD);
  vec2 pushed = wind + warp(wind);
  float patchHere = uPatchWeight * patches(wind);
  float field = 0.5 + 0.5 * clumps(pushed, 7) + patchHere;
  float stroke = brush(pushed);
  float cut = 0.47 + 0.35 * (1.0 - 2.0 * uCover) + BRUSH * stroke;
  float soft = max(uEdge, fwidth(field));
  float cloud = smoothstep(cut - soft, cut + soft, field);
  // Thin at the edge, whole a little way in.
  float body = mix(THIN, 1.0, smoothstep(cut, cut + 0.12, field));

  // Lit where a step towards the sun leaves the cloud, shaded where a step away from it does: a rim of cream on
  // the side the sun strikes and of violet-grey on the far side, read off the clumps' larger shapes.
  float towards = 0.5 + 0.5 * clumps(pushed + SUN * (LIT_REACH * uClumps.x), 3) + patchHere + 0.04 * stroke;
  float away = 0.5 + 0.5 * clumps(pushed - SUN * (FAR_REACH * uClumps.x), 3) + patchHere + 0.04 * stroke;
  // Flat tones meet along a line a pixel or so soft, as paint does, however soft the cloud's own edge is.
  float tone = max(0.008, fwidth(towards));
  float lit = 1.0 - smoothstep(cut - tone, cut + tone, towards);
  float far = 1.0 - smoothstep(cut - tone, cut + tone, away);
  vec3 rgb = mix(mix(MIDDLE, LIT, lit), FAR_SIDE, far * (1.0 - 0.5 * lit));
  float cloudAlpha = cloud * body * OPACITY * uAmount;

  // The shadow here is the cloud standing towards the light from it: the same field, warped where that cloud is,
  // read at its coarser sizes, so it keeps the cloud's shape without its finest lumps, in the relief's violet.
  vec2 over = wind + SUN * (uReach * uClumps.x);
  vec2 overPushed = over + warp(over);
  float shade = 0.5 + 0.5 * clumps(overPushed, 4) + uPatchWeight * patches(over);
  float shadowCut = cut - BRUSH * stroke + BRUSH * brush(overPushed);
  float shadowSoft = max(uEdge * 1.5, fwidth(shade));
  float shadowAlpha = smoothstep(shadowCut - shadowSoft, shadowCut + shadowSoft, shade) * uShadow;

  // The cloud over its own shadow and the shadow over the ground, premultiplied.
  vec4 shadow = vec4(SHADE, 1.0) * shadowAlpha;
  fragColor = (vec4(rgb, 1.0) * cloudAlpha + shadow * (1.0 - cloudAlpha)) * inWorld;
}
`;
