/**
 * Which images in `world/master` are worlds you can load, and where each one's world is written.
 *
 * That folder holds more than masters: a strip of the palette to eyedrop from, and a small preview of
 * every master that has been imported. Both are PNGs of the same folder, so what counts as a master is
 * decided here rather than guessed in each of the three places that asks - the importer, the tiler, and
 * the dev server that lists them for the browser.
 */

/** The one the game draws unless told otherwise: `world/master/terrain.png`. */
export const DEFAULT_MASTER = 'terrain';

/** A generated glance at a master, not a master. */
const PREVIEW = '-preview';

/** The thirty-two classes with their names written on them. A picture of the palette, not a world. */
const NOT_A_WORLD = ['palette-strip'];

/** The master a file name names, or nothing if that file is not one. */
export function masterNameOf(file: string): string | null {
  if (!file.toLowerCase().endsWith('.png')) {
    return null;
  }
  const name = file.slice(0, -'.png'.length);
  if (name === '' || name.endsWith(PREVIEW) || NOT_A_WORLD.includes(name)) {
    return null;
  }
  return name;
}

/**
 * A master's name becomes a directory on disk and a segment of a URL, and the name itself arrives from
 * a browser asking the dev server to cut one. So it is held to ordinary characters, and the caller is
 * still expected to check the name against the folder rather than trust this alone.
 */
export function isSafeMasterName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name) && !name.includes('..');
}

/**
 * Where a master's world goes, under the directory the app serves.
 *
 * One directory each, the default included, so that loading `terrain` and loading `terrain2` are the
 * same operation rather than one general case and one special one.
 */
export function worldDirOf(name: string): string {
  return `masters/${name}`;
}

/**
 * Where a master's stands go, under the directory only the game server and the scenery stills read, one
 * directory a layer of its sprite map. Never under the one the app serves: the gateway hands a page the stands
 * its fog lets through, and a page that could fetch them for itself would see every wood in the world. See
 * decision record 0067.
 */
export function standsDirOf(name: string, layer = 'biome'): string {
  return `${name}/${layer}`;
}
