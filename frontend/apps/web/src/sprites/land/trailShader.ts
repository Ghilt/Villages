import { LAND_LOOK } from './look';

/**
 * The animal trails, Adam's word of 2026-10-19: the odd little trail through the tuft-heavy land, which is only the
 * absence of tufts, as a path the animals keep open. A part of the land shader, `landShader.ts`, which the grass's and
 * the heath's parts ask whether a tuft or a clump is rooted on one.
 *
 * A trail is where a slow field over the ground, two octaves of noise, crosses its middle: a thin winding line that
 * meets and loops as such lines do. It runs only in patches of the land a slower field opens, here and there, and
 * narrows to nothing where its patch closes, so each is a stretch of trail with ends rather than a network over
 * everything. Each pixel reads the field once about the tufts it looks at, with how fast it changes there, so a tuft
 * far from the line knows it from that alone; only a tuft near the line reads the field at its own root. Every number
 * is in `look.ts`, under `trails`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));

const T = LAND_LOOK.trails;

export const TRAIL_GLSL = `
const float TRAIL_SCALE = ${float(T.scale)};
const float TRAIL_FINE = ${float(T.fine)};
const float TRAIL_FINE_WEIGHT = ${float(T.fineWeight)};
const float TRAIL_HALF_WIDTH = ${float(T.halfWidth)};
const float TRAIL_PATCH = ${float(T.patchSize)};
const float TRAIL_FROM = ${float(T.from)};
const float TRAIL_BY = ${float(T.by)};
const float TRAIL_SOFT = ${float(T.soft)};
const float TRAIL_MARGIN = ${float(T.margin)};
// The field's middle, where the trails run.
const float TRAIL_LINE = 0.5 * (1.0 + TRAIL_FINE_WEIGHT);

// The slow field the trails follow: a broad wander and a finer one over it.
float trailField(vec2 world) {
  return noise(world / TRAIL_SCALE + vec2(17.0, 3.0))
    + TRAIL_FINE_WEIGHT * noise(world / (TRAIL_SCALE * TRAIL_FINE) + vec2(41.0, 77.0));
}

// The trails about a point of the ground, for so many of them, nought none: how open its patch is to them, from
// nought to one; the field there; and how fast the field changes, per world unit east and south.
vec4 trailsAbout(vec2 about, float amount) {
  if (amount <= 0.0) {
    return vec4(0.0);
  }
  float from = TRAIL_FROM - TRAIL_BY * amount;
  float open = smoothstep(from, from + TRAIL_SOFT, noise(about / TRAIL_PATCH + vec2(23.0, 61.0)));
  if (open <= 0.0) {
    return vec4(0.0);
  }
  float here = trailField(about);
  float apart = 0.5;
  vec2 slope = vec2(trailField(about + vec2(apart, 0.0)) - here, trailField(about + vec2(0.0, apart)) - here) / apart;
  return vec4(open, here, slope);
}

// Whether a point of the ground near the one the trails were read about is on a trail: within its half-width of the
// line, the trail narrowing to nothing where its patch closes. Far from the line, the field read about the point says
// so; near it, the field at the point itself.
bool onTrail(vec4 trails, vec2 about, vec2 world) {
  if (trails.x <= 0.0) {
    return false;
  }
  float slope = max(length(trails.zw), 1e-4);
  float width = TRAIL_HALF_WIDTH * trails.x;
  float guess = abs(trails.y + dot(trails.zw, world - about) - TRAIL_LINE) / slope;
  if (guess > width + TRAIL_MARGIN) {
    return false;
  }
  return abs(trailField(world) - TRAIL_LINE) < width * slope;
}
`;
