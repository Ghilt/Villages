import { GRASS_LOOK } from './look';

/**
 * WIP SPIKE: the grass, worked out a pixel at a time over the whole screen, as the fog is: one triangle that
 * covers it, and for each pixel the ground under it, found by the sprites' own projection backwards.
 *
 * Two things move. Gusts travel down the wind as soft bands, and where one blows the field shows its paler
 * side. And close in, a tuft stands up in every small cell of the ground, a stroke from a shaded root to a lit
 * tip, which the gust bends down the wind and which sways a little when there is none. A tuft stands up the
 * screen, as the trees and the castles do, so it is drawn in pixels from its root rather than lying on the
 * ground. Every number is in `look.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => rgb.map(float).join(', ');

const G = GRASS_LOOK.gusts;
const B = GRASS_LOOK.blades;
const WIND = (GRASS_LOOK.wind * Math.PI) / 180;

export const GRASS_VERTEX = `#version 300 es
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

export const GRASS_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vScreen;
uniform vec2 uSize;
uniform vec2 uCentre;
uniform float uScale;
uniform vec3 uTilt;
uniform float uTime;
uniform float uFade;
uniform float uPixel;
uniform sampler2D uMask;
uniform vec2 uMaskOrigin;
uniform vec2 uMaskSize;
out vec4 fragColor;

const float TAU = 6.2831853;
const vec2 WIND = vec2(${float(Math.cos(WIND))}, ${float(Math.sin(WIND))});
const float GUST_SIZE = ${float(G.size)};
const float GUST_SPEED = ${float(G.speed)};
const vec3 SHEEN = vec3(${colour(G.colour)});
const float SHEEN_ALPHA = ${float(G.opacity)};
const float CELL = ${float(B.cell)};
const float HEIGHT = ${float(B.height)};
const float WIDTH = ${float(B.width)};
const float BEND = ${float(B.bend)};
const float SWAY = ${float(B.sway)};
const float SWAY_SPEED = ${float(B.swaySpeed)};
const vec3 ROOT = vec3(${colour(B.root)});
const float ROOT_ALPHA = ${float(B.rootOpacity)};
const vec3 TIP = vec3(${colour(B.tip)});
const float TIP_ALPHA = ${float(B.tipOpacity)};
const float FROM_PIXELS = ${float(B.fromPixels)};
const float WHOLE_PIXELS = ${float(B.wholePixels)};

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

// How much grass grows here, nought to one, softened over a world unit or so, so the square master pixels
// of a meadow's edge are not drawn as squares.
float grassAt(vec2 world) {
  vec2 at = (world - uMaskOrigin) / uMaskSize;
  // Off the tiles the mask was pieced from, which is where the view has moved before the next one comes.
  if (any(lessThan(at, vec2(0.0))) || any(greaterThan(at, vec2(1.0)))) {
    return 0.0;
  }
  vec2 texel = 1.0 / uMaskSize;
  float sum = texture(uMask, at).r * 2.0;
  sum += texture(uMask, at + vec2(texel.x, 0.0)).r + texture(uMask, at - vec2(texel.x, 0.0)).r;
  sum += texture(uMask, at + vec2(0.0, texel.y)).r + texture(uMask, at - vec2(0.0, texel.y)).r;
  return smoothstep(0.4, 0.95, sum / 6.0);
}

// How hard the wind is blowing here, nought to one: gusts that travel down the wind.
float gustAt(vec2 world) {
  vec2 moved = world - WIND * uTime * GUST_SPEED;
  float big = noise(moved / GUST_SIZE);
  float small = noise(moved / (GUST_SIZE * 0.4) + vec2(17.0, 3.0));
  return smoothstep(0.42, 0.8, big * 0.65 + small * 0.35);
}

float segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 world = groundUnder(vScreen);
  float grass = grassAt(world) * uFade;
  if (grass <= 0.002) {
    discard;
  }
  float gust = gustAt(world);
  vec3 rgb = SHEEN * gust * SHEEN_ALPHA;
  float alpha = gust * SHEEN_ALPHA;

  // The tufts, while a cell is big enough on the screen to be worth one.
  float worth = smoothstep(FROM_PIXELS, WHOLE_PIXELS, CELL * uScale);
  if (worth > 0.0) {
    // Which way down the wind is on the screen, and how tall a tuft stands there, in pixels.
    vec2 downWind = screenOf(uCentre + WIND) - screenOf(uCentre);
    downWind /= max(length(downWind), 1e-6);
    float tall = HEIGHT * uScale;
    float thick = max(WIDTH, uPixel * 1.2);
    // A tuft rises from its root, so the roots that can reach this pixel lie on the ground below it.
    vec2 reach = groundUnder(vScreen + vec2(0.0, tall * 0.5)) / CELL;
    ivec2 middle = ivec2(floor(reach));
    float ink = 0.0;
    float lit = 0.0;
    for (int dy = -1; dy <= 2; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        ivec2 cell = middle + ivec2(dx, dy);
        vec2 rootWorld = (vec2(cell) + vec2(hash(cell, 1), hash(cell, 2))) * CELL;
        float here = grassAt(rootWorld);
        if (here < 0.5) {
          continue;
        }
        float blow = gustAt(rootWorld);
        float sway = sin(TAU * (uTime * SWAY_SPEED + hash(cell, 3))) * SWAY;
        float size = tall * mix(0.7, 1.15, hash(cell, 4));
        vec2 root = screenOf(rootWorld);
        vec2 tip = root + vec2(0.0, -size) + downWind * size * (blow * BEND + sway);
        float away = segment(vScreen, root, tip);
        float on = 1.0 - smoothstep(thick * 0.5, thick * 0.5 + uPixel, away);
        if (on > ink) {
          ink = on;
          // How far up the stroke this pixel is: the root shaded, the tip lit, and lit more where bent.
          vec2 rise = tip - root;
          lit = clamp(dot(vScreen - root, rise) / max(dot(rise, rise), 1e-6), 0.0, 1.0) * mix(0.75, 1.0, blow);
        }
      }
    }
    ink *= worth;
    vec3 stroke = mix(ROOT * ROOT_ALPHA, TIP * TIP_ALPHA, lit);
    float strokeAlpha = mix(ROOT_ALPHA, TIP_ALPHA, lit) * ink;
    rgb = stroke * ink + rgb * (1.0 - strokeAlpha);
    alpha = strokeAlpha + alpha * (1.0 - strokeAlpha);
  }
  fragColor = vec4(rgb, alpha) * grass;
}
`;
