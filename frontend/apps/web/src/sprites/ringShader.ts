/*
 * The selection ring, a pixel at a time over the square it lies in: a line of warm light on the ground round what is
 * selected, a thin edge of the interface's ink under it so it still reads on ground a house holds, which is drawn in
 * gold, and round it a gold radiance that breathes, a wave of light running out from it every few seconds and fading,
 * and three beads of light going round it. All of it lies on the ground: squashed with it by the mesh it is drawn on,
 * and measured across the ground in pixels, so a ring round a castle is as fine a line as one round a person.
 */

/** How much further than the ring the square it is drawn in reaches, as a share of the ring: room for its radiance. */
export const RING_REACH = 1.6;

export const RING_VERTEX = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vLocal;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vLocal = aPosition;
}
`;

export const RING_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vLocal;
// How far the ring reaches across the ground, in pixels, and the square's reach as a share of it.
uniform float uRadius;
uniform float uReach;
// Seconds, and nought for a ring that is still: no breathing, no wave, the beads where they stand.
uniform float uTime;
uniform float uMoving;
// The mesh's own alpha, which is how far in the ring has faded.
uniform vec4 uColor;
out vec4 fragColor;

const vec3 LIGHT = vec3(1.0, 0.95, 0.78);
const vec3 RADIANCE = vec3(1.0, 0.76, 0.34);
const vec3 INK = vec3(0.141, 0.110, 0.078);
const float TAU = 6.2831853;
// How often it breathes and the wave runs out, in seconds, and how fast the beads go round, turns a second.
const float BREATH = 2.2;
const float WAVE = 2.8;
const float BEADS_TURN = 0.11;

void main() {
  vec2 p = vLocal * uReach;
  float r = length(p);
  // How far from the ring a pixel is, across the ground, in pixels.
  float off = (r - 1.0) * uRadius;
  float breath = uMoving * (0.5 + 0.5 * sin(uTime * TAU / BREATH)) + (1.0 - uMoving) * 0.6;

  float width = max(1.1, uRadius * 0.016);
  float line = exp(-pow(off / width, 2.0));
  float edge = exp(-pow((off - 2.2 * width) / (1.2 * width), 2.0)) * 0.55;
  float glow = exp(-abs(off) / max(4.0, uRadius * (0.10 + 0.08 * breath))) * (0.45 + 0.45 * breath);
  float within = r < 1.0 ? pow(r, 4.0) * (0.14 + 0.12 * breath) : 0.0;

  float phase = fract(uTime / WAVE);
  float wave = uMoving * step(0.0, off) * (1.0 - phase) * (1.0 - phase) * 0.75
    * exp(-pow((off - phase * uRadius * 0.4) / max(2.0, uRadius * 0.035), 2.0));

  float angle = atan(p.y, p.x);
  float beads = pow(max(0.0, cos(3.0 * angle - uTime * TAU * BEADS_TURN)), 40.0) * line * 0.8;

  float light = clamp(line + beads, 0.0, 1.0);
  float warm = clamp(glow + within + wave, 0.0, 1.0);
  vec3 colour = LIGHT * light + RADIANCE * warm * (1.0 - light);
  float alpha = clamp(light + warm, 0.0, 1.0);
  // The ink under the light, so the ring reads on bright ground as well as dark.
  vec4 lit = vec4(colour, alpha);
  vec4 under = vec4(INK * edge, edge);
  fragColor = (lit + under * (1.0 - lit.a)) * uColor.a;
}
`;
