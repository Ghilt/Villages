import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import sharp from 'sharp';

import { fromTerrarium } from '../../src/height.ts';
import type { Palette } from '../../src/palette.ts';
import { toRgb } from '../../src/palette.ts';

/*
 * The world at zoom 7 as a tool reads it a neighbourhood at a time: the class of ground under every world unit, as
 * the flat tiles have it, its height, and how big the river through it is. The same bytes the page reads, so that a
 * tool choosing where a settlement or a road stands sees the water the page will draw (the tiles make a river about
 * two units wide where the master paints it one, 0102). A world unit is a pixel of a zoom-7 tile.
 *
 * Tiles are read when `prepare` asks for the ones round a place and kept until enough others have been read since,
 * so a tool walking the world in order holds a few rows of it and never the whole: a gigabyte at zoom 7.
 */

const ZOOM = 7;
export const TILE = 256;
const ACROSS = 1 << ZOOM;

/**
 * What a tile holds: the class of every world unit, and where it has land its height and its river's size; none of
 * them where the tile is all sea and was never cut.
 */
interface Tile {
  readonly classes: Uint8Array | null;
  readonly rivers: Uint8Array | null;
  readonly heights: Int16Array | null;
  used: number;
}

const keyOf = (tileX: number, tileY: number) => tileY * ACROSS + tileX;

/** The ground at zoom 7, as the tiles of a master's world folder have it. */
export class WorldTiles {
  /** The tiles read most lately, `most` of them, the others dropped. */
  private readonly tiles = new Map<number, Tile>();
  private readonly most: number;
  private clock = 0;
  /** The tile the last sample fell on, answered at once: most samples fall on the one the sample before did. */
  private lastKey = -1;
  private last: Tile | null = null;
  private readonly byColour = new Map<number, number>();
  private readonly names: string[] = [];
  private readonly flowing: Set<string>;
  private readonly worldDir: string;

  /**
   * `worldDir` is the master's folder under `public/world/masters/`; `palette` and `render` are the world's, which
   * say what class each colour of a tile is. `most` is how many tiles are kept at once.
   */
  constructor(
    worldDir: string,
    palette: Palette,
    render: { colours: Record<string, string>; sea: string },
    most = 600,
  ) {
    this.worldDir = worldDir;
    this.most = most;
    for (const terrain of palette.classes) {
      this.names[terrain.id] = terrain.name;
      const [red, green, blue] = toRgb(render.colours[terrain.name] ?? render.sea);
      const colour = (red << 16) | (green << 8) | blue;
      if (!this.byColour.has(colour)) this.byColour.set(colour, terrain.id);
    }
    const flowFile = resolve(worldDir, 'flow', 'flow.json');
    this.flowing = new Set(
      existsSync(flowFile) ? (JSON.parse(readFileSync(flowFile, 'utf8')) as { tiles: string[] }).tiles : [],
    );
  }

  /** Reads every tile under a stretch of world space, `fromX` to `toX` and `fromY` to `toY`, not held already. */
  async prepare(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await this.prepareAll([{ fromX, fromY, toX, toY }]);
  }

  /**
   * Reads every tile under any of several stretches of world space that is not held already, sixteen at a time,
   * because decoding a tile waits on threads of its own and a tool reading them one after another waits on each.
   */
  async prepareAll(
    boxes: readonly { fromX: number; fromY: number; toX: number; toY: number }[],
  ): Promise<void> {
    const wanted = new Set<number>();
    for (const { fromX, fromY, toX, toY } of boxes) {
      for (
        let y = Math.max(0, Math.floor(fromY / TILE));
        y <= Math.min(ACROSS - 1, Math.floor(toY / TILE));
        y += 1
      ) {
        for (let column = Math.floor(fromX / TILE); column <= Math.floor(toX / TILE); column += 1) {
          const key = keyOf(((column % ACROSS) + ACROSS) % ACROSS, y);
          const held = this.tiles.get(key);
          if (held === undefined) wanted.add(key);
          else held.used = this.clock += 1;
        }
      }
    }
    const keys = [...wanted].sort((a, b) => a - b);
    for (let at = 0; at < keys.length; at += 16) {
      for (const [key, tile] of await Promise.all(keys.slice(at, at + 16).map((key) => this.read(key)))) {
        this.keep(key, tile);
      }
    }
  }

  private keep(key: number, tile: Tile): void {
    this.tiles.set(key, tile);
    if (this.tiles.size <= this.most) return;
    let oldest = key;
    let when = Infinity;
    for (const [one, held] of this.tiles) {
      if (held.used < when) [oldest, when] = [one, held.used];
    }
    this.tiles.delete(oldest);
    if (oldest === this.lastKey) this.lastKey = -1;
  }

  private async read(key: number): Promise<[number, Tile]> {
    const x = key % ACROSS;
    const y = Math.floor(key / ACROSS);
    const classes = await this.readClasses(x, y);
    const used = (this.clock += 1);
    if (classes === null || !classes.some((id) => id > 1)) {
      return [key, { classes, rivers: null, heights: null, used }];
    }
    const [rivers, heights] = await Promise.all([this.readRiver(x, y), this.readHeight(x, y)]);
    return [key, { classes, rivers, heights, used }];
  }

  /** Whether a tile has any ground that is not the sea: what spares a tool the open ocean. */
  hasLand(tileX: number, tileY: number): boolean {
    const classes = this.tiles.get(keyOf(tileX, tileY))?.classes;
    return classes !== null && classes !== undefined && classes.some((id) => id > 1);
  }

  /** The class's name at a point of world space; the sea off the world's top and bottom. */
  classAt = (x: number, y: number): string => {
    const id = this.sample('classes', x, y);
    return id === null ? 'ocean' : (this.names[id] ?? 'ocean');
  };

  /** The class's id at a point of world space, the ocean's off the world's top and bottom: no name looked up. */
  classIdAt = (x: number, y: number): number => this.sample('classes', x, y) ?? 0;

  /** The height in metres at a point of world space; nought on the sea. */
  heightAt = (x: number, y: number): number => this.sample('heights', x, y) ?? 0;

  /** How big the river at a point is, nought to one, by the flow's blue: nought where no river runs. */
  riverAt = (x: number, y: number): number => (this.sample('rivers', x, y) ?? 0) / 255;

  private sample(what: 'classes' | 'rivers' | 'heights', x: number, y: number): number | null {
    const column = ((Math.floor(x) % (ACROSS * TILE)) + ACROSS * TILE) % (ACROSS * TILE);
    const row = Math.floor(y);
    if (row < 0 || row >= ACROSS * TILE) return null;
    const tileX = Math.floor(column / TILE);
    const tileY = Math.floor(row / TILE);
    const key = keyOf(tileX, tileY);
    if (key !== this.lastKey) {
      const held = this.tiles.get(key);
      if (held === undefined) {
        throw new Error(`the tile ${tileX}/${tileY} was read before it was prepared`);
      }
      held.used = this.clock += 1;
      this.lastKey = key;
      this.last = held;
    }
    const data = this.last![what];
    return data === null ? null : data[(row - tileY * TILE) * TILE + (column - tileX * TILE)]!;
  }

  private async readClasses(tileX: number, tileY: number): Promise<Uint8Array | null> {
    const file = resolve(this.worldDir, 'tiles', String(ZOOM), String(tileX), `${tileY}.png`);
    if (!existsSync(file)) return null;
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const ids = new Uint8Array(TILE * TILE);
    for (let at = 0; at < ids.length; at += 1) {
      const pixel = at * info.channels;
      ids[at] = this.byColour.get((data[pixel]! << 16) | (data[pixel + 1]! << 8) | data[pixel + 2]!) ?? 0;
    }
    return ids;
  }

  private async readRiver(tileX: number, tileY: number): Promise<Uint8Array | null> {
    if (!this.flowing.has(`${tileX}/${tileY}`)) return null;
    const file = resolve(this.worldDir, 'flow', String(ZOOM), String(tileX), `${tileY}.png`);
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const sizes = new Uint8Array(TILE * TILE);
    for (let at = 0; at < sizes.length; at += 1) sizes[at] = data[at * info.channels + 2]!;
    return sizes;
  }

  private async readHeight(tileX: number, tileY: number): Promise<Int16Array | null> {
    const file = resolve(this.worldDir, 'height', String(ZOOM), String(tileX), `${tileY}.webp`);
    if (!existsSync(file)) return null;
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const metres = new Int16Array(TILE * TILE);
    for (let at = 0; at < metres.length; at += 1) {
      const pixel = at * info.channels;
      metres[at] = Math.max(
        -32_768,
        Math.min(32_767, fromTerrarium(data[pixel]!, data[pixel + 1]!, data[pixel + 2]!)),
      );
    }
    return metres;
  }
}
