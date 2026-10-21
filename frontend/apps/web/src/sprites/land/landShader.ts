import { COVER_VERTEX, GROUND_GLSL } from '../../shaders/groundGlsl';
import { GUSTS_GLSL } from '../wind';

import { CROPS_GLSL } from './cropsShader';
import { FIELDS_GLSL } from './fieldsShader';
import { GRASS_GLSL } from './grassShader';
import { HEATH_GLSL } from './heathShader';
import { ICE_GLSL } from './iceShader';
import { CHANNELS_IN_FIRST, DRAWN, channelOf } from './landMask';
import type { DrawnMotion } from './landMask';
import { TRAIL_GLSL } from './trailShader';
import { WET_GLSL } from './wetShader';

/**
 * The land, worked out a pixel at a time over the whole screen, as the fog is: one triangle that covers it, and for
 * each pixel the ground under it, found by the sprites' own projection backwards, and what moves on the land there,
 * from the mask (`landMask.ts`). Each motion is a pass of its own over the screen - the grass, `grassShader.ts`, the
 * crops, `cropsShader.ts`, the heath, `heathShader.ts`, the wet land, `wetShader.ts`, and the ice, the salt and the
 * sand, `iceShader.ts` - drawn only while its land is under the view, working out its motion only where its land
 * is, and laid over the passes before it where two meet, so a screen of rock costs almost nothing and a screen of
 * grass what the grass costs. A program for each motion rather than one for them all, because Direct3D's compiler
 * takes far longer over one large program than over its parts: 25 s for the one, 6 s for the five side by side
 * (experiment 0025). Every number is in `look.ts`.
 */

export const LAND_VERTEX = COVER_VERTEX;

/** What every pass of the land shares: the screen, the mask and how it is read, the wind, the ground's projection. */
const LAND_SHARED = `#version 300 es
precision highp float;
precision highp int;
in vec2 vScreen;
uniform vec2 uSize;
uniform vec2 uCentre;
uniform float uScale;
uniform vec3 uTilt;
uniform float uTime;
// How far the wind has carried the gusts, in world units modulo the period they come round at: ../wind.ts.
uniform float uCarried;
uniform float uFade;
uniform float uPixel;
uniform sampler2D uMask;
uniform vec2 uMaskOrigin;
uniform vec2 uMaskSize;
// Which of its motion's looks the land of each world unit has, a byte each, read as it is: landMask.ts.
uniform sampler2D uLooks;
// The fifth motion's channel, in a texture of its own.
uniform sampler2D uMaskMore;
out vec4 fragColor;

const float TAU = 6.2831853;
${GUSTS_GLSL}

${GROUND_GLSL}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

// Which cells of a lattice of roots can put ink on this pixel at all. A root lies anywhere in its cell, and from it a
// tuft, a stalk or a clump can ink only so far: a cell beyond that is passed over before anything of it is worked out,
// which leaves out only ink that could not have touched the pixel, the same picture for the work of the cells that
// could (experiment 0027). What a root can ink is a box of offsets from it on the screen, \`low\` and \`high\` in a vec4:
// strokeInk and clumpInk make one, eitherInk joins two.
struct Reach {
  vec2 corner;
  vec2 east;
  vec2 south;
  vec2 low;
  vec2 high;
};

// How a move of so many world units over the ground moves a point on the screen: screenOf, without its start.
vec2 screenStep(vec2 world) {
  return uScale * vec2(world.x * uTilt.x + world.y * uTilt.y, (world.y * uTilt.x - world.x * uTilt.y) * uTilt.z);
}

// A stroke from its root up to \`tallest\` pixels high, leaning down the wind by a share of its height from \`leanFrom\` to
// \`leanTo\`, inking within \`halfWidth\` of itself: its points are its height times its lean less straight up, nought or
// the tallest at the corners.
vec4 strokeInk(float tallest, vec2 downWind, float leanFrom, float leanTo, float halfWidth) {
  vec2 one = tallest * (downWind * leanFrom - vec2(0.0, 1.0));
  vec2 other = tallest * (downWind * leanTo - vec2(0.0, 1.0));
  return vec4(min(vec2(0.0), min(one, other)) - halfWidth, max(vec2(0.0), max(one, other)) + halfWidth);
}

// A round clump of radius up to \`radius\` pixels, its middle raised \`raise\` of its radius above its root and moved down
// the wind by a share of its radius from \`leanFrom\` to \`leanTo\`, inking within its radius and \`edge\` more, squashed
// up the screen by \`squash\`: every part of it straight in its radius, so nought or the widest at the corners.
vec4 clumpInk(float radius, float raise, vec2 downWind, float leanFrom, float leanTo, float squash, float edge) {
  vec2 smallest = vec2(edge, edge / squash);
  vec2 widest = vec2(radius + edge, (radius + edge) / squash);
  vec2 one = radius * (vec2(0.0, -raise) + downWind * leanFrom);
  vec2 other = radius * (vec2(0.0, -raise) + downWind * leanTo);
  return vec4(min(-smallest, min(one, other) - widest), max(smallest, max(one, other) + widest));
}

vec4 eitherInk(vec4 one, vec4 other) {
  return vec4(min(one.xy, other.xy), max(one.zw, other.zw));
}

// The cells of a lattice whose cell nought starts at \`cornerWorld\`, a step along each of its two ways \`stepA\` and
// \`stepB\` world units, a root anywhere from \`footFrom\` to \`footTo\` steps into its cell, and \`ink\` what a root can
// put down.
Reach reachOf(vec2 cornerWorld, vec2 stepA, vec2 stepB, vec2 footFrom, vec2 footTo, vec4 ink) {
  Reach reach;
  reach.corner = screenOf(cornerWorld);
  reach.east = screenStep(stepA);
  reach.south = screenStep(stepB);
  vec2 a = footFrom.x * reach.east + footFrom.y * reach.south;
  vec2 b = footTo.x * reach.east + footFrom.y * reach.south;
  vec2 c = footFrom.x * reach.east + footTo.y * reach.south;
  vec2 d = footTo.x * reach.east + footTo.y * reach.south;
  // A twentieth of a pixel more each way, for the rounding between these sums and the ink's own, which is some
  // ten-thousandths of one at the world's sizes.
  reach.low = min(min(a, b), min(c, d)) + ink.xy - 0.05;
  reach.high = max(max(a, b), max(c, d)) + ink.zw + 0.05;
  return reach;
}

// The cells of a lattice of whole cells this many world units across, square to the world, about the middle one.
Reach squareReach(ivec2 middle, float cell, vec4 ink) {
  return reachOf(vec2(middle) * cell, vec2(cell, 0.0), vec2(0.0, cell), vec2(0.0), vec2(1.0), ink);
}

// Whether a cell so many steps along the lattice's two ways from cell nought can put ink on this pixel.
bool reaches(Reach reach, ivec2 offset) {
  vec2 from = vScreen - (reach.corner + float(offset.x) * reach.east + float(offset.y) * reach.south);
  return all(greaterThanEqual(from, reach.low)) && all(lessThanEqual(from, reach.high));
}

// How much of each motion one of the mask's textures says the land here has, nought to one each, softened over a world
// unit or so, so the square master pixels of a meadow's edge are not drawn as squares.
vec4 softenedIn(sampler2D mask, vec2 world) {
  vec2 at = (world - uMaskOrigin) / uMaskSize;
  // Off the tiles the mask was pieced from, which is where the view has moved before the next one comes.
  if (any(lessThan(at, vec2(0.0))) || any(greaterThan(at, vec2(1.0)))) {
    return vec4(0.0);
  }
  vec2 texel = 1.0 / uMaskSize;
  vec4 sum = texture(mask, at) * 2.0;
  sum += texture(mask, at + vec2(texel.x, 0.0)) + texture(mask, at - vec2(texel.x, 0.0));
  sum += texture(mask, at + vec2(0.0, texel.y)) + texture(mask, at - vec2(0.0, texel.y));
  return smoothstep(vec4(0.4), vec4(0.95), sum / 6.0);
}

// Which motions one of the mask's textures says a point of the ground has, unsoftened: whether a tuft is rooted
// there, one look at the mask where softenedIn softens the edge with five.
vec4 rootedIn(sampler2D mask, vec2 world) {
  vec2 at = (world - uMaskOrigin) / uMaskSize;
  if (any(lessThan(at, vec2(0.0))) || any(greaterThan(at, vec2(1.0)))) {
    return vec4(0.0);
  }
  return texture(mask, at);
}

// The first four motions, unsoftened.
vec4 rootsAt(vec2 world) {
  return rootedIn(uMask, world);
}

// The first four motions of the world unit a point of the ground is in, as the mask writes them, unblended: the grass's
// tells how much of the woods' undergrowth it is by how far below full it is written (strengthOf, look.ts).
vec4 rootedExactly(vec2 world) {
  ivec2 texel = ivec2(floor(world - uMaskOrigin));
  if (any(lessThan(texel, ivec2(0))) || any(greaterThanEqual(texel, ivec2(uMaskSize)))) {
    return vec4(0.0);
  }
  return texelFetch(uMask, texel, 0);
}

// The look of one world unit of the mask, by its texel, nought off the tiles the mask was pieced from.
int lookOfTexel(ivec2 texel) {
  if (any(lessThan(texel, ivec2(0))) || any(greaterThanEqual(texel, ivec2(uMaskSize)))) {
    return 0;
  }
  return int(texelFetch(uLooks, texel, 0).r * 255.0 + 0.5);
}

// Which of its motion's looks the land at a point of the ground has - heath, scrub or tundra, say - unblended.
int lookAt(vec2 world) {
  return lookOfTexel(ivec2(floor(world - uMaskOrigin)));
}
`;

/** The parts of the shader each motion's pass is made of, besides what they all share, and what it asks of them. */
const PARTS: Record<DrawnMotion, { glsl: string; here: string }> = {
  grass: { glsl: TRAIL_GLSL + GRASS_GLSL, here: 'grassHere' },
  crops: { glsl: FIELDS_GLSL + CROPS_GLSL, here: 'cropsHere' },
  heath: { glsl: TRAIL_GLSL + HEATH_GLSL, here: 'heathHere' },
  wet: { glsl: FIELDS_GLSL + WET_GLSL, here: 'wetHere' },
  'ice-salt-sand': { glsl: ICE_GLSL, here: 'iceHere' },
};

/**
 * One motion's pass: its land under each pixel, softened, and where there is any, the motion there, premultiplied and
 * weighed by how much of it there is, to be laid over the passes before it.
 */
export function landFragment(motion: DrawnMotion): string {
  const channel = channelOf(motion)!;
  const amount =
    channel < CHANNELS_IN_FIRST ? `softenedIn(uMask, world)[${channel}]` : 'softenedIn(uMaskMore, world).r';
  const { glsl, here } = PARTS[motion];
  return `${LAND_SHARED}${glsl}
void main() {
  vec2 world = groundUnder(vScreen);
  float amount = ${amount} * uFade;
  if (amount <= 0.002) {
    discard;
  }
  fragColor = ${here}(world) * amount;
}
`;
}

/** Every motion's pass, in the order they are laid one over another: the mask's. */
export const LAND_PASSES: readonly { motion: DrawnMotion; fragment: string }[] = DRAWN.map((motion) => ({
  motion,
  fragment: landFragment(motion),
}));
