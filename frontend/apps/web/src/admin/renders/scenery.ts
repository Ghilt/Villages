import { CELL, NO_FAVOURITE, NO_STANDS, scatterCell } from '@villages/world';
import type { ArtAtlasFile, ScatteredPoint, SpriteMap, StandChunk } from '@villages/world';
import { Container, ImageSource, Matrix, Particle, ParticleContainer, Rectangle, Texture } from 'pixi.js';

import * as camera from '../../geometry/cameraMath';
import type { Cover } from '../../sprites/critters/types';
import { sceneryStore } from '../../sprites/scenery/settings';
import { spriteMap } from '../../sprites/scenery/spriteMap';
import type { SceneryShaders } from '../../sprites/trees/TreesLayer';

import { SQUARE, biomeFor, classAtOf, squaresOf } from './squares';
import type { RenderSquare, RendersLayout } from './squares';

/**
 * The trees, bushes and stones of the renders page's squares, grown by the scatter the map grows its own with: for
 * each square the sprite map of the world being drawn, with one biome that grows that kind of land everywhere, so a
 * square of tundra has the tundra's heather and boulders as the map would. Drawn from the scenery's own atlas, with
 * the trees' shaders, so they bend in the wind as the map's do, their shadows under them; and handed to the critters
 * as the cover they come out of.
 */

const ART = '/art/scenery';

/**
 * How thickly things grow inside a square's one stand, in points to the square world unit: about the middle of what
 * the biomes' stands grow, 0.16 to 0.25 in `world/biomes.json`. The map's woods are its stands, and outside them
 * almost nothing grows; so each square is given one, covering it, and grows as the inside of a wood does.
 */
const STAND_THICKNESS = 0.2;

/** Each square's one stand, in the chunk of the zoom 7 tile its middle is on, as the scatter reads stands. */
function standsOf(layout: RendersLayout, tileUnits: number): (tileX: number, tileY: number) => StandChunk {
  const middles = squaresOf(layout).map((square) => ({ x: square.x + SQUARE / 2, y: square.y + SQUARE / 2 }));
  return (tileX, tileY) => {
    const own = middles.filter(
      (one) => Math.floor(one.x / tileUnits) === tileX && Math.floor(one.y / tileUnits) === tileY,
    );
    if (own.length === 0) return NO_STANDS;
    return {
      count: own.length,
      x: Float32Array.from(own, (one) => one.x),
      y: Float32Array.from(own, (one) => one.y),
      reach: new Float32Array(own.length).fill(SQUARE * 0.75),
      dominant: new Uint8Array(own.length).fill(NO_FAVOURITE),
      thickness: new Float32Array(own.length).fill(STAND_THICKNESS),
      seed: Uint8Array.from(own, (_one, at) => (at * 37) & 0xff),
    };
  };
}

export interface RendersScenery {
  /** The shadows and the standing pictures, to go between the critters on the ground and those in the air. */
  container: Container;
  /** Every one of them, as the critters' clock reads cover. */
  cover: readonly Cover[];
  /** Placed for the camera, every frame. */
  place(view: camera.CameraView): void;
  destroy(): void;
}

/** A square's points: the scatter of the cells it reaches, with its biome everywhere, those inside it kept. */
function grownIn(
  square: RenderSquare,
  base: SpriteMap,
  classAt: (x: number, y: number) => number,
  stands: (tileX: number, tileY: number) => StandChunk,
): ScatteredPoint[] {
  const biome = biomeFor(square.land, base.file.biomes, base.file.grows);
  if (biome < 0) return [];
  const { dial, spacing } = sceneryStore.get();
  const map: SpriteMap = {
    ...base,
    file: { ...base.file, world: { ...base.file.world, biomeSide: 1 } },
    biomeOf: Uint8Array.of(biome),
    cellUnits: base.file.world.side,
  };
  const ground = { classAt, standsOf: stands };
  const points: ScatteredPoint[] = [];
  for (let cellY = Math.floor(square.y / CELL); cellY <= Math.floor((square.y + SQUARE) / CELL); cellY += 1) {
    for (
      let cellX = Math.floor(square.x / CELL);
      cellX <= Math.floor((square.x + SQUARE) / CELL);
      cellX += 1
    ) {
      for (const point of scatterCell(cellX, cellY, dial, ground, map, spacing)) {
        const inside =
          point.x >= square.x &&
          point.x < square.x + SQUARE &&
          point.y >= square.y &&
          point.y < square.y + SQUARE;
        if (inside) points.push(point);
      }
    }
  }
  return points;
}

export async function rendersScenery(
  tilesRoot: string,
  layout: RendersLayout,
  sway: SceneryShaders,
): Promise<RendersScenery> {
  const container = new Container();
  const dynamicProperties = { position: false, vertex: false, rotation: false, uvs: false, color: true };
  const standing = new ParticleContainer({ dynamicProperties, shader: sway.standing });
  const shadows = new ParticleContainer({ dynamicProperties, shader: sway.shadows });
  shadows.blendMode = 'max';
  container.addChild(shadows, standing);
  let atlas: ImageSource | null = null;
  const nothing = { container, cover: [], place: () => undefined, destroy: () => container.destroy() };

  const base = await spriteMap(tilesRoot);
  const listed = await fetch(`${ART}.json`);
  if (base === null || !listed.ok) return nothing;
  const file = (await listed.json()) as ArtAtlasFile;
  const picture = await fetch(`${ART}.webp?v=${file.version}`);
  const bitmap = await createImageBitmap(await picture.blob(), { premultiplyAlpha: 'premultiply' });
  atlas = new ImageSource({
    resource: bitmap,
    alphaMode: 'premultiplied-alpha',
    autoGenerateMipmaps: true,
    scaleMode: 'linear',
  });
  const source = atlas;
  const textureOf = (frame: { x: number; y: number; width: number; height: number }) =>
    new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) });

  const classAt = classAtOf(layout);
  const stands = standsOf(layout, base.file.world.tileUnits);
  const points = squaresOf(layout)
    .flatMap((square) => grownIn(square, base, classAt, stands))
    .sort((one, other) => one.y - other.y || one.x - other.x);
  const flat = camera.groundTilt({});
  const cover: Cover[] = [];
  const shadowStrength = sceneryStore.get().shadows;
  for (const point of points) {
    const name = base.kinds[point.kind]?.name ?? '';
    const frame = file.frames[name];
    if (frame === undefined) continue;
    cover.push({ x: point.x, y: point.y, kind: name, height: point.height });
    const at = camera.tiltGround(point.x, point.y, flat);
    const tint = sway.tintOf(name);
    const sprite = new Particle({ texture: textureOf(frame), tint });
    sprite.x = at.x;
    sprite.y = at.y;
    sprite.anchorX = frame.footX / frame.width;
    sprite.anchorY = frame.footY / frame.height;
    sprite.scaleY = point.height / frame.height;
    sprite.scaleX = sprite.scaleY;
    standing.addParticle(sprite);
    const shade = file.shadows?.[name];
    if (shade !== undefined && shadowStrength > 0) {
      const shadow = new Particle({ texture: textureOf(shade), tint });
      shadow.x = at.x;
      shadow.y = at.y;
      shadow.anchorX = shade.footX / shade.width;
      shadow.anchorY = shade.footY / shade.height;
      shadow.scaleY = point.height / frame.height;
      shadow.scaleX = shadow.scaleY;
      shadow.alpha = shadowStrength;
      shadows.addParticle(shadow);
    }
  }
  const first = standing.particleChildren[0];
  if (first !== undefined) standing.texture = first.texture;
  const firstShadow = shadows.particleChildren[0];
  if (firstShadow !== undefined) shadows.texture = firstShadow.texture;

  return {
    container,
    cover,
    place(view) {
      // Every foot in world units, so the one matrix of the camera puts them all, as the map's scenery is put.
      const layer = camera.standingLayer(view);
      const placed = new Matrix(layer.scale, 0, 0, layer.scale, layer.x, layer.y);
      standing.setFromMatrix(placed);
      shadows.setFromMatrix(placed);
    },
    destroy() {
      container.destroy({ children: true });
      atlas?.destroy();
    },
  };
}
