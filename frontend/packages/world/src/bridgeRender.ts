import { lit, nearness, screen } from './blockOut.ts';
import type { P3 } from './blockOut.ts';
import { ARCHES, BRIDGE_PARTS, SPRINGING, WAY_STEPS, bridgeTriangles, soffitAt } from './bridgeModel.ts';
import type { BridgePart, BridgeWay, ModelPoint } from './bridgeModel.ts';

/*
 * The bridge drawn in the map's own camera along one of its eight ways - the ground turned 26 degrees onto its lattice,
 * the camera looking north and down at 45, the light from the right and above - with a depth buffer, so the arches,
 * the piers seen through them and the cutwaters hide each other as they would; coursed stone on the walls, voussoirs
 * round the arches, setts on the road, and an ink line wherever one part meets another or the sky. Drawn larger than
 * asked and given back at that size, for the caller to shrink: its edges are then smooth. The middle of the deck on the
 * ground is the middle of the picture, whatever the way, so where it stands is known without reading the picture.
 */

/** A picture as rows of red, green, blue and alpha. */
export interface BridgePicture {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

const COLOURS: Readonly<Record<BridgePart, readonly [number, number, number]>> = {
  wall: [181, 166, 140],
  parapet: [176, 162, 138],
  cap: [206, 196, 176],
  deck: [163, 143, 112],
  pier: [150, 138, 116],
  cutwater: [170, 156, 132],
};
const INK: readonly [number, number, number] = [42, 33, 27];

/** A number between nought and one for two whole numbers, the same every time. */
function noise(a: number, b: number): number {
  let hash = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f);
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d);
  return ((hash ^ (hash >>> 12)) >>> 0) / 4294967296;
}

const fraction = (value: number) => value - Math.floor(value);

/** How much darker a point of stone is drawn: the mortar between its courses and blocks, and each block a little apart. */
function stoneAt(part: BridgePart, [s, w, z]: ModelPoint): number {
  if (part === 'cap') return 1;
  if (part === 'deck') {
    const sett = 0.94 + 0.08 * noise(Math.floor(s / 0.09), Math.floor(w / 0.09));
    return fraction(s / 0.09) < 0.12 || fraction(w / 0.09) < 0.12 ? sett * 0.88 : sett;
  }
  // Round an arch, the voussoirs: a ring of blocks laid along the arch's radius.
  const soffit = soffitAt(s);
  if (part === 'wall' && soffit > 0 && z - soffit < 0.11 && Math.abs(Math.abs(w) - 0.55) < 1e-6) {
    const arch = ARCHES.find(({ middle, half }) => Math.abs(s - middle) < half)!;
    const angle = Math.atan2(z - SPRINGING, s - arch.middle);
    const block = Math.floor(angle / 0.16);
    const joint = fraction(angle / 0.16) < 0.14;
    return (joint ? 0.8 : 0.9) * (0.95 + 0.07 * noise(block, 7));
  }
  const course = Math.floor(z / 0.1);
  const offset = course % 2 === 0 ? 0 : 0.11;
  const along = part === 'cutwater' ? s + w : s;
  const block = Math.floor((along + offset) / 0.22);
  const mortar = fraction(z / 0.1) < 0.1 || fraction((along + offset) / 0.22) < 0.05;
  return (mortar ? 0.82 : 1) * (0.93 + 0.1 * noise(block, course));
}

/**
 * The bridge along `way`, `scale` pixels to the world unit, drawn `fine` times larger in each direction: a picture
 * whose middle is the middle of the deck on the ground.
 */
export function renderBridge(way: BridgeWay, scale: number, fine: number): BridgePicture {
  const [steps0, steps1] = WAY_STEPS[way];
  const length = Math.hypot(steps0, steps1);
  const [da, db] = [steps0 / length, steps1 / length];
  const toFrame = ([s, w, z]: ModelPoint): P3 => [s * da - w * db, s * db + w * da, z];
  const triangles = bridgeTriangles().map(({ at, part }) => ({ at, part, frame: at.map(toFrame) }));

  // A picture symmetric about the middle of the deck, so that the middle is where it stands.
  let reachX = 0;
  let reachY = 0;
  for (const { frame } of triangles) {
    for (const point of frame) {
      const [x, y] = screen(point);
      reachX = Math.max(reachX, Math.abs(x));
      reachY = Math.max(reachY, Math.abs(y));
    }
  }
  const margin = 4 / scale;
  const width = 2 * Math.ceil((reachX + margin) * scale) * fine;
  const height = 2 * Math.ceil((reachY + margin) * scale) * fine;
  const pixels = scale * fine;

  const depth = new Float32Array(width * height).fill(-Infinity);
  const parts = new Int8Array(width * height).fill(-1);
  const shade = new Float32Array(width * height);

  for (const { at, part, frame } of triangles) {
    const corners = frame.map((point) => {
      const [x, y] = screen(point);
      return { x: x * pixels + width / 2, y: y * pixels + height / 2, near: nearness(point) };
    });
    const [p, q, r] = corners as [(typeof corners)[0], (typeof corners)[0], (typeof corners)[0]];
    const area = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    if (Math.abs(area) < 1e-9) continue;
    // Its outward way turned towards the camera, which looks from the south and above: the only side ever seen.
    const e1 = frame[1]!.map((value, at) => value - frame[0]![at]!);
    const e2 = frame[2]!.map((value, at) => value - frame[0]![at]!);
    const across = [
      e1[1]! * e2[2]! - e1[2]! * e2[1]!,
      e1[2]! * e2[0]! - e1[0]! * e2[2]!,
      e1[0]! * e2[1]! - e1[1]! * e2[0]!,
    ];
    const toWorld = (a: number, b: number, z: number): [number, number, number] => {
      const [east, south] = screen([a, b, 0]);
      return [east, south / Math.SQRT1_2, z];
    };
    let normal = toWorld(across[0]!, across[1]!, across[2]!);
    const size = Math.hypot(...normal) || 1;
    normal = normal.map((value) => value / size) as [number, number, number];
    if (normal[1] + normal[2] < 0) normal = normal.map((value) => -value) as [number, number, number];
    const light = lit(normal);
    const id = BRIDGE_PARTS.indexOf(part);

    const left = Math.max(0, Math.floor(Math.min(p.x, q.x, r.x)));
    const right = Math.min(width - 1, Math.ceil(Math.max(p.x, q.x, r.x)));
    const top = Math.max(0, Math.floor(Math.min(p.y, q.y, r.y)));
    const bottom = Math.min(height - 1, Math.ceil(Math.max(p.y, q.y, r.y)));
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const wq = ((r.x - px) * (p.y - py) - (r.y - py) * (p.x - px)) / area;
        const wr = ((p.x - px) * (q.y - py) - (p.y - py) * (q.x - px)) / area;
        const wp = 1 - wq - wr;
        if (wp < -1e-6 || wq < -1e-6 || wr < -1e-6) continue;
        const near = wp * p.near + wq * q.near + wr * r.near;
        const at2 = y * width + x;
        if (near <= depth[at2]!) continue;
        depth[at2] = near;
        parts[at2] = id;
        const point: ModelPoint = [
          wp * at[0][0] + wq * at[1][0] + wr * at[2][0],
          wp * at[0][1] + wq * at[1][1] + wr * at[2][1],
          wp * at[0][2] + wq * at[1][2] + wr * at[2][2],
        ];
        shade[at2] = light * stoneAt(part, point);
      }
    }
  }

  // Ink where one part meets another or the sky, about as wide as a placeholder's stroke.
  const ink = new Uint8Array(width * height);
  const reach = Math.max(1, Math.round(fine * (scale / 110)));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const here = parts[y * width + x]!;
      const right = x + 1 < width ? parts[y * width + x + 1]! : -1;
      const below = y + 1 < height ? parts[(y + 1) * width + x]! : -1;
      if (here === right && here === below) continue;
      for (let dy = -reach; dy <= reach; dy += 1) {
        for (let dx = -reach; dx <= reach; dx += 1) {
          const [ix, iy] = [x + dx, y + dy];
          if (ix >= 0 && iy >= 0 && ix < width && iy < height && dx * dx + dy * dy <= reach * reach) {
            ink[iy * width + ix] = 1;
          }
        }
      }
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let at2 = 0; at2 < width * height; at2 += 1) {
    const id = parts[at2]!;
    if (id < 0 && ink[at2] === 0) continue;
    const [red, green, blue] =
      ink[at2] === 1
        ? INK
        : COLOURS[BRIDGE_PARTS[id]!].map((value) => Math.min(255, value * shade[at2]!) | 0);
    data.set([red!, green!, blue!, 255], at2 * 4);
  }
  return { width, height, data };
}
