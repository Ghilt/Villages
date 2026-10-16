import { GUSTS_GLSL } from '../wind';
import { TREES_LOOK } from './look';

/**
 * The scenery drawn bending in the wind: Pixi's own particle shader, with the top of every sprite leaned down the
 * wind by the gust where it stands. Only how a thing is drawn moves; where it stands never does, because the foot
 * keeps its place and the bend grows with the height above it. The gusts are the grass's (`../wind.ts`), read at
 * the ground under each foot, which is the stored foot with the camera's turn and tip taken back out of it. A
 * shadow's far end leans as its sprite's top does, so the two stay together.
 *
 * What a kind does in the wind comes in its tint (`look.ts`, `tintOf`): its red is how far it bends and its green
 * how much its crown pales. Only the fade is taken from the colour, so a picture is never tinted by it. The
 * attributes and Pixi's own uniforms are the ones its particle container hands every shader it draws with.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => rgb.map(float).join(', ');

/** The vertex shader, for the sprites or for their shadows. */
export function swayVertex(shadows: boolean): string {
  return `#version 300 es
precision highp float;
precision highp int;
in vec2 aVertex;
in vec2 aPosition;
in float aRotation;
in vec2 aUV;
in vec4 aColor;
uniform mat3 uTranslationMatrix;
uniform vec4 uColor;
uniform float uRound;
uniform vec2 uResolution;
// The camera's turn and tip, as cameraMath's GroundTilt: cos, sin, lean.
uniform vec3 uTilt;
// One world unit down the wind, as it lands on the screen in the layer's own units.
uniform vec2 uDownWind;
// How far the wind has carried the gusts, and the wall clock's seconds modulo an hour: ../wind.ts.
uniform float uCarried;
uniform float uTime;
// How far the bendiest kind bends in a whole gust, as a share of its height, and how far the palest crown pales:
// nought each when the trees are still.
uniform float uBend;
uniform float uPale;
out vec2 vUV;
out vec4 vColor;
out float vPale;

const float TAU = 6.2831853;
const bool SHADOWS = ${shadows ? 'true' : 'false'};
const float IDLE = ${float(TREES_LOOK.idle)};
const float IDLE_SPEED = ${float(TREES_LOOK.idleSpeed)};
const float SHADOW_REACH = ${float(TREES_LOOK.shadowReach)};
${GUSTS_GLSL}

// The ground a stored foot stands on: cameraMath's untiltGround.
vec2 groundOf(vec2 stored) {
  float unsquashed = stored.y / max(uTilt.z, 0.0001);
  return vec2(stored.x * uTilt.x - unsquashed * uTilt.y, stored.x * uTilt.y + unsquashed * uTilt.x);
}

vec2 roundPixels(vec2 position, vec2 targetSize) {
  return (floor(((position * 0.5 + 0.5) * targetSize) + 0.5) / targetSize) * 2.0 - 1.0;
}

void main() {
  // Turned as Pixi's own particle shader turns it, though the scenery never is.
  float c = cos(aRotation);
  float s = sin(aRotation);
  vec2 corner = vec2(aVertex.x * c - aVertex.y * s, aVertex.x * s + aVertex.y * c);
  // How far above its foot this corner stands, in world units; for a shadow, how high the part of its sprite
  // stands whose shadow this corner is, the shadow falling a share of the sprite's height to the left.
  float above = SHADOWS ? max(0.0, -corner.x) / SHADOW_REACH : max(0.0, -corner.y);
  float gust = 0.0;
  if (uBend > 0.0 && aColor.r > 0.0) {
    vec2 ground = groundOf(aPosition);
    gust = gustAt(ground, uCarried);
    float idle = sin(TAU * (uTime * IDLE_SPEED + windHash(ivec2(floor(ground * 8.0)), 103)));
    corner += uDownWind * above * (gust + idle * IDLE) * uBend * aColor.r;
  }
  gl_Position = vec4((uTranslationMatrix * vec3(corner + aPosition, 1.0)).xy, 0.0, 1.0);
  if (uRound == 1.0) {
    gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
  }
  vUV = aUV;
  vColor = vec4(aColor.a) * uColor;
  // Palest at the top of a crown and nothing at its foot; the graphics card blends between the two.
  vPale = SHADOWS || above <= 0.0 ? 0.0 : gust * uPale * aColor.g;
}
`;
}

export const SWAY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vColor;
in float vPale;
uniform sampler2D uTexture;
out vec4 fragColor;

const vec3 SHEEN = vec3(${colour(TREES_LOOK.sheen)});

void main() {
  vec4 picture = texture(uTexture, vUV);
  // The atlas is premultiplied, so the paler side is laid in only as far as the picture is there.
  picture.rgb = mix(picture.rgb, SHEEN * picture.a, vPale);
  fragColor = picture * vColor;
}
`;
