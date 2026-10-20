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

// Which of its motion's looks the land at a point of the ground has - heath, scrub or tundra, say - unblended.
int lookAt(vec2 world) {
  ivec2 texel = ivec2(floor(world - uMaskOrigin));
  if (any(lessThan(texel, ivec2(0))) || any(greaterThanEqual(texel, ivec2(uMaskSize)))) {
    return 0;
  }
  return int(texelFetch(uLooks, texel, 0).r * 255.0 + 0.5);
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
