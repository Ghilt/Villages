import type { StructureAtlasFile } from '@villages/world';

import { note } from '../log/log';
import { readAtlas } from './atlas';
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
    const read = await readAtlas<StructureAtlasFile>(ART, "the structures' pictures");
    if (read === null) {
      note(
        'structures',
        'no pictures of structures have been cut, so they are drawn in code: npm run world:structures --prefix frontend',
      );
      return false;
    }
    const { file } = read;
    pictures.paint(file, read.source);
    const frames = Object.entries(file.frames);
    const said = (which: typeof frames) => {
      const painted = which.filter(([, one]) => !one.placeholder).length;
      return `${painted} painted and ${which.length - painted} placeholders`;
    };
    const marks = frames.filter(([key]) => key.startsWith('mark:'));
    const drawings = frames.filter(([key]) => !key.startsWith('mark:'));
    note(
      'structures',
      `${drawings.length} pictures of structures, ${said(drawings)}; ${marks.length} marks, ${said(marks)}`,
    );
    return true;
  } catch (cause) {
    note('structures', `the pictures of structures could not be read: ${(cause as Error).message}`);
    return false;
  }
}
