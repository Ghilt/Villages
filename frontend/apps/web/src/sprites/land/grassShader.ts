import { channelOf } from './landMask';
import { LAND_LOOK, UNDERGROWTH_STEPS } from './look';

/**
 * The grass, the first of the land's motions: a part of the land shader, `landShader.ts`, which finds the ground under
 * each pixel and asks `grassHere` for the grass wherever the land there sways as grass does.
 *
 * Two things move. Gusts travel down the wind as soft bands, and where one blows the field shows its paler
 * side: the world's one wind, `../wind.ts`, which the trees bend in too. And close in, a tuft stands up in every
 * small cell of the ground, a stroke from a shaded root to a lit tip, which the gust bends down the wind and which
 * sways a little when there is none. A tuft stands up the screen, as the trees and the castles do, so it is drawn
 * in pixels from its root rather than lying on the ground. Under the woods' trees it is their undergrowth, sparser,
 * shaded, with more low brush, and sheltered from the gusts: how much of it the grass of a world unit is, the mask
 * says by how far below full it writes the grass there (`strengthOf`), which a tuft reads from the one look at the
 * mask it takes to know it is rooted in grass at all. Every number is in `look.ts`, under `grass`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => rgb.map(float).join(', ');

const G = LAND_LOOK.grass.gusts;
const B = LAND_LOOK.grass.blades;
const P = LAND_LOOK.grass.patches;
const U = LAND_LOOK.grass.undergrowth;

export const GRASS_GLSL = `
// How the grass grows in patches, from the sliders: grassTuning.ts says what each is.
uniform float uPatch;
uniform float uRagged;
uniform float uSoft;
uniform float uMingle;
uniform float uBare;
uniform float uTall;
uniform float uBrush;
uniform float uTallHeight;
uniform float uBrushSize;
uniform float uDensity;
uniform float uGrassTrails;

const int GRASS = ${channelOf('grass')};
const vec3 SHEEN = vec3(${colour(G.colour)});
const float SHEEN_ALPHA = ${float(G.opacity)};
const float CELL = ${float(B.cell)};
const float HEIGHT = ${float(B.height)};
const float WIDTH = ${float(B.width)};
const float BEND = ${float(B.bend)};
const float SWAY = ${float(B.sway)};
const float SWAY_SPEED = ${float(B.swaySpeed)};
const float ROOT_ALPHA = ${float(B.rootOpacity)};
const float TIP_ALPHA = ${float(B.tipOpacity)};
const vec3 ROOT = vec3(${colour(B.root)});
const vec3 TIP = vec3(${colour(B.tip)});
const float UNDERGROWTH_STEPS = ${float(UNDERGROWTH_STEPS)};
const float UNDER_DENSITY = ${float(U.density)};
const vec3 UNDER_ROOT = vec3(${colour(U.root)});
const vec3 UNDER_TIP = vec3(${colour(U.tip)});
const float UNDER_TALL = ${float(U.tall)};
const float UNDER_BRUSH = ${float(U.brush)};
const float UNDER_SHEEN = ${float(U.sheen)};
const float UNDER_BEND = ${float(U.bend)};
const float FROM_PIXELS = ${float(B.fromPixels)};
const float WHOLE_PIXELS = ${float(B.wholePixels)};
const float BARE_LEFT = ${float(P.bareLeft)};
const vec3 TALL_TIP = vec3(${colour(P.tallTip)});
const vec3 BRUSH_DARK = vec3(${colour(P.brushDark)});
const vec3 BRUSH_LIGHT = vec3(${colour(P.brushLight)});
const float BRUSH_ALPHA = ${float(P.brushOpacity)};

// How much of the woods' undergrowth the grass of a world unit is, from the byte the mask writes it at: full for the
// grassland's, a step below full for each step of the woods'. Nought where no grass is rooted.
float woodsOf(float rooted) {
  return rooted < 0.5 ? 0.0 : clamp((1.0 - rooted) * 255.0 / UNDERGROWTH_STEPS, 0.0, 1.0);
}

// The two slow fields over the ground that mark out the patches.
vec2 fieldsAt(vec2 world) {
  vec2 broad = vec2(noise(world / uPatch + vec2(31.0, 7.0)), noise(world / (uPatch * 1.3) + vec2(71.0, 29.0)));
  if (uRagged <= 0.0) {
    return broad;
  }
  // A finer pattern breaks up the broad one's round outlines.
  vec2 fine = vec2(
    noise(world / (uPatch * 0.3) + vec2(13.0, 53.0)),
    noise(world / (uPatch * 0.37) + vec2(47.0, 11.0))
  );
  return mix(broad, fine, uRagged * 0.5);
}

// The odds a patch of ground gives, nought to one each: that a tuft is missing because the ground is bare, that it
// stands tall, and that it is brush. How much of each there is moves where the patterns are cut; how softly one
// gives way to the next widens the band the odds change over, so the kinds thin into each other; and the mingling
// is the odds of tall grass and brush anywhere, outside their own patches too.
vec3 chancesOf(vec2 fields) {
  float bareFrom = 0.5 + (0.5 - uBare) * 0.6;
  float tallFrom = 0.5 + (0.5 - uTall) * 0.6;
  float brushBelow = 0.5 - (0.5 - uBrush) * 0.6;
  float soft = uSoft + 0.002;
  float bare = smoothstep(bareFrom - soft, bareFrom + soft, fields.x);
  float tall = smoothstep(tallFrom - soft, tallFrom + soft, fields.y);
  float brush = 1.0 - smoothstep(brushBelow - soft, brushBelow + soft, fields.y);
  return vec3(bare, mix(uMingle, 1.0, tall), mix(uMingle, 1.0, brush));
}

// The grass over the ground under this pixel, premultiplied: the gusts' paler side, and close in the tufts and the
// brush rooted in the grassland about it.
vec4 grassHere(vec2 world) {
  // The gusts show least on bare ground and most in tall grass, and the brush hardly bends; under the trees, little.
  vec3 kindHere = chancesOf(fieldsAt(world));
  float sheltered = mix(1.0, UNDER_SHEEN, woodsOf(rootedExactly(world)[GRASS]));
  float gust = gustAt(world, uCarried) * (1.0 - 0.85 * kindHere.x) * (1.0 + 0.6 * kindHere.y) * (1.0 - 0.5 * kindHere.z) * sheltered;
  vec3 rgb = SHEEN * gust * SHEEN_ALPHA;
  float alpha = gust * SHEEN_ALPHA;

  // The tufts and the brush, while a cell is big enough on the screen to be worth one.
  float worth = smoothstep(FROM_PIXELS, WHOLE_PIXELS, CELL * uScale);
  if (worth > 0.0) {
    // Which way down the wind is on the screen, and how tall a tuft stands there, in pixels.
    vec2 downWind = screenOf(uCentre + WIND) - screenOf(uCentre);
    downWind /= max(length(downWind), 1e-6);
    float tall = HEIGHT * uScale;
    float tallest = tall * uTallHeight * 1.15;
    float thick = max(WIDTH, uPixel * 1.2);
    // A tuft rises from its root and leans down the wind, so the roots that can reach this pixel lie on the
    // ground below it and up the wind from it: the cells about there are the ones looked at.
    vec2 reach = groundUnder(vScreen + vec2(0.0, tallest * 0.5) - downWind * tallest * 0.3) / CELL;
    ivec2 middle = ivec2(floor(reach));
    // The patch fields and the gust change slowly over the ground, so they are worked out once, about the middle
    // of the cells looked at, with how fast the fields change there, and each cell reads its own off that: a tuft
    // is the same kind and bends the same way in every pixel it covers, for a fraction of the work.
    vec2 about = reach * CELL;
    vec2 fields = fieldsAt(about);
    vec2 east = fieldsAt(about + vec2(1.0, 0.0)) - fields;
    vec2 south = fieldsAt(about + vec2(0.0, 1.0)) - fields;
    float blow = gustAt(about, uCarried);
    // The animal trails about here, where a tuft is missing: trailShader.ts.
    vec4 trails = trailsAbout(about, uGrassTrails);
    float ink = 0.0;
    vec3 colour = vec3(0.0);
    float inkAlpha = 0.0;
    for (int dy = -2; dy <= 2; dy++) {
      for (int dx = -2; dx <= 2; dx++) {
        ivec2 cell = middle + ivec2(dx, dy);
        vec2 rootWorld = (vec2(cell) + vec2(hash(cell, 1), hash(cell, 2))) * CELL;
        float rooted = rootedExactly(rootWorld)[GRASS];
        if (rooted < 0.5) {
          continue;
        }
        float woods = woodsOf(rooted);
        vec2 off = rootWorld - about;
        vec3 odds = chancesOf(fields + east * off.x + south * off.y);
        // Under the trees, little of the patches' tall grass, and low brush besides theirs.
        odds.y *= mix(1.0, UNDER_TALL, woods);
        odds.z = mix(odds.z, 1.0, UNDER_BRUSH * woods);
        // So many of the tufts there could be grow at all, fewer under the trees, and bare ground keeps only a few.
        if (hash(cell, 5) > uDensity * mix(1.0, UNDER_DENSITY, woods) * mix(1.0, BARE_LEFT, odds.x)) {
          continue;
        }
        // None grows on an animal trail.
        if (onTrail(trails, about, rootWorld)) {
          continue;
        }
        // Each tuft draws its kind: brush, tall grass, or the meadow's own.
        float draw = hash(cell, 6);
        bool isBrush = draw < odds.z;
        float isTall = !isBrush && draw < odds.z + odds.y * (1.0 - odds.z) ? 1.0 : 0.0;
        vec2 root = screenOf(rootWorld);
        if (isBrush) {
          // Brush: a low round clump, shaded under and lit on top, that a gust only nudges.
          float r = uBrushSize * uScale * mix(0.75, 1.25, hash(cell, 4));
          vec2 centre = root + vec2(0.0, -r * 0.8) + downWind * r * blow * 0.25;
          float d = length((vScreen - centre) * vec2(1.0, 1.15)) - r;
          float on = 1.0 - smoothstep(-uPixel * 0.5, uPixel * 0.5, d);
          if (on > ink) {
            ink = on;
            float top = clamp((centre.y - vScreen.y) / max(r, 1e-3) * 0.5 + 0.5, 0.0, 1.0);
            colour = mix(BRUSH_DARK, BRUSH_LIGHT, top) * BRUSH_ALPHA;
            inkAlpha = BRUSH_ALPHA;
          }
        } else {
          // A tuft: a stroke from a shaded root to a lit tip, taller and paler in tall grass, bending down the wind.
          float sway = sin(TAU * (uTime * SWAY_SPEED + hash(cell, 3))) * SWAY;
          float size = tall * mix(1.0, uTallHeight, isTall) * mix(0.7, 1.15, hash(cell, 4));
          float bend = blow * BEND * mix(1.0, UNDER_BEND, woods) * mix(1.0, 1.3, isTall);
          vec2 tip = root + vec2(0.0, -size) + downWind * size * (bend + sway);
          float width = thick * mix(1.0, 1.25, isTall);
          float on = 1.0 - smoothstep(width * 0.5, width * 0.5 + uPixel, segment(vScreen, root, tip));
          if (on > ink) {
            ink = on;
            vec2 rise = tip - root;
            float lit = clamp(dot(vScreen - root, rise) / max(dot(rise, rise), 1e-6), 0.0, 1.0) * mix(0.75, 1.0, blow);
            vec3 rootColour = mix(ROOT, UNDER_ROOT, woods);
            vec3 tipColour = mix(TIP, UNDER_TIP, woods);
            colour = mix(rootColour * ROOT_ALPHA, mix(tipColour, TALL_TIP, isTall) * TIP_ALPHA, lit);
            inkAlpha = mix(ROOT_ALPHA, TIP_ALPHA, lit);
          }
        }
      }
    }
    ink *= worth;
    float strokeAlpha = inkAlpha * ink;
    rgb = colour * ink + rgb * (1.0 - strokeAlpha);
    alpha = strokeAlpha + alpha * (1.0 - strokeAlpha);
  }
  return vec4(rgb, alpha);
}
`;
