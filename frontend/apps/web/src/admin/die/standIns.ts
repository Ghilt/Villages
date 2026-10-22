import type { Graphics } from 'pixi.js';

import {
  groundTilt,
  pixelsPerWorldUnit,
  tiltGround,
  toMercatorExact,
  worldSize,
} from '../../geometry/cameraMath';
import type { CameraView, MercatorPoint, ScreenPoint } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import type { Obstacle } from '../../sprites/die/physics';

/**
 * What the spike's die can strike: a little wood and a row of houses, stood round the middle of the view at the size
 * the map's own trees and buildings are, in world units, one to a pixel of the master. Stand-ins, drawn plainly: the
 * map's own scenery reaches the page through the game server, which the spike does without, so whether the die should
 * strike the real thing is felt here first. See `docs/plans/choice-roll-podium.md`, *Striking what is drawn on the map*.
 */

interface Post {
  readonly east: number;
  readonly south: number;
  readonly radius: number;
  readonly height: number;
}

interface Block {
  readonly west: number;
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly height: number;
}

export interface StandIns {
  readonly centre: MercatorPoint;
  readonly posts: readonly Post[];
  readonly blocks: readonly Block[];
}

/** A tree is about as wide as a world unit and a half and five tall; a house six on a side and six tall. */
const TREE = { radius: 0.8, height: 5 };
const HOUSE = { side: 6, height: 6 };

/** The wood to the south-west of the middle and the houses to the north-east, the same every time. */
export function standInsAround(centre: MercatorPoint): StandIns {
  const posts: Post[] = [];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const shift = row % 2 === 0 ? 0 : 2;
      posts.push({ east: -28 + column * 4.5 + shift, south: 8 + row * 4, ...TREE });
    }
  }
  const blocks = [0, 1, 2].map((i) => ({
    west: 10 + i * 9,
    east: 10 + i * 9 + HOUSE.side,
    north: -22 + i * 3,
    south: -22 + i * 3 + HOUSE.side,
    height: HOUSE.height,
  }));
  return { centre, posts, blocks };
}

/** A world unit as a share of the Mercator square. */
const UNIT = 1 / WORLD_MASTER_WIDTH;

/** The stand-ins as the die's physics sees them: in die widths from where it was let go, a die `dieWide` world units wide. */
export function standInsInDieWidths(stand: StandIns, anchor: MercatorPoint, dieWide: number): Obstacle[] {
  const fromAnchor = (east: number, south: number) => ({
    x: ((stand.centre.x - anchor.x) / UNIT + east) / dieWide,
    y: ((stand.centre.y - anchor.y) / UNIT + south) / dieWide,
  });
  return [
    ...stand.posts.map((post): Obstacle => {
      const { x, y } = fromAnchor(post.east, post.south);
      return { kind: 'post', x, y, radius: post.radius / dieWide, height: post.height / dieWide };
    }),
    ...stand.blocks.map((block): Obstacle => {
      const corner = fromAnchor(block.west, block.north);
      return {
        kind: 'box',
        west: corner.x,
        east: corner.x + (block.east - block.west) / dieWide,
        north: corner.y,
        south: corner.y + (block.south - block.north) / dieWide,
        height: block.height / dieWide,
      };
    }),
  ];
}

/** Draws them, their feet on the map's ground and their height lifted at the angle the die is seen at. */
export function drawStandIns(into: Graphics, stand: StandIns, view: CameraView, angle: number): void {
  const size = worldSize(view.zoom);
  const centre = toMercatorExact(view.center);
  const tilt = groundTilt(view);
  const perUnit = pixelsPerWorldUnit(view.zoom);
  const at = (east: number, south: number): ScreenPoint => {
    const landed = tiltGround(
      (stand.centre.x + east * UNIT - centre.x) * size,
      (stand.centre.y + south * UNIT - centre.y) * size,
      tilt,
    );
    return { x: landed.x + view.width / 2, y: landed.y + view.height / 2 };
  };
  const lift = Math.sin(angle) * perUnit;
  for (const block of stand.blocks) {
    const ground = [
      at(block.west, block.north),
      at(block.east, block.north),
      at(block.east, block.south),
      at(block.west, block.south),
    ];
    const up = block.height * lift;
    const roof = ground.map((p) => ({ x: p.x, y: p.y - up }));
    const [, , se, sw] = ground;
    into
      .poly([sw!.x, sw!.y, se!.x, se!.y, se!.x, se!.y - up, sw!.x, sw!.y - up])
      .fill(0xb9a07a)
      .stroke({ width: 1, color: 0x5b3d24 });
    into
      .poly(roof.flatMap((p) => [p.x, p.y]))
      .fill(0x8c4b32)
      .stroke({ width: 1, color: 0x5b3d24 });
  }
  for (const post of [...stand.posts].sort((a, b) => a.south - b.south)) {
    const foot = at(post.east, post.south);
    const top = { x: foot.x, y: foot.y - post.height * lift };
    into
      .moveTo(foot.x, foot.y)
      .lineTo(top.x, top.y)
      .stroke({ width: Math.max(1, post.radius * perUnit * 0.5), color: 0x5b3d24 });
    into
      .circle(top.x, top.y, Math.max(2, post.radius * perUnit * 1.8))
      .fill(0x4f7a3a)
      .stroke({ width: 1, color: 0x2f4a22 });
  }
}
