import { Container, ParticleContainer } from 'pixi.js';
import type { Matrix, Particle, ParticleContainerOptions, Sprite, Texture } from 'pixi.js';

import { groundTilt, tiltGround } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { note } from '../../log/log';
import type { Layer } from '../layer';
import { drawOrder, overlaps } from './drawOrder';
import type { Building, Tree } from './drawOrder';
import { tilted } from './footprint';
import type { GroundFootprint, GroundPoint } from './footprint';
import { createVeil } from './veil';

/*
 * The trees and the structures standing among them, drawn farthest first as one stack: the scenery's particles cut
 * into slices, and each structure's picture between the slice behind it and the slice in front, its pennant over it.
 * One particle container draws its particles in one go, so a picture can only go between two of them. The slices are
 * cut again only when something changed - a tree came or went, the camera tipped, a structure moved or came on the
 * screen - and cost one draw each, one more than there are structures on the screen. See `drawOrder.ts` for the
 * rule and decision record 0110. The trees standing in the way of what the pointer is over fade out of it, `veil.ts`.
 */

/** Something standing among the trees, as the marks hand it over: what it is drawn as, and the ground it stands on. */
export interface StandingThing {
  id: string;
  /** Its pictures, each drawn over the one before where it stands: the thing, then the pennant flown over it. */
  sprites: readonly Sprite[];
  place: GroundPoint;
  /** How far across its picture it stands, as a fraction of its width: the front corner of its base. */
  anchor: number;
  footprint: GroundFootprint;
  /** How tall and wide its picture is drawn, in world units. */
  tall: number;
  wide: number;
  /** Drawn this frame at all: on the screen, and close enough in to be standing rather than a sign. */
  shown: boolean;
}

/** The trees, held as one particle container would hold them, so the scenery hands them over as it always did. */
export interface TreeParticles {
  readonly particleChildren: Particle[];
  texture: Texture | null;
  addParticle(...particles: Particle[]): void;
  removeParticle(particle: Particle): void;
  /** The trees were sorted or moved, so the slices are cut again before the next frame is drawn. */
  update(): void;
  setFromMatrix(matrix: Matrix): void;
  report(): {
    slices: number;
    standing: number;
    /** What the pointer is over, and how many trees are in its way. */
    hovered: string | null;
    inTheWay: number;
    first: { visible: boolean; scale: number; x: number; y: number };
  };
}

export interface StandingLayer extends Layer, TreeParticles {
  /** The slices and what stands between them, in the world under the fog. */
  readonly view: Container;
  /**
   * Everything standing among the trees that one source draws - the marks, the bridges - handed over every frame it
   * draws, kept beside what the others handed over.
   */
  stand(things: readonly StandingThing[], from?: string): void;
  /** What the pointer is over, by its id, or null: the trees standing in its way fade out of it. */
  hover(id: string | null): void;
}

/** The trees as a particle container sees them, and whether they are drawn: the scenery's switch. */
export function createStandingLayer(
  options: ParticleContainerOptions,
  treesShown: () => boolean,
): StandingLayer {
  const view = new Container();
  const slices: ParticleContainer[] = [];
  const all: Particle[] = [];
  let texture: Texture | null = null;
  let matrix: Matrix | null = null;
  let things: readonly StandingThing[] = [];
  const bySource = new Map<string, readonly StandingThing[]>();
  /** What the slices were last cut for, and whether a tree has come or gone or moved since. */
  let cutFor = '';
  let unsliced = true;
  /** The structures last said to stand among the trees, so the log speaks only when that changes. */
  let said = '';
  /** What was cut last: what stood, as the order saw it, the order it was drawn in, and the trees of each slice. */
  let cutOf: {
    shown: readonly StandingThing[];
    buildings: readonly Building[];
    order: readonly number[];
    parts: readonly (readonly Particle[])[];
  } = { shown: [], buildings: [], order: [], parts: [] };
  let cuts = 0;
  /** What the pointer is over, the trees in its way, and what they were worked out for. */
  let hovered: string | null = null;
  let inTheWay: ReadonlySet<Particle> = new Set();
  let wayFor = '';
  const veil = createVeil<Particle>();

  function slice(at: number): ParticleContainer {
    while (slices.length <= at) {
      const made = new ParticleContainer(options);
      if (texture !== null) made.texture = texture;
      if (matrix !== null) made.setFromMatrix(matrix);
      slices.push(made);
    }
    return slices[at]!;
  }
  slice(0);

  /** The box a tree's picture is drawn in, from its particle, in the layer's world units. */
  function treeOf(particle: Particle): Tree {
    const wide = particle.texture.width * particle.scaleX;
    const left = particle.x - particle.anchorX * wide;
    return {
      x: particle.x,
      y: particle.y,
      left,
      right: left + wide,
      top: particle.y - particle.anchorY * particle.texture.height * particle.scaleY,
    };
  }

  /** Cuts the trees into slices and puts each structure between the two it stands between. */
  function cut(camera: CameraView, shown: readonly StandingThing[]): void {
    const tilt = groundTilt(camera);
    const buildings = shown.map((thing) => ({
      corners: tilted(thing.footprint, tilt),
      foot: tiltGround(thing.place.x, thing.place.y, tilt),
      anchor: thing.anchor,
      tall: thing.tall,
      wide: thing.wide,
    }));
    const { order, slices: of } = drawOrder(buildings, shown.length === 0 ? [] : all.map(treeOf));
    cuts += 1;
    const parts: Particle[][] = slices.map(() => []);
    for (let at = 0; at <= order.length; at += 1) {
      slice(at);
      parts[at] ??= [];
    }
    all.forEach((particle, at) => parts[of[at] ?? 0]!.push(particle));
    cutOf = { shown, buildings, order, parts };
    slices.forEach((one, at) => {
      one.particleChildren = parts[at]!;
      one.update();
    });
    // In the order they are drawn: a child added again goes to the end.
    for (let at = 0; at <= order.length; at += 1) {
      view.addChild(slices[at]!);
      const standing = shown[order[at] ?? -1];
      if (standing !== undefined) view.addChild(...standing.sprites);
    }
    for (const thing of things) {
      if (!thing.shown) view.addChild(...thing.sprites);
    }
  }

  /** The trees drawn after what the pointer is over whose pictures overlap its own: the ones in its way. */
  function treesInTheWay(): ReadonlySet<Particle> {
    const at = cutOf.shown.findIndex((thing) => thing.id === hovered);
    const building = cutOf.buildings[at];
    if (building === undefined) {
      return new Set();
    }
    const way = new Set<Particle>();
    for (let after = cutOf.order.indexOf(at) + 1; after <= cutOf.order.length; after += 1) {
      for (const tree of cutOf.parts[after] ?? []) {
        if (overlaps(building, treeOf(tree))) way.add(tree);
      }
    }
    return way;
  }

  return {
    view,
    get particleChildren() {
      return all;
    },
    get texture() {
      return texture;
    },
    set texture(next: Texture | null) {
      texture = next;
      if (next !== null) for (const one of slices) one.texture = next;
    },
    addParticle(...particles: Particle[]): void {
      all.push(...particles);
      unsliced = true;
    },
    removeParticle(particle: Particle): void {
      const at = all.indexOf(particle);
      if (at >= 0) all.splice(at, 1);
      unsliced = true;
    },
    update(): void {
      unsliced = true;
    },
    setFromMatrix(next: Matrix): void {
      matrix = next;
      for (const one of slices) one.setFromMatrix(next);
    },

    stand(next: readonly StandingThing[], from = 'marks'): void {
      bySource.set(from, next);
      things = bySource.size === 1 ? next : [...bySource.values()].flat();
    },
    hover(id: string | null): void {
      hovered = id;
    },

    draw(camera: CameraView, _now: number, elapsed: number): number | null {
      const drawTrees = treesShown();
      for (const one of slices) one.visible = drawTrees;
      const shown = things.filter((thing) => thing.shown);
      const tilt = groundTilt(camera);
      const key = `${tilt.cos},${tilt.sin},${tilt.lean}|${shown
        .map(
          ({ id, sprites, place, tall, anchor, footprint }) =>
            `${id}:${sprites.length}:${tall}:${anchor}:${place.x},${place.y}:${footprint[2].x},${footprint[2].y}`,
        )
        .join('|')}`;
      if (unsliced || key !== cutFor) {
        cut(camera, shown);
        cutFor = key;
        unsliced = false;
        const standing = shown.map(({ id }) => id).join(' ');
        if (standing !== said) {
          said = standing;
          const many = shown.length === 1 ? 'one mark stands' : `${shown.length} marks stand`;
          note(
            'scenery',
            shown.length === 0
              ? 'nothing stands among the trees'
              : `${many} among the trees, between ${shown.length + 1} slices of them`,
          );
        }
      }
      // The trees in the way of what the pointer is over, worked out again when it moves or the trees are cut again.
      if (`${hovered} ${cuts}` !== wayFor) {
        wayFor = `${hovered} ${cuts}`;
        inTheWay = treesInTheWay();
      }
      return veil.step(inTheWay, elapsed) ? 0 : null;
    },

    report() {
      const first = slices[0]!;
      return {
        slices: slices.length,
        standing: things.filter((thing) => thing.shown).length,
        hovered,
        inTheWay: inTheWay.size,
        first: { visible: first.visible, scale: first.scale.x, x: first.x, y: first.y },
      };
    },

    destroy(): void {
      for (const one of slices) one.destroy();
      slices.length = 0;
    },
  };
}
