import { COVER_VERTEX, GROUND_GLSL } from '../../shaders/groundGlsl';

/**
 * The worked ground, a pixel at a time over the whole screen: for each pixel the ground under it, by the sprites' own
 * projection backwards, and the diamond of the ground's lattice it is in, read from the window of worked ground a byte
 * a diamond (`groundWindow.ts`). A diamond worn nothing is let through at once, so a screen of open country costs one
 * look a pixel. The point read is first moved a little by a noise of the ground, so an edge between worn and unworn
 * diamonds wanders as the painter's boundaries do, and it is softened where it meets ground that is not worn. The
 * earth has a tint of its own a diamond and a grain finer than one; a ruin's is going back to grass.
 * See docs/plans/worked-ground.md.
 */

export const GROUND_VERTEX = COVER_VERTEX;

export const GROUND_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vScreen;
uniform vec2 uSize;
uniform vec2 uCentre;
uniform float uScale;
uniform vec3 uTilt;
// The ground's lattice turned: its turn's cosine and sine.
uniform vec2 uTurn;
// What each diamond of the window is worn as, a byte each: workedGround.ts's WORKED.
uniform sampler2D uWorked;
uniform vec2 uWindowOrigin;
uniform vec2 uWindowSize;
uniform vec3 uEarth;
uniform float uStrength;
uniform float uFade;
// How much of a settlement's ground is grass rather than earth, and the dust a road is packed to.
uniform float uGrass;
uniform vec3 uRoad;
out vec4 fragColor;

${GROUND_GLSL}

// How far the point a diamond is read at wanders, in diamonds, and how fine the wandering is, in world units.
const float WANDER = 0.45;
const float WANDER_FINE = 1.7;
// How far into a worn diamond its edge softens, where it meets one that is not.
const float SOFT = 0.18;
// The grass a ruin's yard is going back to, and a settlement's ground is trodden into.
const vec3 GRASS = vec3(0.45, 0.5, 0.35);

int wornAt(ivec2 cell) {
  ivec2 at = cell - ivec2(uWindowOrigin);
  if (any(lessThan(at, ivec2(0))) || any(greaterThanEqual(at, ivec2(uWindowSize)))) {
    return 0;
  }
  return int(texelFetch(uWorked, at, 0).r * 255.0 + 0.5);
}

void main() {
  vec2 world = groundUnder(vScreen);
  vec2 lattice = vec2(world.x * uTurn.x + world.y * uTurn.y, world.y * uTurn.x - world.x * uTurn.y);
  vec2 wander = vec2(noise(world * WANDER_FINE), noise(world * WANDER_FINE + 41.3)) - 0.5;
  vec2 read = lattice + wander * WANDER;
  ivec2 cell = ivec2(floor(read));
  int worn = wornAt(cell);
  if (worn == 0) {
    discard;
  }
  vec2 into = fract(read);
  float edge = 1.0;
  if (wornAt(cell + ivec2(-1, 0)) == 0) edge = min(edge, into.x);
  if (wornAt(cell + ivec2(1, 0)) == 0) edge = min(edge, 1.0 - into.x);
  if (wornAt(cell + ivec2(0, -1)) == 0) edge = min(edge, into.y);
  if (wornAt(cell + ivec2(0, 1)) == 0) edge = min(edge, 1.0 - into.y);
  float soft = smoothstep(0.0, SOFT, edge);

  // 1 a settlement's ground, 2 a path, 3 a ruin's ring, 4 a ring, 5 a road, 6 a ruin's footprint, 7 a footprint.
  float how = worn == 7 ? 1.0
    : worn == 6 ? 0.7
    : worn == 5 ? 0.9
    : worn == 4 ? 0.85
    : worn == 3 ? 0.5
    : worn == 2 ? 0.8
    : 0.75;
  float tint = hash(cell, 7) - 0.5;
  float grain = noise(world * 6.0) - 0.5;
  vec3 colour = uEarth * (1.0 + tint * 0.12 + grain * 0.2);
  if (worn == 3 || worn == 6) {
    colour = mix(colour, GRASS, 0.35);
  } else if (worn == 1) {
    // Trodden grass between the houses, not the bare earth of a yard.
    colour = mix(colour, GRASS * (1.0 + grain * 0.3), uGrass);
  } else if (worn == 5) {
    // A road is packed and dusty, paler than the earth of a path.
    colour = uRoad * (1.0 + tint * 0.08 + grain * 0.12);
  }
  float alpha = how * soft * uStrength * uFade;
  fragColor = vec4(colour * alpha, alpha);
}
`;
