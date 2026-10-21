/*
 * Block-outs in the map's own camera: points in a piece's frame - back-left from its front corner, back-right, and
 * up, in world units - projected as the map draws the ground, turned 26 degrees onto its lattice and seen from the
 * south and 45 degrees above, and faces of boxes, roofs, round walls and cones lit from the right, drawn far before
 * near into an SVG. What the placeholder pictures of the settlements and the bridges are drawn from
 * (`settlementLooks.ts`), so each stands on the diamonds of its footprint as a painted one will.
 */

const TURN = (26 * Math.PI) / 180;
const LEAN = Math.SQRT1_2;
const RISE = Math.SQRT1_2;
const INK = '#2a211b';

/** A point in a piece's own frame: back-left from its front corner, back-right, and up, in world units. */
export type P3 = readonly [a: number, b: number, z: number];

/** Where a point lands on the ground, east and south, from the front corner. */
export function ground([a, b]: P3): { east: number; south: number } {
  return {
    east: -a * Math.cos(TURN) + b * Math.sin(TURN),
    south: -a * Math.sin(TURN) - b * Math.cos(TURN),
  };
}

/** Where a point lands on the picture, in world units: the camera tips the ground and lifts what stands on it. */
export function screen(point: P3): [number, number] {
  const { east, south } = ground(point);
  return [east, south * LEAN - point[2] * RISE];
}

/** How near the camera a point is, for drawing far before near. */
export function nearness(point: P3): number {
  return ground(point).south + point[2];
}

/** A face to draw: its corners, its colour, and its outward direction as east, south, up. */
export interface Face {
  readonly at: readonly P3[];
  readonly fill: string;
  readonly normal: readonly [number, number, number];
}

/** How bright a face is under the light from the right and above, nought to one. */
export function lit([east, , up]: readonly [number, number, number]): number {
  return Math.max(0.35, Math.min(1, 0.55 + 0.35 * east + 0.3 * up));
}

export function shade(hex: string, by: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (shift: number) => Math.round(Math.min(255, ((n >> shift) & 255) * by));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

/** The outward direction of a side whose face looks along the piece's own back-left (-a) or back-right (-b). */
export function along(a: number, b: number): [number, number, number] {
  const { east, south } = ground([a, b, 0]);
  const length = Math.hypot(east, south) || 1;
  return [east / length, south / length, 0];
}

/** A box from `a`, `b`, `z`, so long along each: its two faces toward the camera and its top. */
export function box(
  a: number,
  b: number,
  z: number,
  la: number,
  lb: number,
  h: number,
  fill: string,
  top = fill,
): Face[] {
  return [
    {
      at: [
        [a, b, z],
        [a + la, b, z],
        [a + la, b, z + h],
        [a, b, z + h],
      ],
      fill,
      normal: along(0, -1),
    },
    {
      at: [
        [a, b, z],
        [a, b + lb, z],
        [a, b + lb, z + h],
        [a, b, z + h],
      ],
      fill,
      normal: along(-1, 0),
    },
    {
      at: [
        [a, b, z + h],
        [a + la, b, z + h],
        [a + la, b + lb, z + h],
        [a, b + lb, z + h],
      ],
      fill: top,
      normal: [0, 0, 1],
    },
  ];
}

/** A gable roof over a box, its ridge running back-left at mid-depth, `rise` above the walls at `z`. */
export function gable(
  a: number,
  b: number,
  z: number,
  la: number,
  lb: number,
  rise: number,
  fill: string,
  wall: string,
): Face[] {
  const ridge = b + lb / 2;
  return [
    {
      at: [
        [a, b + lb, z],
        [a + la, b + lb, z],
        [a + la, ridge, z + rise],
        [a, ridge, z + rise],
      ],
      fill,
      normal: [0.2, -0.4, 0.9],
    },
    {
      at: [
        [a, b, z],
        [a, b + lb, z],
        [a, ridge, z + rise],
      ],
      fill: wall,
      normal: along(-1, 0),
    },
    {
      at: [
        [a, b, z],
        [a + la, b, z],
        [a + la, ridge, z + rise],
        [a, ridge, z + rise],
      ],
      fill,
      normal: [-0.1, 0.6, 0.8],
    },
  ];
}

/** A hipped roof, its four slopes meeting at a short ridge: the East Asian roofs, a little wider than their walls. */
export function hip(
  a: number,
  b: number,
  z: number,
  la: number,
  lb: number,
  rise: number,
  fill: string,
): Face[] {
  const over = 0.25;
  const [a0, b0, a1, b1] = [a - over, b - over, a + la + over, b + lb + over];
  const r0: P3 = [a + la * 0.35, b + lb / 2, z + rise];
  const r1: P3 = [a + la * 0.65, b + lb / 2, z + rise];
  return [
    { at: [[a0, b1, z], [a1, b1, z], r1, r0], fill, normal: [0.2, -0.5, 0.85] },
    { at: [[a1, b0, z], [a1, b1, z], r1], fill, normal: [0.5, 0.2, 0.85] },
    {
      at: [[a0, b0, z], [a0, b1, z], r0],
      fill,
      normal: along(-1, 0).map((n) => n * 0.5) as [number, number, number],
    },
    { at: [[a0, b0, z], [a1, b0, z], r1, r0], fill, normal: [-0.1, 0.6, 0.8] },
  ];
}

/** A round wall of so many sides about a middle, and a cone of thatch or a low dome over it. */
export function round(
  a: number,
  b: number,
  z: number,
  radius: number,
  h: number,
  wall: string,
  rise: number,
  cap: string,
): Face[] {
  const sides = 14;
  const faces: Face[] = [];
  const ring = (r: number, at: number): P3[] =>
    Array.from({ length: sides }, (_, i) => {
      const t = (i / sides) * 2 * Math.PI;
      return [a + r * Math.cos(t), b + r * Math.sin(t), at] as P3;
    });
  const low = ring(radius, z);
  const high = ring(radius, z + h);
  const eave = ring(radius * 1.15, z + h);
  const apex: P3 = [a, b, z + h + rise];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    const mid: P3 = [(low[i]![0] + low[j]![0]) / 2 - a, (low[i]![1] + low[j]![1]) / 2 - b, 0];
    const normal = along(-mid[0], -mid[1]).map((n) => -n) as [number, number, number];
    faces.push({ at: [low[i]!, low[j]!, high[j]!, high[i]!], fill: wall, normal });
    faces.push({
      at: [eave[i]!, eave[j]!, apex],
      fill: cap,
      normal: [normal[0] * 0.6, normal[1] * 0.6, 0.8],
    });
  }
  return faces;
}

/**
 * The faces as an SVG drawn `scale` pixels to the world unit, far drawn first, the front corner of the ground the
 * lowest drawn, with a margin of a few pixels. One scale for every picture, so that one painted over it, the same size,
 * is the same scale, and the cutter can say how many world units it stands.
 */
export function facesSvg(faces: readonly Face[], scale: number): string {
  const points = faces.flatMap((face) => face.at.map(screen));
  const [minX, maxX] = [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[0]))];
  const [minY, maxY] = [Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[1]))];
  const margin = 6;
  const width = Math.ceil((maxX - minX) * scale + 2 * margin);
  const size = Math.ceil((maxY - minY) * scale + 2 * margin);
  const drawn = faces
    .filter((face) => face.normal[1] + face.normal[2] > -0.05)
    .map((face) => ({ face, near: face.at.reduce((sum, p) => sum + nearness(p), 0) / face.at.length }))
    .sort((one, other) => one.near - other.near)
    .map(({ face }) => {
      const corners = face.at
        .map(screen)
        .map(
          ([x, y]) =>
            `${((x - minX) * scale + margin).toFixed(1)},${((y - minY) * scale + margin).toFixed(1)}`,
        )
        .join(' ');
      const fill = shade(face.fill, lit(face.normal));
      return `<polygon points="${corners}" fill="${fill}" stroke="${INK}" stroke-width="${(scale / 90).toFixed(1)}" stroke-linejoin="round"/>`;
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size}">${drawn.join('')}</svg>`;
}
