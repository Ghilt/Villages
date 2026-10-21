import { Rectangle, Texture } from 'pixi.js';
import type { TextureSource } from 'pixi.js';

import type { StructureAtlasFile } from '@villages/world';

import { note } from '../../log/log';
import { readAtlas } from '../atlas';

/*
 * The pictures of a settlement's pieces and of the bridges, as `world:structures` cut them into
 * `public/art/settlements.webp`: each with where it stands across its picture and down it, how many world units it
 * stands, and the shadow a building casts. Read when the page starts and again whenever the dev server cuts them again,
 * with the structures' pictures (`structureAtlas.ts`). Until they are read a settlement is drawn as nothing but its
 * mark. See docs/plans/settlements-and-roads.md.
 */

/** One piece's picture: its texture, where it stands on it as fractions of its width and height, and how tall it is. */
export interface SettlementPicture {
  texture: Texture;
  foot: { x: number; y: number };
  /** How many world units it stands, as it is drawn on the map. */
  tall: number;
  /** The shadow it casts, and where its foot falls in it; null for a bridge or a jetty, which casts none. */
  shadow: { texture: Texture; foot: { x: number; y: number } } | null;
}

export interface SettlementPictures {
  /** The picture by its key in the atlas, `cottage@european`, `jetty:u`, `bridge:stone-uv`; null before it is read. */
  of(key: string): SettlementPicture | null;
  /** Whether any are read: what a settlement waits on to be drawn as its buildings. */
  readonly read: boolean;
  paint(file: StructureAtlasFile, source: TextureSource): void;
}

export function buildSettlementPictures(): SettlementPictures {
  const painted = new Map<string, SettlementPicture>();
  return {
    of: (key) => painted.get(key) ?? null,
    get read() {
      return painted.size > 0;
    },
    paint(file, source) {
      for (const one of painted.values()) {
        one.texture.destroy();
        one.shadow?.texture.destroy();
      }
      painted.clear();
      const cut = (frame: { x: number; y: number; width: number; height: number }) =>
        new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) });
      for (const [key, frame] of Object.entries(file.frames)) {
        const shadow = file.shadows?.[key];
        painted.set(key, {
          texture: cut(frame),
          foot: { x: frame.footX, y: frame.footY ?? 1 },
          tall: frame.tall ?? 1,
          shadow:
            shadow === undefined
              ? null
              : {
                  texture: cut(shadow),
                  foot: { x: shadow.footX / shadow.width, y: shadow.footY / shadow.height },
                },
        });
      }
    },
  };
}

/** Reads the settlements' atlas into [pictures], and says so; false when there is none cut yet. */
export async function loadSettlementArt(pictures: SettlementPictures): Promise<boolean> {
  try {
    const read = await readAtlas<StructureAtlasFile>('/art/settlements', "the settlements' pictures");
    if (read === null) {
      note(
        'settlements',
        'no pictures of settlements have been cut: npm run world:structures --prefix frontend',
      );
      return false;
    }
    pictures.paint(read.file, read.source);
    const frames = Object.values(read.file.frames);
    const painted = frames.filter((one) => !one.placeholder).length;
    note('settlements', `${frames.length} pictures of settlements and bridges, ${painted} painted`);
    return true;
  } catch (cause) {
    note('settlements', `the pictures of settlements could not be read: ${(cause as Error).message}`);
    return false;
  }
}
