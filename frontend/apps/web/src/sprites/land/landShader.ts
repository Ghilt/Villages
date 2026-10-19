import { GUSTS_GLSL } from '../wind';

import { CROPS_GLSL } from './cropsShader';
import { GRASS_GLSL } from './grassShader';
import { HEATH_GLSL } from './heathShader';
import { ICE_GLSL } from './iceShader';
import { WET_GLSL } from './wetShader';

/**
 * The land, worked out a pixel at a time over the whole screen, as the fog is: one triangle that covers it, and for
 * each pixel the ground under it, found by the sprites' own projection backwards, and what moves on the land there,
 * from the mask (`landMask.ts`). Each pixel works out only the motions of the land under it, each a part of its own
 * - the grass, `grassShader.ts`, the crops, `cropsShader.ts`, the heath, `heathShader.ts`, the wet land,
 * `wetShader.ts`, and the ice, the salt and the sand, `iceShader.ts` - laid over one another where two meet, so a screen of rock costs almost
 * nothing and a screen of grass what the grass costs. Every number is in `look.ts`.
 */

export const LAND_VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 uSize;
out vec2 vScreen;
void main() {
  vScreen = vec2((aPosition.x + 1.0) * 0.5 * uSize.x, (1.0 - aPosition.y) * 0.5 * uSize.y);
  // Drawn into a picture of its own, which WebGL keeps bottom row first and Pixi shows the other way up: so it
  // is drawn upside down, to be shown the right way. Straight onto the screen, as the fog is, it would not be.
  gl_Position = vec4(aPosition.x, -aPosition.y, 0.0, 1.0);
}
`;

export const LAND_FRAGMENT = `#version 300 es
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
// The fifth motion's channel, in a texture of its own, and whether it is drawn.
uniform sampler2D uMaskMore;
uniform float uShownMore;
// Which of the mask's motions are drawn, one or nought each: the boxes of the Land part's folds.
uniform vec4 uShown;
out vec4 fragColor;

const float TAU = 6.2831853;
${GUSTS_GLSL}

float hash(ivec2 cell, int salt) {
  uvec3 u = uvec3(ivec3(cell, salt)) * uvec3(1597334673u, 3812015801u, 2798796415u);
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
    mix(hash(c, 0), hash(c + ivec2(1, 0), 0), w.x),
    mix(hash(c + ivec2(0, 1), 0), hash(c + ivec2(1, 1), 0), w.x),
    w.y
  );
}

vec2 groundUnder(vec2 screen) {
  vec2 onScreen = screen - uSize * 0.5;
  float along = onScreen.y / max(uTilt.z, 0.0001);
  vec2 ground = vec2(onScreen.x * uTilt.x - along * uTilt.y, onScreen.x * uTilt.y + along * uTilt.x);
  return uCentre + ground / uScale;
}

// Where a piece of ground lands on the screen, in pixels: groundUnder forwards.
vec2 screenOf(vec2 world) {
  vec2 ground = (world - uCentre) * uScale;
  return uSize * 0.5 + vec2(ground.x * uTilt.x + ground.y * uTilt.y, (ground.y * uTilt.x - ground.x * uTilt.y) * uTilt.z);
}

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

// The first four motions, softened and unsoftened.
vec4 landAt(vec2 world) {
  return softenedIn(uMask, world);
}

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
${GRASS_GLSL}
${CROPS_GLSL}
${HEATH_GLSL}
${WET_GLSL}
${ICE_GLSL}

void main() {
  vec2 world = groundUnder(vScreen);
  vec4 land = landAt(world) * uShown * uFade;
  float more = softenedIn(uMaskMore, world).r * uShownMore * uFade;
  if (max(max(max(land.r, land.g), max(land.b, land.a)), more) <= 0.002) {
    discard;
  }
  vec4 drawn = vec4(0.0);
  if (land[GRASS] > 0.002) {
    vec4 grass = grassHere(world) * land[GRASS];
    drawn = grass + drawn * (1.0 - grass.a);
  }
  if (land[CROPS] > 0.002) {
    vec4 crops = cropsHere(world) * land[CROPS];
    drawn = crops + drawn * (1.0 - crops.a);
  }
  if (land[HEATH] > 0.002) {
    vec4 heath = heathHere(world) * land[HEATH];
    drawn = heath + drawn * (1.0 - heath.a);
  }
  if (land[WET] > 0.002) {
    vec4 wet = wetHere(world) * land[WET];
    drawn = wet + drawn * (1.0 - wet.a);
  }
  if (more > 0.002) {
    vec4 ice = iceHere(world) * more;
    drawn = ice + drawn * (1.0 - ice.a);
  }
  fragColor = drawn;
}
`;
