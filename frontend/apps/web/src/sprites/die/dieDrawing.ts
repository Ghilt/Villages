import { Container, Graphics, Matrix, Sprite, Texture } from 'pixi.js';

import type { ScreenPoint } from '../../geometry/cameraMath';
import { BECOMES_A_MARK_AT } from '../twoForms';

import { FACES, add, dot, rotate, scale } from './physics';
import type { DieState, Vec3 } from './physics';

/**
 * The die drawn on the sprite canvas, with no library and no shader of its own. The map's camera is orthographic, so
 * every face of a cube is a parallelogram on the screen: each face the camera can see is a picture of its pips laid on
 * a parallelogram by one affine matrix, over the die's outline, which hides the seams. Its shadow and the landing
 * circle lie on the ground under it. See `docs/plans/choice-roll-podium.md`, *The physics*.
 *
 * In the hand it is the size of a hand, near the eye; on the ground it is the size of a tree, a thing in the world that
 * grows and shrinks with the zoom as the trees do. Between, it flies an arc (`flight.ts`), growing a little as it rises
 * and shrinking as it falls. Out where the map draws only marks, from
 * `BECOMES_A_MARK_AT`, a die on the ground would be a speck, so it is a pin there instead, Adam's word of 2026-10-22: it
shrinks to almost nothing as it falls and becomes the pin in the air, and the pin lands.
 *
 * From zoom 7 out the camera looks straight down, and a die in the air would sit exactly over its shadow. So the die
 * may be seen at an angle of its own wherever the map is flatter, its height a lift up the screen, as the standing
 * scenery is.
 */

/** How the die is drawn. */
export interface DieLook {
  /** Its width on the screen in the hand, in pixels, the same at every zoom. */
  readonly size: number;
  /** Its width lying on the ground, in world units, about a tree's: it is drawn in scale with the ground there. */
  readonly landedWide: number;
  /**
   * How far above its shadow it hangs where it is held, in pixels. Not its height in the world: a die held near the eye
   * and drawn by its height would hang hundreds of pixels from where it will fall, and the shadow would not guide it.
   */
  readonly hang: number;
  /**
   * The least angle it is seen at, in degrees from straight down: the map's own tilt wherever the map is tipped further,
   * so a die close in stands on the ground at the ground's own angle. Null to be seen at the map's alone, which from
   * zoom 7 out is straight down.
   */
  readonly ownAngle: number | null;
}

/** A die smaller on the screen than this, out where the map draws only marks, is drawn as a pin. */
const PIN_UNDER = 14;
/** The pin's height from the ground to the middle of its head, and its head's radius, in pixels. */
const PIN_TALL = 26;
const PIN_HEAD = 11;
/** Where the light comes from: the north-west, high up, as the map's relief is lit. */
const LIGHT: Vec3 = { x: -0.45, y: -0.55, z: 0.7 };
const FACE_PIXELS = 128;
const OUTLINE = 0x2b1d12;

/** Which way the pips of each face run across and down it, in the order of `FACES`. */
const ACROSS: readonly (readonly [Vec3, Vec3])[] = [
  [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: -1 },
  ],
  [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ],
  [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
  ],
];

/** Where the pips of each number stand on a face, from nought to one across and down. */
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[0.5, 0.5]],
  2: [
    [0.27, 0.27],
    [0.73, 0.73],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.27, 0.27],
    [0.73, 0.27],
    [0.27, 0.73],
    [0.73, 0.73],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.27, 0.23],
    [0.73, 0.23],
    [0.27, 0.5],
    [0.73, 0.5],
    [0.27, 0.77],
    [0.73, 0.77],
  ],
};

let faces: Texture[] | null = null;

/** The six faces' pictures, painted once: bone, its corners worn round, and the one in red. */
function faceTextures(): Texture[] {
  if (faces !== null) return faces;
  faces = [1, 2, 3, 4, 5, 6].map((number) => {
    const canvas = document.createElement('canvas');
    canvas.width = FACE_PIXELS;
    canvas.height = FACE_PIXELS;
    const paint = canvas.getContext('2d')!;
    paint.fillStyle = '#efe4c8';
    paint.beginPath();
    paint.roundRect(1, 1, FACE_PIXELS - 2, FACE_PIXELS - 2, FACE_PIXELS * 0.16);
    paint.fill();
    paint.fillStyle = number === 1 ? '#9b2335' : '#2a1d14';
    const radius = FACE_PIXELS * (number === 1 ? 0.12 : 0.085);
    for (const [across, down] of PIPS[number]!) {
      paint.beginPath();
      paint.arc(across * FACE_PIXELS, down * FACE_PIXELS, radius, 0, Math.PI * 2);
      paint.fill();
    }
    return Texture.from(canvas);
  });
  return faces;
}

/** The angle a die is seen at for this map tilt and look, in radians. */
export function seenAt(look: DieLook, pitch: number): number {
  return (Math.max(look.ownAngle ?? 0, pitch) * Math.PI) / 180;
}

/**
 * How far above its ground point the middle of a die lying on the ground, or bouncing on it, is drawn: its height in die
 * widths, at the ground's own scale, a die width being `landed` pixels there.
 */
export function onTheGroundLift(height: number, landed: number, look: DieLook, pitch: number): number {
  return height * Math.sin(seenAt(look, pitch)) * landed;
}

/** How far above its shadow the middle of a die held in the hand is drawn: half itself, and its hang. */
export function inTheHandLift(look: DieLook, pitch: number): number {
  return 0.5 * Math.sin(seenAt(look, pitch)) * look.size + look.hang;
}

/** Whether a die this wide on the screen is drawn as a pin, at this zoom. */
export function asAPin(pixels: number, zoom: number): boolean {
  return zoom < BECOMES_A_MARK_AT && pixels < PIN_UNDER;
}

/**
 * Whether a die this wide in the air is drawn as its pin, at this zoom: out where the map draws only marks, once it has
 * shrunk below `below` pixels, almost nothing, on its way down.
 */
export function aMarkInTheAir(pixels: number, zoom: number, below: number): boolean {
  return zoom < BECOMES_A_MARK_AT && pixels < below;
}

/**
 * How wide the die is on the screen where it lies, the scale its bounce is worked out at: its own width, or a pin's
 * out where the map draws only marks.
 */
export function asItLies(landed: number, zoom: number): number {
  return zoom < BECOMES_A_MARK_AT ? Math.max(landed, PIN_UNDER) : landed;
}

/** Where a point in the die's world lands on the screen, from where its ground point is, seen at an angle. */
export function projected(ground: ScreenPoint, offset: Vec3, angle: number, pixels: number): ScreenPoint {
  return {
    x: ground.x + offset.x * pixels,
    y: ground.y + (offset.y * Math.cos(angle) - offset.z * Math.sin(angle)) * pixels,
  };
}

/** The outline round a handful of points: the gift wrap of them, in order. */
function hull(points: readonly ScreenPoint[]): ScreenPoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const turn = (o: ScreenPoint, a: ScreenPoint, b: ScreenPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (from: ScreenPoint[]) => {
    const kept: ScreenPoint[] = [];
    for (const point of from) {
      while (kept.length >= 2 && turn(kept[kept.length - 2]!, kept[kept.length - 1]!, point) <= 0) kept.pop();
      kept.push(point);
    }
    kept.pop();
    return kept;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

export interface DieDrawing {
  /** The shadow, which lies on the ground, under whatever stands on it. */
  readonly shadow: Graphics;
  /** The die itself, over everything. */
  readonly body: Container;
  /** Its pin, out where the map draws only marks. */
  readonly pin: Container;
  /**
   * Draws the die whose ground point lies at `ground` on the screen, the map tipped `pitch` degrees, its faces carrying
   * `numbers` in the order of `FACES`, `pixels` wide, its middle `lift` pixels above the ground point, and its shadow
   * `landed` wide, the size it is on the ground. `squash` from nought to one flattens it, as a die does the instant it
   * strikes.
   */
  draw(
    ground: ScreenPoint,
    state: DieState,
    numbers: readonly number[],
    pitch: number,
    look: DieLook,
    squash: number,
    pixels: number,
    landed: number,
    lift: number,
  ): void;
  /** Draws it as a pin standing on `ground`, with the number on top on its head, hopping `lift` pixels as it bounces. */
  drawPin(ground: ScreenPoint, number: number, lift: number): void;
  hide(): void;
  destroy(): void;
}

export function createDieDrawing(): DieDrawing {
  const shadow = new Graphics();
  const body = new Container();
  const outline = new Graphics();
  const sides = FACES.map(() => new Sprite(Texture.EMPTY));
  body.addChild(outline, ...sides);
  const pin = new Graphics();
  const pinHead = new Sprite(Texture.EMPTY);
  const pinned = new Container();
  pinned.addChild(pin, pinHead);
  const light = scale(LIGHT, 1 / Math.sqrt(dot(LIGHT, LIGHT)));
  const textures = faceTextures();

  return {
    shadow,
    body,
    pin: pinned,
    draw(ground, state, numbers, pitch, look, squash, pixels, landed, lift) {
      shadow.visible = true;
      body.visible = true;
      pinned.visible = false;
      const height = state.at.z;
      const angle = seenAt(look, pitch);
      // The ground point is where the die is across the ground; its height is the lift it is drawn above it.
      const middle = { x: ground.x, y: ground.y - lift };
      const toward: Vec3 = { x: 0, y: Math.sin(angle), z: Math.cos(angle) };
      const at = (local: Vec3) => projected(middle, rotate(state.turn, local), angle, pixels);

      const lean = Math.cos((pitch * Math.PI) / 180);
      const lifted = Math.max(0, height - 0.5);
      const across = Math.max(3, landed * 0.62);
      shadow.clear();
      shadow
        .ellipse(ground.x, ground.y, across, across * lean)
        .fill({ color: 0x1b140c, alpha: 0.32 / (1 + lifted * 0.3) });

      const corners = [-0.5, 0.5].flatMap((x) =>
        [-0.5, 0.5].flatMap((y) => [-0.5, 0.5].map((z) => at({ x, y, z }))),
      );
      outline.clear();
      outline
        .poly(hull(corners).flatMap((p) => [p.x, p.y]))
        .fill(OUTLINE)
        .stroke({ width: 2, color: OUTLINE, join: 'round' });

      FACES.forEach((face, index) => {
        const side = sides[index]!;
        const facing = rotate(state.turn, face);
        if (dot(facing, toward) <= 0.001) {
          side.visible = false;
          return;
        }
        side.visible = true;
        side.texture = textures[(numbers[index] ?? 1) - 1]!;
        const [u, v] = ACROSS[index]!;
        const corner = (s: number, t: number) =>
          at(add(scale(face, 0.5), add(scale(u, s - 0.5), scale(v, t - 0.5))));
        const a = corner(0, 0);
        const b = corner(1, 0);
        const c = corner(0, 1);
        side.setFromMatrix(
          new Matrix(
            (b.x - a.x) / FACE_PIXELS,
            (b.y - a.y) / FACE_PIXELS,
            (c.x - a.x) / FACE_PIXELS,
            (c.y - a.y) / FACE_PIXELS,
            a.x,
            a.y,
          ),
        );
        const lit = Math.round(255 * (0.62 + 0.38 * Math.max(0, dot(facing, light))));
        side.tint = (lit << 16) | (lit << 8) | lit;
      });

      // Flattened about where it touches the ground, so a squash looks like a strike rather than a shrink.
      const foot = projected(middle, { x: 0, y: 0, z: -0.5 }, angle, pixels);
      body.pivot.set(foot.x, foot.y);
      body.position.set(foot.x, foot.y);
      body.scale.set(1 + 0.14 * squash, 1 - 0.18 * squash);
    },
    drawPin(ground, number, lift) {
      shadow.visible = false;
      body.visible = false;
      pinned.visible = true;
      // A stem from the ground to a round head, the die's own face on the head: what landed, where.
      const foot = { x: ground.x, y: ground.y - lift };
      const head = { x: foot.x, y: foot.y - PIN_TALL };
      pin.clear();
      pin.ellipse(ground.x, ground.y, 4, 2).fill({ color: 0x1b140c, alpha: 0.35 });
      pin
        .poly([foot.x, foot.y, head.x - PIN_HEAD * 0.55, head.y + 2, head.x + PIN_HEAD * 0.55, head.y + 2])
        .fill(OUTLINE);
      pin.circle(head.x, head.y, PIN_HEAD).fill(0xf6d77a).stroke({ width: 2, color: OUTLINE });
      pinHead.texture = textures[number - 1]!;
      pinHead.anchor.set(0.5);
      pinHead.position.set(head.x, head.y);
      pinHead.scale.set((PIN_HEAD * 1.25) / FACE_PIXELS);
    },
    hide() {
      shadow.visible = false;
      body.visible = false;
      pinned.visible = false;
    },
    destroy() {
      shadow.destroy();
      body.destroy({ children: true });
      pinned.destroy({ children: true });
    },
  };
}

/** A puff of dust where the die strikes, a few motes spreading and fading: the juice of a hard landing. */
export interface Dust {
  readonly graphics: Graphics;
  burst(at: ScreenPoint, strength: number, now: number): void;
  /** Draws what is still in the air, and says whether anything is. */
  draw(now: number, lean: number): boolean;
  destroy(): void;
}

const DUST_MS = 420;

export function createDust(): Dust {
  const graphics = new Graphics();
  let puffs: { at: ScreenPoint; strength: number; since: number }[] = [];
  return {
    graphics,
    burst(at, strength, now) {
      puffs.push({ at, strength: Math.min(1, strength), since: now });
    },
    draw(now, lean) {
      puffs = puffs.filter((puff) => now - puff.since < DUST_MS);
      graphics.clear();
      for (const puff of puffs) {
        const age = (now - puff.since) / DUST_MS;
        for (let mote = 0; mote < 6; mote++) {
          const way = (mote / 6) * Math.PI * 2 + puff.strength;
          const out = (10 + 26 * puff.strength) * Math.sqrt(age);
          graphics
            .circle(
              puff.at.x + Math.cos(way) * out,
              puff.at.y + Math.sin(way) * out * lean,
              2 + 5 * puff.strength * (1 - age),
            )
            .fill({ color: 0xcdbb98, alpha: 0.5 * (1 - age) });
        }
      }
      return puffs.length > 0;
    },
    destroy() {
      graphics.destroy();
    },
  };
}
