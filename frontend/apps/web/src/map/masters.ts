import { DEFAULT_MASTER, worldDirOf } from '@villages/world';

import { note } from '../debug/log';
import { WORLD_MASTER_WIDTH } from './worldStyle';

/**
 * Which hand-painted master the app is drawing, and how to get at the others.
 *
 * The world the browser draws is not the master. It is map tiles cut from it, plus the outlines traced
 * out of it, and cutting a 32768 pixel image takes five minutes of Node. So a master is picked here and
 * cut by the dev server, which is the only thing in reach that can run the world commands. See
 * `apps/web/vite/worldApi.ts` and docs/adr/0025.
 */

/** Where a master's world is served from, as the root of a URL. */
export function worldRootOf(name: string): string {
  return `/world/${worldDirOf(name)}`;
}

const REMEMBERED = 'villages.master';

/**
 * The master to draw, read once at startup.
 *
 * Remembered in the browser rather than held in React state, because switching reloads the page.
 * Everything that reads the world - the map style, the outlines, and every painter - takes the root as a
 * value at startup, and a reload is the one way to be certain none of them is still holding the old one
 * or a tile decoded from it.
 */
export function chosenMaster(): string {
  try {
    return window.localStorage.getItem(REMEMBERED) ?? DEFAULT_MASTER;
  } catch {
    return DEFAULT_MASTER;
  }
}

/** Draws this master from now on, by remembering it and starting the page again. */
export function chooseMaster(name: string): void {
  try {
    if (name === DEFAULT_MASTER) {
      window.localStorage.removeItem(REMEMBERED);
    } else {
      window.localStorage.setItem(REMEMBERED, name);
    }
  } catch {
    note('world', `could not remember ${name}, so it will not survive a reload`);
  }
  window.location.reload();
}

/** One master image in `world/master`, as the dev server sees it. */
export interface MasterOnDisk {
  name: string;
  file: string;
  width: number;
  height: number;
  bytes: number;
  editedAt: number;
  cutAt: number | null;
}

/** Painted since it was last cut, so what the map is drawing is not what the image says. */
export function isStale(master: MasterOnDisk): boolean {
  return master.cutAt !== null && master.editedAt > master.cutAt;
}

/**
 * Every master in the folder. Empty if nothing answers, which is what a built app looks like: there is
 * no dev server there to read a directory, and the world was cut before it was built.
 */
export async function listMasters(): Promise<MasterOnDisk[]> {
  try {
    const response = await fetch('/world-api/masters');
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as { masters?: MasterOnDisk[] };
    return body.masters ?? [];
  } catch {
    return [];
  }
}

/**
 * Cuts one master, putting every line the world commands print into the debug log as it arrives.
 *
 * The response is read as a stream rather than waited for, because it takes minutes, and a spinner that
 * says nothing for minutes cannot be told from a hang.
 */
export async function cutMaster(name: string): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`/world-api/masters/${encodeURIComponent(name)}/cut`, { method: 'POST' });
  } catch (cause) {
    note('world', `could not ask for ${name} to be cut: ${(cause as Error).message}`);
    return false;
  }

  if (!response.ok || response.body === null) {
    note('world', `cutting ${name} was refused: ${(await response.text()).trim() || response.status}`);
    return false;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rest = '';
  let finished = false;

  const say = (line: string): void => {
    if (line.trim() === '') {
      return;
    }
    note('world', line);
    if (line.startsWith('done:')) {
      finished = true;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    rest += decoder.decode(value, { stream: true });
    const lines = rest.split('\n');
    rest = lines.pop() ?? '';
    for (const line of lines) {
      say(line);
    }
  }
  say(rest);

  return finished;
}

/**
 * What the panel says under the terrain dropdown: enough to know whether what is on the screen is what
 * the image on disk says.
 *
 * Picking a master that is already cut reloads the page straight away, so the only states that get as
 * far as being described are the one being drawn and the ones that need cutting first.
 */
export function describeMaster(chosen: MasterOnDisk | undefined, master: string, cutting: boolean): string {
  if (cutting) {
    return 'tracing the coast, then cutting the tiles. Five minutes or so.';
  }
  if (chosen === undefined) {
    return `drawing ${master}; no dev server to ask what else there is`;
  }

  const size = `${chosen.width} by ${chosen.height}`;
  // The depth the tiles are cut to and the size a brush mark is drawn at are both worked out from the
  // width the world is supposed to be, so a master of another size draws, but not faithfully.
  const odd =
    chosen.width === WORLD_MASTER_WIDTH ? '' : `, and not the ${WORLD_MASTER_WIDTH} this world expects`;

  if (chosen.cutAt === null) {
    return `${size}${odd}, never cut into a world`;
  }
  if (isStale(chosen)) {
    return `${size}${odd}, painted ${since(chosen.editedAt)} ago, after it was last cut`;
  }
  return `${size}${odd}, cut ${since(chosen.cutAt)} ago, and on the screen`;
}

/** How long ago, in the roughest terms that are still useful. */
export function since(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 90) {
    return count(seconds, 'second');
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) {
    return count(minutes, 'minute');
  }
  const hours = Math.round(minutes / 60);
  return hours < 36 ? count(hours, 'hour') : count(Math.round(hours / 24), 'day');
}

function count(many: number, thing: string): string {
  return `${many} ${thing}${many === 1 ? '' : 's'}`;
}
