/**
 * A line or two about Earth's rivers, lakes and seas, for the inspect window on one: `world/names/about.json`,
 * written as an English reader of 1790 might be told it. Each line is filed under the name the world gives the thing
 * and the ids of every piece it was carried as, so that the four pieces of the Rhine say one thing and the two
 * Dwinas, Riga's and Archangel's, each say their own. The game server reads the lines beside the names and sends a
 * window its own; the page never reads its copy for a player. See decision record 0087.
 */

/** One line, and every carried thing it is about. */
export interface About {
  /** The name the world gives it, to read the file by: the review's of 1790 where it gives one. */
  readonly name: string;
  readonly ids: readonly string[];
  readonly about: string;
}

/** The file: the rivers, the lakes and the seas, a part it lacks being a part with nothing to say. */
export interface AboutFile {
  readonly rivers?: readonly About[];
  readonly lakes?: readonly About[];
  readonly seas?: readonly About[];
}

/** What telling came to: how many things were given a line, and the ids the file names that this world lacks. */
export interface Told<Name, Region> {
  readonly names: Name[];
  readonly regions: Region[];
  readonly given: number;
  readonly absent: readonly string[];
}

/**
 * Gives every name and region the file has a line for its line. An id the file names that this world does not
 * carry - a piece painted out of the master, or a mistake - is said rather than refused, because another master
 * may carry it.
 */
export function tellAbout<Name extends { readonly id: string }, Region extends { readonly id: string }>(
  file: AboutFile,
  names: readonly Name[],
  regions: readonly Region[],
): Told<Name, Region> {
  const lines = new Map<string, string>();
  for (const one of [...(file.rivers ?? []), ...(file.lakes ?? []), ...(file.seas ?? [])]) {
    for (const id of one.ids) lines.set(id, one.about);
  }
  let given = 0;
  const tell = <Thing extends { readonly id: string }>(thing: Thing): Thing => {
    const about = lines.get(thing.id);
    if (about === undefined) return thing;
    given += 1;
    return { ...thing, about };
  };
  const told = { names: names.map(tell), regions: regions.map(tell) };
  const carried = new Set([...names, ...regions].map((thing) => thing.id));
  return { ...told, given, absent: [...lines.keys()].filter((id) => !carried.has(id)) };
}
