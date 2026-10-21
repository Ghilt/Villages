import { NOISE_GLSL } from '../../shaders/groundGlsl';

/**
 * The roads drawn as shapes: each stretch a quad about its band, placed on the screen by the sprites' own projection,
 * and each pixel of it covered by how far it lies from the stretch's line, so the band's ends are round and its edges
 * soft, and two stretches meeting run on as one. Every pixel inside is drawn whole, so where two overlap nothing doubles:
 * how strongly the roads show is the picture's own alpha. Close in it is packed earth, its edge ragged by a noise of
 * the ground and two ruts along it; further out a plain line, never thinner than a pixel or two. Drawn into a picture of
 * its own, upside down, as the worked ground is. See docs/plans/houses-bridges-and-road-render.md.
 */

export const ROAD_VERTEX = `#version 300 es
precision highp float;
// The stretch's two ends in world units from the layer's origin; which corner of its quad this is, along and across;
// half its width in world units, and its grade.
in vec4 aEnds;
in vec2 aCorner;
in vec2 aHow;
uniform vec2 uSize;
// The world, from the layer's origin, onto the screen: x = dot(uRowX.xy, p) + uRowX.z, and y the same.
uniform vec3 uRowX;
uniform vec3 uRowY;
// How many world units a pixel of the screen is.
uniform float uPixel;
out vec2 vWorld;
out vec4 vEnds;
out float vHalf;
out float vGrade;

float halfOf(float wide, float grade) {
  // Never thinner than a pixel and a bit, wider for a busier road, so a road far out is a line and not a gap.
  return max(wide, (1.1 + 0.5 * grade) * uPixel);
}

void main() {
  vec2 a = aEnds.xy;
  vec2 b = aEnds.zw;
  vec2 along = b - a;
  float span = length(along);
  vec2 dir = span > 0.0 ? along / span : vec2(1.0, 0.0);
  vec2 side = vec2(-dir.y, dir.x);
  // A bridge comes with ten added to its grade, which is a road's.
  float grade = aHow.y >= 10.0 ? aHow.y - 10.0 : aHow.y;
  float wide = halfOf(aHow.x, grade);
  float reach = wide + 2.0 * uPixel;
  vec2 end = aCorner.x < 0.0 ? a - dir * reach : b + dir * reach;
  vec2 world = end + side * aCorner.y * reach;
  vWorld = world;
  vEnds = aEnds;
  vHalf = wide;
  vGrade = aHow.y;
  vec2 screen = vec2(dot(uRowX.xy, world) + uRowX.z, dot(uRowY.xy, world) + uRowY.z);
  vec2 clip = vec2(screen.x / uSize.x * 2.0 - 1.0, 1.0 - screen.y / uSize.y * 2.0);
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;

export const ROAD_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vWorld;
in vec4 vEnds;
in float vHalf;
in float vGrade;
uniform float uPixel;
// Where the layer's origin is in the world, so the earth's grain stays put whatever the origin.
uniform vec2 uOrigin;
uniform vec3 uRoad;
// Nought far out, a plain line; one close in, packed earth with a ragged edge and ruts.
uniform float uNear;
// How much of a bridge's line is drawn: none where its picture stands.
uniform float uBridges;
out vec4 fragColor;

${NOISE_GLSL}

void main() {
  vec2 a = vEnds.xy;
  vec2 ab = vEnds.zw - a;
  float span = dot(ab, ab);
  float t = span > 0.0 ? clamp(dot(vWorld - a, ab) / span, 0.0, 1.0) : 0.0;
  float away = length(vWorld - (a + ab * t));
  vec2 world = vWorld + uOrigin;
  // The edge wanders by the ground's noise close in, as a worn edge does.
  float wander = (noise(world * 1.1) - 0.5) * 0.35 * vHalf * uNear;
  float edge = vHalf + wander;
  float soft = max(uPixel * 0.8, vHalf * 0.22 * uNear);
  float cover = 1.0 - smoothstep(edge - soft, edge + uPixel * 0.5, away);
  if (vGrade >= 10.0) {
    cover *= uBridges;
  }
  if (cover <= 0.0) {
    discard;
  }
  float grain = noise(world * 5.0) - 0.5;
  float tint = noise(world * 0.6) - 0.5;
  float across = away / max(vHalf, 0.0001);
  // Two ruts worn by the wheels, a little darker, on either side of the middle.
  float rut = exp(-pow((across - 0.42) / 0.12, 2.0)) * 0.1 * uNear;
  vec3 near = uRoad * (1.0 + grain * 0.16 + tint * 0.1 - rut);
  // Far out, a line of the dust edged darker, to stand out on the painted fields as a road on a map does.
  float core = 1.0 - smoothstep(vHalf * 0.3, vHalf * 0.75, away);
  vec3 far = mix(uRoad * 0.5, uRoad * 1.08, core);
  vec3 colour = mix(far, near, uNear);
  fragColor = vec4(colour * cover, cover);
}
`;
