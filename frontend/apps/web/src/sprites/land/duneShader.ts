import { LIGHT, towardsTheLight } from '../../map/light';

import { ICE_LOOK } from './iceLook';

/**
 * The sand desert's dunes, a part of the ice, the salt and the sand (`iceShader.ts`), which draws them where the land
 * lies in dunes. They lie in clumps of one, two or three here and there, with still sand between them, Adam's word of
 * the evening of 2026-10-18: the sand is cut into cells square to the wind, and a share of them, more in some places
 * than others, hold a clump wholly inside the cell, so no two clumps touch. No dune of a clump touches another either:
 * two stand corner to corner, the second behind the first down the wind and to one side of it, a little sand between
 * them each way, and a third further off, straight behind one of them or straight beside it, end to end. Most are long
 * ridges, their ends bending down the wind or the whole of them bent as an S, one end up the wind and the other down
 * it; the rest crescents, their horns reaching down the wind. Each stands whole, with a long gentle slope up to its
 * crest and a short steep slip face down the lee.
 *
 * They stand up the screen as the trees and the tufts do: a pixel sees the frontmost dune whose face reaches up to it,
 * found by walking down the screen from as high as a dune stands to the ground under the pixel, and its face is lit or
 * shaded by the map's one light (`map/light.ts`), the sand rippled; and sand streams over the crests in thin curling
 * ribbons along the screen. Every number is in `iceLook.ts`, under `dunes` and `sandFlow`.
 */

const float = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));
const colour = (rgb: readonly number[]): string => `vec3(${rgb.map(float).join(', ')})`;
const pair = (two: readonly number[]): string => `vec2(${two.map(float).join(', ')})`;

const U = ICE_LOOK.dunes;
const F = ICE_LOOK.sandFlow;
const C = U.clumps;
/** How many of its cells the sand's flow comes round after: an hour's flow, so it never jumps. */
const SAND_AROUND = Math.round((F.speed * 3600) / F.cell);

/** The most a dune reaches down the wind, the deepest of them bent both ways, and across it, the longest, in world units. */
const DEEPEST = Math.max(2 * U.bends.most + U.depth, U.depth * (1 + U.horns));
const LONGEST = Math.max(3 * U.stretch, U.length);
/**
 * How far a clump reaches at the most, in world units: down the wind, three of the deepest one behind another, the
 * third the furthest off; and across it, two of the longest corner to corner. A third beside the other two stands
 * there only where the clump still fits its cell, so these are the most of any clump.
 */
export const CLUMP_ALONG = 3 * DEEPEST + U.near[1] + U.far[1];
export const CLUMP_ACROSS = 2 * LONGEST + U.near[1];
/** The room a clump has in its cell, down the wind and across it, inside the margins. */
export const CLUMP_ROOM = [C.cell[0] - 2 * C.margin, C.cell[1] - 2 * C.margin] as const;

/** The one light as a step towards it, east, south and up, so a dune's face is lit as the hills are. */
const towards = towardsTheLight();
const up = (LIGHT.altitude * Math.PI) / 180;
const LIGHT_TOWARDS = [towards.east * Math.cos(up), towards.south * Math.cos(up), Math.sin(up)];

export const DUNE_GLSL = `
// How high the dunes stand and how many clumps of them there are, from the sliders: iceTuning.ts says what each is.
uniform float uDunes;
uniform float uDuneClumps;
// A point of the ground, in world units, where a page that shows one dune - the renders page - asks for one, and
// whether it does.
uniform vec3 uDuneShown;

const vec2 DUNE_CELL = ${pair(C.cell)};
const vec2 DUNE_ROOM = ${pair(CLUMP_ROOM)};
const float DUNE_MARGIN = ${float(C.margin)};
const float DUNE_CLUMP_SHARE = ${float(C.share)};
const float DUNE_CLUMP_PATTERN = ${float(C.patternSize)};
const float DUNE_ONE = ${float(C.together[0])};
const float DUNE_TWO = ${float(C.together[0] + C.together[1])};
const vec2 DUNE_NEAR = ${pair(U.near)};
const vec2 DUNE_FAR = ${pair(U.far)};
const float DUNE_BESIDE = ${float(U.beside)};
const float DUNE_DEPTH = ${float(U.depth)};
const float DUNE_SMALLEST = ${float(U.smallest)};
const float DUNE_HEIGHT = ${float(U.height)};
const float DUNE_CREST = ${float(U.crest)};
const float DUNE_LONG = ${float(U.long)};
const float DUNE_STRETCH = ${float(U.stretch)};
const float DUNE_LENGTH = ${float(U.length)};
const float DUNE_HORNS = ${float(U.horns)};
const float DUNE_BENDS = ${float(U.bends.share)};
const float DUNE_BEND_BY = ${float(U.bends.by)};
const float DUNE_BEND_MOST = ${float(U.bends.most)};
const vec3 DUNE_LIT = ${colour(U.lit)};
const float DUNE_LIT_ALPHA = ${float(U.litOpacity)};
const vec3 DUNE_SHADE = ${colour(U.shade)};
const float DUNE_SHADE_ALPHA = ${float(U.shadeOpacity)};
const float DUNE_CREST_LIGHT = ${float(U.crestLight)};
const float DUNE_CREST_WIDTH = ${float(U.crestWidth)};
const float DUNE_RIPPLES = ${float(U.ripples)};
const float DUNE_RIPPLE_STRENGTH = ${float(U.rippleStrength)};
const int DUNE_STEPS = ${U.steps};
const float SAND_CELL = ${float(F.cell)};
const float SAND_THIN = ${float(F.thin)};
const float SAND_FLOW = ${float(F.speed)};
const float SAND_CURL = ${float(F.curl)};
const float SAND_AROUND = ${float(SAND_AROUND)};
const vec3 LIGHT_TOWARDS = ${colour(LIGHT_TOWARDS)};

// One dune of a clump: how big it is against the biggest; one stretch for a crescent, two or three for a long ridge;
// half its length, across the wind, and its depth down it; how far it is bent as an S, to one side or the other, and
// nought unless it is; how far its ends reach down the wind, as a share of its depth; and where it lies, in the wind's
// frame, the start of it down the wind and its middle across it.
struct Dune {
  float size;
  float runs;
  float reach;
  float depth;
  float bend;
  float horns;
  vec2 at;
};

// A clump of one, two or three dunes in a cell, none at all where the cell holds none, and the box they lie in.
struct Clump {
  ivec2 cell;
  int count;
  Dune a;
  Dune b;
  Dune c;
  vec2 low;
  vec2 high;
};

// A point of the ground in the wind's frame: how far it is down the wind, and how far across it.
vec2 windFrame(vec2 world) {
  return vec2(dot(world, WIND), dot(world, WIND_ACROSS));
}

// Where the cells start, in the wind's frame: at nought, or with a dune shown, so that its point is the middle of one.
vec2 duneCorner() {
  return uDuneShown.z > 0.5 ? windFrame(uDuneShown.xy) - 0.5 * DUNE_CELL : vec2(0.0);
}

ivec2 duneCell(vec2 world) {
  return ivec2(floor((windFrame(world) - duneCorner()) / DUNE_CELL));
}

// How far a dune reaches down the wind from its start, bent both ways and its horns.
float duneDeep(Dune d) {
  return 2.0 * abs(d.bend) + d.depth * (1.0 + d.horns);
}

// The shape of a clump's first, second or third dune, before it is laid. The one a page asks to be shown is a crescent
// at its biggest.
Dune duneShape(ivec2 cell, int at, bool shown) {
  int salt = 200 + at * 10;
  Dune d;
  d.size = shown ? 1.0 : mix(DUNE_SMALLEST, 1.0, hash(cell, salt));
  bool ridge = !shown && hash(cell, salt + 1) < DUNE_LONG;
  d.runs = ridge ? (hash(cell, salt + 2) < 0.5 ? 2.0 : 3.0) : 1.0;
  d.reach = 0.5 * (ridge ? d.runs * DUNE_STRETCH : DUNE_LENGTH * d.size);
  d.depth = DUNE_DEPTH * d.size;
  bool bent = ridge && hash(cell, salt + 4) < DUNE_BENDS;
  d.bend = bent ? min(DUNE_BEND_BY * d.reach, DUNE_BEND_MOST) * (hash(cell, salt + 5) < 0.5 ? -1.0 : 1.0) : 0.0;
  d.horns = bent ? 0.0 : DUNE_HORNS;
  d.at = vec2(0.0);
  return d;
}

// Whether a clump's box, grown to hold a dune laid at a place, still fits the room it has in its cell.
bool duneFits(vec2 low, vec2 high, Dune d, vec2 at) {
  vec2 from = min(low, at - vec2(0.0, d.reach));
  vec2 to = max(high, at + vec2(duneDeep(d), d.reach));
  return all(lessThanEqual(to - from, DUNE_ROOM + 0.01));
}

// The clump of a cell, laid out in the wind's frame. The first dune; the second corner to corner with it, behind it
// down the wind and to one side, a little sand between them each way; and the third further off, straight beside one
// of them, end to end and away from the other, where the clump still fits its cell, or else straight behind the second
// or in front of the first. Then the whole of it is set at a place of the cell inside its margins. With a dune shown,
// only its cell holds one, that dune alone, its middle at the point.
Clump clumpOf(ivec2 cell) {
  Clump k;
  k.cell = cell;
  k.count = 0;
  if (uDuneShown.z > 0.5) {
    if (cell != duneCell(uDuneShown.xy)) return k;
    vec2 shownAt = windFrame(uDuneShown.xy);
    k.count = 1;
    k.a = duneShape(cell, 0, true);
    k.a.at = vec2(shownAt.x - 0.5 * k.a.depth, shownAt.y);
    k.low = k.a.at - vec2(0.0, k.a.reach);
    k.high = k.a.at + vec2(duneDeep(k.a), k.a.reach);
    return k;
  }
  float many = DUNE_CLUMP_SHARE * uDuneClumps * (0.3 + 1.4 * noise(vec2(cell) / DUNE_CLUMP_PATTERN + vec2(5.0, 9.0)));
  if (hash(cell, 190) >= many) return k;
  float together = hash(cell, 191);
  k.count = together < DUNE_ONE ? 1 : together < DUNE_TWO ? 2 : 3;
  k.a = duneShape(cell, 0, false);
  k.b = k.a;
  k.c = k.a;
  vec2 low = vec2(0.0, -k.a.reach);
  vec2 high = vec2(duneDeep(k.a), k.a.reach);
  float side = hash(cell, 194) < 0.5 ? -1.0 : 1.0;
  if (k.count >= 2) {
    k.b = duneShape(cell, 1, false);
    vec2 gap = mix(vec2(DUNE_NEAR.x), vec2(DUNE_NEAR.y), vec2(hash(cell, 195), hash(cell, 196)));
    k.b.at = vec2(high.x + gap.x, side * (k.a.reach + gap.y + k.b.reach));
    low = min(low, k.b.at - vec2(0.0, k.b.reach));
    high = max(high, k.b.at + vec2(duneDeep(k.b), k.b.reach));
  }
  if (k.count == 3) {
    k.c = duneShape(cell, 2, false);
    float wide = mix(DUNE_FAR.x, DUNE_FAR.y, hash(cell, 197));
    bool bySecond = hash(cell, 198) < 0.5;
    vec2 beside = bySecond
      ? vec2(k.b.at.x, k.b.at.y + side * (k.b.reach + wide + k.c.reach))
      : vec2(0.0, -side * (k.a.reach + wide + k.c.reach));
    vec2 behind = bySecond
      ? vec2(k.b.at.x + duneDeep(k.b) + wide, k.b.at.y)
      : vec2(-duneDeep(k.c) - wide, 0.0);
    bool standsBeside = hash(cell, 199) < DUNE_BESIDE && duneFits(low, high, k.c, beside);
    if (standsBeside || duneFits(low, high, k.c, behind)) {
      k.c.at = standsBeside ? beside : behind;
      low = min(low, k.c.at - vec2(0.0, k.c.reach));
      high = max(high, k.c.at + vec2(duneDeep(k.c), k.c.reach));
    } else {
      k.count = 2;
    }
  }
  vec2 room = max(DUNE_ROOM - (high - low), vec2(0.0));
  vec2 from = duneCorner() + vec2(cell) * DUNE_CELL + DUNE_MARGIN + vec2(hash(cell, 192), hash(cell, 193)) * room;
  vec2 shift = from - low;
  k.a.at += shift;
  k.b.at += shift;
  k.c.at += shift;
  k.low = from;
  k.high = from + (high - low);
  return k;
}

Clump clumpAt(vec2 world) {
  return clumpOf(duneCell(world));
}

// One dune at a point of the wind's frame: how high it stands there and how far through it the point is, as duneAt
// says. A long ridge's ends, or a crescent's whole length, are lower and, but for an S, bend down the wind.
vec2 duneHere(Dune d, vec2 here) {
  vec2 off = here - d.at;
  float x = off.y / d.reach;
  if (abs(x) >= 1.0) return vec2(0.0, -1.0);
  float ends = pow(abs(x), 2.0 * d.runs);
  float phase = (off.x - abs(d.bend) - d.bend * 2.598 * (x - x * x * x)) / d.depth - d.horns * ends;
  if (phase <= 0.0 || phase >= 1.0) return vec2(0.0, -1.0);
  float profile = phase < DUNE_CREST
    ? smoothstep(0.0, DUNE_CREST, phase)
    : 1.0 - smoothstep(DUNE_CREST, 1.0, phase);
  return vec2(DUNE_HEIGHT * uDunes * d.size * (1.0 - ends) * profile, phase);
}

// A clump's dune at a point of the ground: how high it stands there, in world units, and how far through the dune the
// point is down the wind, nought at the foot of its windward slope, the crest at DUNE_CREST, one where its slip face
// ends; and minus one on the still sand about the dunes.
vec2 clumpHere(Clump k, vec2 world) {
  vec2 here = windFrame(world);
  vec2 best = vec2(0.0, -1.0);
  if (k.count == 0 || any(lessThan(here, k.low)) || any(greaterThan(here, k.high))) return best;
  best = duneHere(k.a, here);
  if (k.count >= 2) {
    vec2 one = duneHere(k.b, here);
    if (one.x > best.x) best = one;
  }
  if (k.count >= 3) {
    vec2 one = duneHere(k.c, here);
    if (one.x > best.x) best = one;
  }
  return best;
}

// The dune at a point of the ground, as clumpHere says: a clump lies wholly inside its own cell, so a point asks only
// its own.
vec2 duneAt(vec2 world) {
  return clumpHere(clumpAt(world), world);
}

// The sand blowing over the dunes: thin streaks along the screen's horizontal, flowing along it the way the wind leans
// and curling as they go, strongest where a gust blows; every motion of it comes round with the hour.
float sandFlowAt(vec2 world) {
  vec2 across = vec2(uTilt.x, uTilt.y);
  vec2 up = vec2(-uTilt.y, uTilt.x);
  float s = dot(world, across);
  float t = dot(world, up);
  float way = dot(WIND, across) < 0.0 ? -1.0 : 1.0;
  float phase = TAU * uTime / SAND_CURL;
  float curl = sin(s / 1.3 - way * 2.0 * phase) * 0.18 + sin(s / 0.55 + way * 3.0 * phase) * 0.07;
  float flow = s - way * SAND_FLOW * uTime;
  float streak = windNoise(vec2(flow / SAND_CELL, (t + curl) / SAND_THIN), SAND_AROUND, 181);
  return smoothstep(0.58, 0.85, streak) * (0.4 + 0.6 * gustAt(world, uCarried));
}

// How high a dune stands under a point of the screen: from the one clump the walk can meet when it stays in a cell, or
// else from whichever cell the ground there is in.
float duneUnder(Clump k, bool alone, vec2 screen) {
  vec2 ground = groundUnder(screen);
  return (alone ? clumpHere(k, ground) : duneAt(ground)).x;
}

// The ground a pixel sees among the dunes: the frontmost whose face reaches up to it, walking down the screen from as
// high as a dune stands to the ground under the pixel, as the trees are seen standing up the screen. The walk is a
// straight line over the ground, so where both its ends are in one cell, as they are but for a thin band along the
// cells' edges, the whole of it is, and that cell's clump is laid out once.
vec2 duneSeen(vec2 world, float weight) {
  float top = DUNE_HEIGHT * uDunes * weight * uScale;
  float step = top / float(DUNE_STEPS);
  Clump k = clumpAt(world);
  bool alone = duneCell(groundUnder(vScreen + vec2(0.0, top + step))) == k.cell;
  for (int i = DUNE_STEPS; i > 0; i--) {
    float rise = step * float(i);
    if (duneUnder(k, alone, vScreen + vec2(0.0, rise)) * weight * uScale >= rise) {
      // Between this step and the one in front of it, which missed, a few halvings find the dune's face to within a
      // fraction of a pixel, so its outline is smooth rather than in steps.
      float hit = rise;
      float miss = rise + step;
      for (int h = 0; h < 4; h++) {
        float middle = 0.5 * (hit + miss);
        if (duneUnder(k, alone, vScreen + vec2(0.0, middle)) * weight * uScale >= middle) hit = middle;
        else miss = middle;
      }
      return groundUnder(vScreen + vec2(0.0, hit));
    }
  }
  return world;
}

// How a dune's face at a point is lit against the flat sand, from minus one, turned from the light, to one, towards it.
// The points it asks about are a breath apart, all of them in the clump of the one point's cell or on still sand.
float duneLight(vec2 world, float phase) {
  float e = 0.06;
  Clump k = clumpAt(world);
  float east = clumpHere(k, world + vec2(e, 0.0)).x - clumpHere(k, world - vec2(e, 0.0)).x;
  float south = clumpHere(k, world + vec2(0.0, e)).x - clumpHere(k, world - vec2(0.0, e)).x;
  vec3 normal = normalize(vec3(-east / (2.0 * e), -south / (2.0 * e), 1.0));
  float lit = (dot(normal, LIGHT_TOWARDS) - LIGHT_TOWARDS.z) * 2.5;
  // The wind's ripples across the windward slopes and the flat sand, shading them finely.
  float windward = phase < 0.0 ? 0.6 : 1.0 - smoothstep(DUNE_CREST - 0.1, DUNE_CREST, phase);
  float along = dot(world, WIND) / DUNE_RIPPLES + noise(world / 1.3) * 2.0;
  lit += sin(TAU * along) * DUNE_RIPPLE_STRENGTH * windward;
  return clamp(lit, -1.0, 1.0);
}
`;
