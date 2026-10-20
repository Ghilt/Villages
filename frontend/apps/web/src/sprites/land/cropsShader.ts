import { channelOf } from './landMask';
import { LAND_LOOK } from './look';

/**
 * The crops, a motion of the land: a part of the land shader, `landShader.ts`, whose crops' pass asks `cropsHere`
 * for the crops wherever the land under a pixel is farmland.
 *
 * The farmland is cut into fields, `fieldsShader.ts`, a patchwork of uneven shapes with a bare track along every edge
 * between two. Each field draws whether it lies
 * fallow or stands ripe or green, and which way its rows run, and is washed faintly in its colour so the patchwork
 * shows. Long waves roll through the crops down the wind, broad bands across it, slower than the gusts and carried
 * by the wall clock as they are, so every browser has the same wave at the same place; where one passes the crops
 * show their paler side. Close in, stalks stand in rows, a stroke each from a shaded root to a lit tip, bending down
 * the wind as a wave passes and swaying a little when none does. Every number is in `look.ts`, under `crops`, and
 * the sliders' in `cropsTuning.ts`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => rgb.map(float).join(', ');

const C = LAND_LOOK.crops;
const S = C.stalks;

export const CROPS_GLSL = `
// How the crops stand, from the sliders: cropsTuning.ts says what each is.
uniform float uFieldSize;
uniform float uFallow;
uniform float uRows;
uniform float uCropHeight;
uniform float uWaves;
// The long waves' lattice, its cell along the wind and how many cells it comes round after, and how far the wind has
// carried them, in world units modulo the world's width: ../wind.ts.
uniform vec2 uWaveLattice;
uniform float uWaveCarried;

const int CROPS = ${channelOf('crops')};
const float RIPE = ${float(C.ripe)};
const float TRACK = ${float(C.track)};
const vec3 RIPE_WASH = vec3(${colour(C.wash.ripe)});
const vec3 GREEN_WASH = vec3(${colour(C.wash.green)});
const vec3 FALLOW_WASH = vec3(${colour(C.wash.fallow)});
const float WASH_ALPHA = ${float(C.wash.opacity)};
const float WAVE_STRETCH = ${float(C.waves.stretch)};
const vec3 WAVE_SHEEN = vec3(${colour(C.waves.sheen)});
const vec3 WAVE_SHADE = vec3(${colour(C.waves.shade)});
const float WAVE_SHADE_ALPHA = ${float(C.waves.shadeOpacity)};
const float WAVE_BEHIND = ${float(C.waves.behind)};
const float STALK_ALONG = ${float(S.along)};
const float STALK_WIDTH = ${float(S.width)};
const float STALK_BEND = ${float(S.bend)};
const float STALK_SWAY = ${float(S.sway)};
const float STALK_SWAY_SPEED = ${float(S.swaySpeed)};
const vec3 RIPE_ROOT = vec3(${colour(S.ripeRoot)});
const vec3 RIPE_TIP = vec3(${colour(S.ripeTip)});
const vec3 GREEN_ROOT = vec3(${colour(S.greenRoot)});
const vec3 GREEN_TIP = vec3(${colour(S.greenTip)});
const float STALK_ROOT_ALPHA = ${float(S.rootOpacity)};
const float STALK_TIP_ALPHA = ${float(S.tipOpacity)};
const float ROWS_FROM_PIXELS = ${float(S.fromPixels)};
const float ROWS_WHOLE_PIXELS = ${float(S.wholePixels)};

// How hard a long wave is rolling through the crops here, nought to one: broad bands across the wind that travel down
// it, on a lattice of their own that comes round with the world's width as the gusts' does.
float waveAt(vec2 world) {
  vec2 wind = vec2(dot(world, WIND) - uWaveCarried, dot(world, WIND_ACROSS));
  float wave = windNoise(vec2(wind.x / uWaveLattice.x, wind.y / (uWaveLattice.x * WAVE_STRETCH)), uWaveLattice.y, 111);
  return smoothstep(0.38, 0.8, wave);
}

// The crops over the ground under this pixel, premultiplied: the field's wash and the wave's paler side, and close in
// the stalks standing in the field's rows.
vec4 cropsHere(vec2 world) {
  Field here = fieldAt(world, uFieldSize);
  bool fallow = hash(here.id, 43) < uFallow;
  bool ripe = hash(here.id, 44) < RIPE;
  // Nothing on the track between two fields, so the patchwork's edges show.
  float inside = smoothstep(0.0, TRACK, insideOf(here, world));
  float washAlpha = WASH_ALPHA * inside;
  vec3 rgb = (fallow ? FALLOW_WASH : ripe ? RIPE_WASH : GREEN_WASH) * washAlpha;
  float alpha = washAlpha;
  if (!fallow) {
    // Where a wave is, the crops bend and show their paler side; just behind it, up the wind, those it has passed
    // stand up again and show their darker one, so a wave reads as a band of light with its shadow behind it.
    float wave = waveAt(world);
    float shade = (1.0 - wave) * waveAt(world + WIND * uWaveLattice.x * WAVE_BEHIND) * uWaves * WAVE_SHADE_ALPHA * inside;
    rgb = WAVE_SHADE * shade + rgb * (1.0 - shade);
    alpha = shade + alpha * (1.0 - shade);
    float sheen = wave * uWaves * inside;
    rgb = WAVE_SHEEN * sheen + rgb * (1.0 - sheen);
    alpha = sheen + alpha * (1.0 - sheen);
  }

  // The stalks, while the rows are far enough apart on the screen to be worth drawing.
  float worth = smoothstep(ROWS_FROM_PIXELS, ROWS_WHOLE_PIXELS, uRows * uScale);
  if (worth <= 0.0) {
    return vec4(rgb, alpha);
  }
  // Which way down the wind is on the screen, and how tall a stalk stands there, in pixels.
  vec2 downWind = screenOf(uCentre + WIND) - screenOf(uCentre);
  downWind /= max(length(downWind), 1e-6);
  float tall = uCropHeight * uScale;
  float thick = max(STALK_WIDTH, uPixel * 1.2);
  // A stalk rises from its root and leans down the wind, so the roots that can reach this pixel lie on the ground
  // below it and up the wind from it: the field there, and the rows and stalks of it about there, are the ones looked at.
  vec2 reach = groundUnder(vScreen + vec2(0.0, tall * 0.5) - downWind * tall * 0.3);
  Field field = fieldAt(reach, uFieldSize);
  if (hash(field.id, 43) < uFallow) {
    return vec4(rgb, alpha);
  }
  bool ripeThere = hash(field.id, 44) < RIPE;
  vec3 rootColour = ripeThere ? RIPE_ROOT : GREEN_ROOT;
  vec3 tipColour = ripeThere ? RIPE_TIP : GREEN_TIP;
  float way = hash(field.id, 45) * 3.14159265;
  vec2 along = vec2(cos(way), sin(way));
  vec2 across = vec2(-along.y, along.x);
  float spacing = uRows * STALK_ALONG;
  vec2 off = reach - field.middle;
  int row0 = int(floor(dot(off, across) / uRows + 0.5));
  int stalk0 = int(floor(dot(off, along) / spacing + 0.5));
  // The wave changes slowly over the ground, so it is read once for the stalks about here, as the grass reads its gust.
  float blow = waveAt(reach);
  float ink = 0.0;
  vec3 drawn = vec3(0.0);
  float inkAlpha = 0.0;
  for (int dr = -2; dr <= 2; dr++) {
    for (int ds = -2; ds <= 2; ds++) {
      int row = row0 + dr;
      int at = stalk0 + ds;
      ivec2 stalk = ivec2(at, row) + field.id * 4099;
      // Every other row a half a stalk along, and each stalk a little off its place.
      float stagger = float(row & 1) * 0.5 + (hash(stalk, 46) - 0.5) * 0.3;
      vec2 rootWorld = field.middle + along * ((float(at) + stagger) * spacing) + across * (float(row) * uRows);
      if (insideOf(field, rootWorld) < TRACK || rootsAt(rootWorld)[CROPS] < 0.5) {
        continue;
      }
      vec2 root = screenOf(rootWorld);
      float sway = sin(TAU * (uTime * STALK_SWAY_SPEED + hash(stalk, 47))) * STALK_SWAY;
      float size = tall * mix(0.8, 1.1, hash(stalk, 48));
      vec2 tip = root + vec2(0.0, -size) + downWind * size * (blow * STALK_BEND + sway);
      float on = 1.0 - smoothstep(thick * 0.5, thick * 0.5 + uPixel, segment(vScreen, root, tip));
      if (on > ink) {
        ink = on;
        vec2 rise = tip - root;
        float lit = clamp(dot(vScreen - root, rise) / max(dot(rise, rise), 1e-6), 0.0, 1.0);
        vec3 tipLit = mix(tipColour, WAVE_SHEEN, blow * 0.5);
        drawn = mix(rootColour * STALK_ROOT_ALPHA, tipLit * STALK_TIP_ALPHA, lit);
        inkAlpha = mix(STALK_ROOT_ALPHA, STALK_TIP_ALPHA, lit);
      }
    }
  }
  ink *= worth;
  float strokeAlpha = inkAlpha * ink;
  rgb = drawn * ink + rgb * (1.0 - strokeAlpha);
  alpha = strokeAlpha + alpha * (1.0 - strokeAlpha);
  return vec4(rgb, alpha);
}
`;
