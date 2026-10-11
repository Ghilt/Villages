/**
 * How the world is set up, as data and the questions asked of it: what Adam authors and what is fetched
 * (`artifacts.ts`), every tool that bakes the world beforehand (`tools.ts`), and which baked files the running
 * game reads (`readers.ts`). The architecture page draws this, and `world.test.ts` holds it to the repository:
 * a `world:` script with no tool fails, and so does a file read that nothing makes. What the game is made of once it
 * runs, and what passes between its pieces, is `running.ts`.
 */

import { ARTIFACTS } from './artifacts';
import { READERS } from './readers';
import { TOOLS } from './tools';
import type { Artifact, Reader, Tool } from './types';

export type { Artifact, Origin, Reader, Tool } from './types';

export { ARTIFACTS } from './artifacts';
export { READERS } from './readers';
export { GROUPS, PIECES, TALKS, group, piece } from './running';
export type { Group, GroupId, Piece, Runs, Talk } from './running';
export { LEGACY, TOOLS } from './tools';

export function artifact(id: string): Artifact {
  const found = ARTIFACTS.find((a) => a.id === id);
  if (found === undefined) throw new Error(`no artifact called ${id}`);
  return found;
}

/** The tools that make a file. */
export function makersOf(id: string): readonly Tool[] {
  return TOOLS.filter((tool) => tool.writes.includes(id));
}

/** The tools that read a file. */
export function toolsReading(id: string): readonly Tool[] {
  return TOOLS.filter((tool) => tool.reads.includes(id));
}

/** The parts of the running game that read a file. */
export function readersOf(id: string): readonly Reader[] {
  return READERS.filter((reader) => reader.reads.includes(id));
}

/** Every file the running game reads, in the order they are listed. */
export function readAtRuntime(): readonly Artifact[] {
  return ARTIFACTS.filter((a) => readersOf(a.id).length > 0);
}

/**
 * Everything a file depends on, all the way back to what was authored or fetched: the files, and the tools
 * between them. A file Adam paints over itself, the master mended into a new master, is not its own source.
 */
export function upstreamOf(id: string): { files: Set<string>; tools: Set<string> } {
  const files = new Set<string>();
  const tools = new Set<string>();
  const visit = (at: string): void => {
    for (const tool of makersOf(at)) {
      if (tool.group === 'adam' || tools.has(tool.script)) continue;
      tools.add(tool.script);
      for (const read of tool.reads) {
        if (!files.has(read)) {
          files.add(read);
          visit(read);
        }
      }
    }
  };
  visit(id);
  files.delete(id);
  return { files, tools };
}

/** Everything that depends on a file, all the way to the running game. */
export function downstreamOf(id: string): { files: Set<string>; tools: Set<string>; readers: Set<string> } {
  const files = new Set<string>();
  const tools = new Set<string>();
  const readers = new Set<string>();
  const visit = (at: string): void => {
    for (const reader of readersOf(at)) readers.add(reader.id);
    for (const tool of toolsReading(at)) {
      if (tool.group === 'adam' || tools.has(tool.script)) continue;
      tools.add(tool.script);
      for (const write of tool.writes) {
        if (!files.has(write)) {
          files.add(write);
          visit(write);
        }
      }
    }
  };
  visit(id);
  files.delete(id);
  return { files, tools, readers };
}

/** How long a master takes from its painting to a world the game can serve: the tools the quick-start runs. */
export function secondsForAMaster(): number {
  return TOOLS.filter(
    (tool) => tool.group === 'master' && tool.ranBy.includes('quick-start') && tool.script !== 'world:names',
  )
    .map((tool) => (tool.script === 'world:paint' ? 1 : tool.seconds))
    .reduce((sum, s) => sum + s, 0);
}
