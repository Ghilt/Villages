import { BufferImageSource, Filter, Geometry, GlProgram, Mesh, Shader, UniformGroup } from 'pixi.js';

import { REACH, hazeInView } from '../fog/fogField';
import { FOG_LOOK } from '../fog/look';
import type { FogField } from '../fog/fogField';
import { WORLD_MASTER_WIDTH } from '../map/worldStyle';

import { groundTilt, pixelsPerWorldUnit, toMercatorExact } from './cameraMath';
import type { CameraView } from './cameraMath';

/**
 * The fog of war, as one layer of the sprite canvas: a mesh that covers the screen, drawn **between the world
 * and the signs for things in it**.
 *
 * Under it is the world - the scenery, and the ground forms of whatever stands outside vision. Over it is
 * everything that is a sign rather than the world - every icon, the seats a choice offers, the ring under the
 * selected mark - and whatever stands in vision, whole. That is Adam's rule: the fog covers the world and not
 * the representations of important things, and a thing in sight is never under it. The canvas lies over the
 * map, so what this layer draws covers the terrain too. See decision records 0061 and 0062.
 *
 * It finds the ground under each pixel by asking the sprites' own projection backwards - a turn, an unsquash
 * and a scale, because a tipped camera is parallel - so it lies on its ground at every zoom and tilt as a
 * castle stands on its own, and reads the distance field for that ground, which is worked out once for each
 * change to the house's vision points.
 */

/** What the fog should draw: nothing, or the fog of a house, whose field is null when it sees nothing. */
export type FogToDraw = { field: FogField | null } | null;

/**
 * The haze undulates only from here in (step 7). Further out its patches are too small to be seen to move, and
 * the world is mostly its signs.
 */
export const UNDULATES_FROM_ZOOM = 7;

/** One triangle that covers the screen, in clip space, so the fragment shader runs once for every pixel. */
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);

const VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform vec2 uSize;
out vec2 vScreen;
void main() {
  // Pixels from the top left of the canvas, in the units the interface uses, for the fragment to turn back
  // into ground. Worked out here rather than from gl_FragCoord, so that it never depends on the resolution.
  vScreen = vec2((aPosition.x + 1.0) * 0.5 * uSize.x, (1.0 - aPosition.y) * 0.5 * uSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/*
 * Where a pixel lies on the ground, and how far that ground lies inside what the house has revealed and inside
 * what it has in vision: what the fog, its fade and the colour taken out of the world under it are all drawn
 * from, so that the three can never disagree about where an edge is. The edge wanders a little, so that a
 * circle reads as the limit of what can be seen rather than as a line drawn with compasses, and it is soft by a
 * world unit and a half close in and a pixel far out. `uncolouring.ts` works the same wander out for the map.
 */
const LEVELS = `
uniform vec2 uSize;
uniform vec2 uCentre;
uniform float uScale;
uniform vec3 uTilt;
uniform float uWorldSide;
uniform sampler2D uField;
uniform vec2 uFieldOrigin;
uniform vec2 uFieldSize;
uniform float uHasField;
uniform float uReach;

float hash(ivec2 cell) {
  uvec2 u = uvec2(cell) * uvec2(1597334673u, 3812015801u);
  uint n = (u.x ^ u.y) * 1597334673u;
  return float(n) / 4294967296.0;
}

float noise(vec2 at) {
  vec2 whole = floor(at);
  vec2 part = at - whole;
  vec2 w = part * part * (3.0 - 2.0 * part);
  ivec2 cell = ivec2(whole);
  float a = hash(cell);
  float b = hash(cell + ivec2(1, 0));
  float c = hash(cell + ivec2(0, 1));
  float d = hash(cell + ivec2(1, 1));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

// How much of a pattern whose features are this many world units across is worth drawing at this zoom:
// all of it once they are a dozen pixels and more, none once they are down to a few, so nothing far out
// sparkles as the camera moves.
float worth(float units) {
  return clamp((units * uScale - 4.0) / 12.0, 0.0, 1.0);
}

vec2 groundUnder(vec2 screen) {
  vec2 onScreen = screen - uSize * 0.5;
  float along = onScreen.y / max(uTilt.z, 0.0001);
  vec2 ground = vec2(onScreen.x * uTilt.x - along * uTilt.y, onScreen.x * uTilt.y + along * uTilt.x);
  return uCentre + ground / uScale;
}

bool onTheWorld(vec2 world) {
  return world.x >= 0.0 && world.y >= 0.0 && world.x <= uWorldSide && world.y <= uWorldSide;
}

// Nought to one: how far inside revealed ground, and inside vision, this piece of ground lies.
vec2 levelsAt(vec2 world) {
  vec2 away = vec2(uReach);
  if (uHasField > 0.5) {
    away = texture(uField, (world - uFieldOrigin) / uFieldSize).rg;
  }
  float wander = (noise(world / 9.0) - 0.5) * 2.4 * worth(9.0) + (noise(world / 3.0) - 0.5) * 0.8 * worth(3.0);
  float soft = max(1.5, 1.2 / uScale);
  return vec2(1.0 - smoothstep(-soft, soft, away.r + wander), 1.0 - smoothstep(-soft, soft, away.g + wander));
}
`;

/** A number as GLSL writes a float, which always has a point in it. */
const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => rgb.map(float).join(', ');

/*
 * Every number here that is a matter of taste comes from `fog/look.ts`, for Adam's eye. The haze is dark and
 * lets the coast through, and lies in bands of mist. Revealed ground has its colour taken out beneath this
 * layer - the map's by `uncolouring.ts`, the world's sprites by the filter below - and this only fades it a
 * little, lifting it towards the parchment.
 */
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

in vec2 vScreen;
out vec4 finalColor;
${LEVELS}
// Seconds on the haze's own slow clock, which stands still whenever there is no haze worth moving.
uniform float uTime;

const vec3 HAZE = vec3(${colour(FOG_LOOK.haze.colour)});
const float HAZE_ALPHA = ${float(FOG_LOOK.haze.opacity)};
const float SWELL = ${float(FOG_LOOK.mist.swell)};
const float STRETCH = ${float(FOG_LOOK.mist.stretch)};
const float BIG = ${float(FOG_LOOK.mist.big)};
const float SMALL = ${float(FOG_LOOK.mist.small)};
const float DRIFT = ${float(FOG_LOOK.mist.drift)};
const float CHURN = ${float(FOG_LOOK.mist.churn)};
const vec3 FADE = vec3(${colour(FOG_LOOK.fade.colour)});
const float FADE_ALPHA = ${float(FOG_LOOK.fade.opacity)};

// Value noise in three dimensions, the third being time, so a band can swell and thin where it lies rather
// than only slide along itself.
float hash3(ivec3 cell) {
  uvec3 u = uvec3(cell) * uvec3(1597334673u, 3812015801u, 2798796415u);
  uint n = (u.x ^ u.y ^ u.z) * 1597334673u;
  return float(n) / 4294967296.0;
}

float noise3(vec3 at) {
  vec3 whole = floor(at);
  vec3 part = at - whole;
  vec3 w = part * part * (3.0 - 2.0 * part);
  ivec3 c = ivec3(whole);
  float near = mix(
    mix(hash3(c), hash3(c + ivec3(1, 0, 0)), w.x),
    mix(hash3(c + ivec3(0, 1, 0)), hash3(c + ivec3(1, 1, 0)), w.x),
    w.y
  );
  float far = mix(
    mix(hash3(c + ivec3(0, 0, 1)), hash3(c + ivec3(1, 0, 1)), w.x),
    mix(hash3(c + ivec3(0, 1, 1)), hash3(c + ivec3(1, 1, 1)), w.x),
    w.y
  );
  return mix(near, far, w.z);
}

// How much of a band of mist this many world units tall is worth drawing: none until it is six pixels tall and
// all of it by two dozen, so far out the mist fades into a flat haze rather than breaking into blotches.
float mistWorth(float units) {
  return clamp((units * uScale - 6.0) / 18.0, 0.0, 1.0);
}

void main() {
  vec2 world = groundUnder(vScreen);
  if (!onTheWorld(world)) {
    finalColor = vec4(0.0);
    return;
  }
  vec2 levels = levelsAt(world);
  float revealed = levels.x;
  float vision = levels.y;

  // Mist over a field: the haze thickens and thins in bands stretched along the screen's width, whichever way
  // the camera is turned, lying on the ground so that they pan with it. The bands swell and thin where they
  // lie, and big ones and small ones drift across the screen the opposite way to each other, the small ones
  // rising a little, so the mist undulates rather than sliding by as one sheet. Kept on the positive side of
  // nought for the hash. The edge does not move: the map's colour and the trees are cut along it.
  vec2 across =
    vec2(world.x * uTilt.x + world.y * uTilt.y, world.y * uTilt.x - world.x * uTilt.y) + vec2(100000.0);
  float drift = uTime * DRIFT;
  float churn = uTime * CHURN;
  float big = noise3(vec3((across.x - drift) / (STRETCH * BIG), across.y / BIG, churn));
  float small = noise3(
    vec3((across.x + drift * 0.7) / (STRETCH * SMALL), (across.y + drift * 0.12) / SMALL, churn * 1.6 + 7.0)
  );
  float swell = (big - 0.5) * 1.3 * mistWorth(BIG) + (small - 0.5) * 0.7 * mistWorth(SMALL);
  float cloud = 1.0 + SWELL * swell;
  float haze = min(1.0, HAZE_ALPHA * (1.0 - revealed) * cloud);
  float fade = FADE_ALPHA * revealed * (1.0 - vision);
  finalColor = vec4(HAZE * haze + FADE * fade, haze + fade);
}
`;

/**
 * The filter over the world's sprites under the fog - the scenery, and whatever stands outside vision - that
 * takes their colour out on ground the house has only revealed, keeping each one's brightness: the same
 * weighting the browser's saturation blend takes the map's colour out by, so a tree and the ground it stands on
 * go grey alike. Pixi's own filter vertex, which also says where on the screen each pixel is.
 */
const WORLD_VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vScreen;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  // In the units the interface uses, because the filter's area is the whole screen and it is drawn straight
  // onto it.
  vScreen = position;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const WORLD_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

in vec2 vTextureCoord;
in vec2 vScreen;
uniform sampler2D uTexture;
out vec4 finalColor;
${LEVELS}
void main() {
  vec4 colour = texture(uTexture, vTextureCoord);
  vec2 world = groundUnder(vScreen);
  float uncolour = 0.0;
  if (onTheWorld(world)) {
    vec2 levels = levelsAt(world);
    uncolour = levels.x * (1.0 - levels.y);
  }
  float grey = dot(colour.rgb, vec3(0.3, 0.59, 0.11));
  finalColor = vec4(mix(colour.rgb, vec3(grey), uncolour), colour.a);
}
`;

/** A number as the sixteen bits of a half float, which is what a half-float texture is uploaded as. */
export function toHalf(value: number): number {
  const floats = new Float32Array(1);
  const bits = new Uint32Array(floats.buffer);
  floats[0] = value;
  const x = bits[0]!;
  const sign = (x >>> 16) & 0x8000;
  const exponent = ((x >>> 23) & 0xff) - 127 + 15;
  const mantissa = x & 0x7fffff;
  if (exponent <= 0) {
    // Too small for a half: nought, which is all a distance field of world units ever needs down there.
    return sign;
  }
  if (exponent >= 31) {
    return sign | 0x7c00;
  }
  // Rounded to the nearest, so a distance loses at most half its last place.
  return (sign | (exponent << 10) | (mantissa >>> 13)) + ((mantissa >>> 12) & 1);
}

/** The field as a half-float texture, two numbers a texel. Half floats filter, where full floats may not. */
function sourceOf(field: FogField): BufferImageSource {
  const halves = new Uint16Array(field.distances.length);
  for (let at = 0; at < halves.length; at += 1) {
    halves[at] = toHalf(field.distances[at]!);
  }
  return new BufferImageSource({
    resource: halves,
    width: field.width,
    height: field.height,
    format: 'rg16float',
    scaleMode: 'linear',
    addressMode: 'clamp-to-edge',
    autoGenerateMipmaps: false,
  });
}

/** A texture for when there is no field, which the shader never reads. */
function emptySource(): BufferImageSource {
  return new BufferImageSource({
    resource: new Uint16Array([toHalf(REACH), toHalf(REACH)]),
    width: 1,
    height: 1,
    format: 'rg16float',
  });
}

export function createFogLayer() {
  const uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uCentre: { value: new Float32Array(2), type: 'vec2<f32>' },
    uScale: { value: 1, type: 'f32' },
    uTilt: { value: new Float32Array([1, 0, 1]), type: 'vec3<f32>' },
    uWorldSide: { value: WORLD_MASTER_WIDTH, type: 'f32' },
    uFieldOrigin: { value: new Float32Array(2), type: 'vec2<f32>' },
    uFieldSize: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uHasField: { value: 0, type: 'f32' },
    uReach: { value: REACH, type: 'f32' },
    uTime: { value: 0, type: 'f32' },
  });
  let source = emptySource();
  const shader = new Shader({
    glProgram: GlProgram.from({
      vertex: VERTEX,
      fragment: FRAGMENT,
      name: 'fog-of-war',
      // World units run to 32768, which a medium-precision float cannot place to within a unit.
      preferredFragmentPrecision: 'highp',
    }),
    resources: { fogUniforms: uniforms, uField: source },
  });
  // The world's sprites under the fog lose their colour by the same uniforms and the same field.
  const uncolour = new Filter({
    glProgram: GlProgram.from({
      vertex: WORLD_VERTEX,
      fragment: WORLD_FRAGMENT,
      name: 'fog-of-war-uncolour',
      preferredFragmentPrecision: 'highp',
    }),
    resources: { fogUniforms: uniforms, uField: source },
  });
  const mesh = new Mesh({
    geometry: new Geometry({
      attributes: { aPosition: { buffer: COVER, format: 'float32x2', stride: 8, offset: 0 } },
    }),
    shader,
  });
  mesh.visible = false;

  let shown: FogField | null = null;

  return {
    /** The mesh, to be placed in the stage between what the fog covers and what it does not. */
    mesh,

    /**
     * The filter that takes the colour out of the world's sprites on ground only revealed, for the container
     * holding everything under the fog. Worth putting on only while there is revealed ground to draw.
     */
    uncolour,

    /** What to draw from now on: nothing, a world that is all unknown, or a house's fog. */
    show(next: FogToDraw): void {
      mesh.visible = next !== null;
      const field = next?.field ?? null;
      if (field !== shown) {
        shown = field;
        const previous = source;
        source = field === null ? emptySource() : sourceOf(field);
        shader.resources.uField = source;
        uncolour.resources.uField = source;
        previous.destroy();
      }
      uniforms.uniforms.uHasField = field === null ? 0 : 1;
      if (field !== null) {
        uniforms.uniforms.uFieldOrigin[0] = field.originX;
        uniforms.uniforms.uFieldOrigin[1] = field.originY;
        uniforms.uniforms.uFieldSize[0] = field.width * field.unitsPerTexel;
        uniforms.uniforms.uFieldSize[1] = field.height * field.unitsPerTexel;
      }
      uniforms.update();
    },

    /** Follows the camera: called with the view the rest of the frame is drawn from. */
    follow(view: CameraView): void {
      const centre = toMercatorExact(view.center);
      const tilt = groundTilt(view);
      uniforms.uniforms.uSize[0] = view.width;
      uniforms.uniforms.uSize[1] = view.height;
      uniforms.uniforms.uCentre[0] = centre.x * WORLD_MASTER_WIDTH;
      uniforms.uniforms.uCentre[1] = centre.y * WORLD_MASTER_WIDTH;
      uniforms.uniforms.uScale = pixelsPerWorldUnit(view.zoom);
      uniforms.uniforms.uTilt[0] = tilt.cos;
      uniforms.uniforms.uTilt[1] = tilt.sin;
      uniforms.uniforms.uTilt[2] = tilt.lean;
      uniforms.update();
    },

    /** Whether anything is being drawn, and from what, for the development probe. */
    /** Moves the haze's clock on, to so many seconds; the haze drifts by it and nothing else does. */
    setTime(seconds: number): void {
      uniforms.uniforms.uTime = seconds;
      uniforms.update();
    },

    /**
     * Whether the haze has anything to move in this view: the fog drawn, the camera close enough for its patches
     * to be seen to move, and some unknown ground on the screen.
     */
    undulates(view: CameraView): boolean {
      return mesh.visible && view.zoom >= UNDULATES_FROM_ZOOM && hazeInView(shown, view);
    },

    report(): { drawing: 'nothing' | 'everything unknown' | 'a field'; field: FogField | null } {
      return {
        drawing: !mesh.visible ? 'nothing' : shown === null ? 'everything unknown' : 'a field',
        field: shown,
      };
    },

    destroy(): void {
      mesh.destroy();
      // The shader lets go of the texture before the texture goes, which is the order Pixi asks for.
      shader.destroy();
      uncolour.destroy();
      source.destroy();
    },
  };
}
