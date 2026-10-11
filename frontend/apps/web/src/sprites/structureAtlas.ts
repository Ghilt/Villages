import { ImageSource } from 'pixi.js';
import type { StructureAtlasFile } from '@villages/world';

import { note } from '../log/log';
import type { StructurePictures } from './structurePictures';

/** Where `world:structures` puts the atlas of structures' pictures, beside the scenery's. */
const ART = '/art/structures';

/** What the dev server says when it has cut the structures' pictures again, so the map draws them without a reload. */
export const STRUCTURES_CUT = 'villages:structures-cut';

/**
 * Reads the atlas `world:structures` cut, and hands it to the structures' pictures, which draw from it where it has a
 * picture and in code where it has none. False when there is none yet, which leaves every structure drawn in code.
 * Premultiplied as the scenery's is, for the same reason. See docs/plans/structures.md.
 */
/**
 * Reads the atlas now, and again whenever the dev server says it cut it again, calling [painted] each time it has,
 * until the function it returns is called.
 */
export function watchStructureArt(pictures: StructurePictures, painted: () => void): () => void {
  let stopped = false;
  const read = () => void loadStructureArt(pictures).then((done) => done && !stopped && painted());
  read();
  import.meta.hot?.on(STRUCTURES_CUT, read);
  return () => {
    stopped = true;
    import.meta.hot?.off(STRUCTURES_CUT, read);
  };
}

export async function loadStructureArt(pictures: StructurePictures): Promise<boolean> {
  try {
    const listed = await fetch(`${ART}.json`, { cache: 'no-store' });
    if (!listed.ok) {
      note(
        'structures',
        'no pictures of structures have been cut, so they are drawn in code: npm run world:structures --prefix frontend',
      );
      return false;
    }
    const file = (await listed.json()) as StructureAtlasFile;
    const picture = await fetch(`${ART}.webp?v=${file.version}`);
    const bitmap = await createImageBitmap(await picture.blob(), { premultiplyAlpha: 'premultiply' });
    const source = new ImageSource({
      resource: bitmap,
      alphaMode: 'premultiplied-alpha',
      autoGenerateMipmaps: true,
      scaleMode: 'linear',
    });
    pictures.paint(file, source);
    const frames = Object.values(file.frames);
    const painted = frames.filter((one) => !one.placeholder).length;
    note(
      'structures',
      `${frames.length} pictures of structures, ${painted} painted and ${frames.length - painted} placeholders`,
    );
    return true;
  } catch (cause) {
    note('structures', `the pictures of structures could not be read: ${(cause as Error).message}`);
    return false;
  }
}
