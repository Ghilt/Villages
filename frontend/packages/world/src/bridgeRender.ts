import { ARCHES, BRIDGE_PARTS, SPRINGING, bridgeTriangles, soffitAt } from './bridgeModel.ts';
import type { BridgePart, BridgeWay, ModelPoint } from './bridgeModel.ts';
import { fraction, noise, renderModel } from './modelRender.ts';
import type { Model, ModelPicture } from './modelRender.ts';

/*
 * The bridge drawn in the map's own camera along one of its eight ways (`modelRender.ts`): the arches, the piers seen
 * through them and the cutwaters hiding each other as they would; coursed stone on the walls, voussoirs round the
 * arches, setts on the road. The middle of the deck on the ground is the middle of the picture, whatever the way.
 */

export type BridgePicture = ModelPicture;

const COLOURS: Readonly<Record<BridgePart, readonly [number, number, number]>> = {
  wall: [181, 166, 140],
  parapet: [176, 162, 138],
  cap: [206, 196, 176],
  deck: [163, 143, 112],
  pier: [150, 138, 116],
  cutwater: [170, 156, 132],
};

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

const BRIDGE: Model<BridgePart> = {
  parts: BRIDGE_PARTS,
  triangles: bridgeTriangles(),
  colourAt: (part, point) => {
    const by = stoneAt(part, point);
    const [red, green, blue] = COLOURS[part];
    return [red * by, green * by, blue * by];
  },
};

/**
 * The bridge along `way`, `scale` pixels to the world unit, drawn `fine` times larger in each direction: a picture
 * whose middle is the middle of the deck on the ground.
 */
export function renderBridge(way: BridgeWay, scale: number, fine: number): BridgePicture {
  return renderModel(BRIDGE, way, scale, fine);
}
