/**
 * What every full-screen pass over the ground in the sprite canvas shares: one triangle that covers the screen, and the
 * sprites' own projection, backwards and forwards, with a hash and a value noise on the lattice of whole numbers. The
 * land's motion (`sprites/land/landShader.ts`) and the worked ground (`sprites/ground/groundShader.ts`) are each one
 * such pass. GROUND_GLSL wants `uSize`, `uCentre`, `uScale` and `uTilt` declared before it, as both declare them.
 */

/** The triangle's vertex shader, drawing into a picture of its own the way up Pixi shows it. */
export const COVER_VERTEX = `#version 300 es
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

export const GROUND_GLSL = `
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
`;
