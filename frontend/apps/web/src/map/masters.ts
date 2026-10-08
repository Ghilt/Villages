import { DEFAULT_MASTER, worldDirOf } from '@villages/world';

import { note } from '../log/log';
import { WORLD_MASTER_WIDTH } from '../geometry/world';

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
  furnishedAt: number | null;
  /** When its origin map was last worked out, and its names last carried through it, or nothing if never. */
  originAt: number | null;
  namedAt: number | null;
}

/** Painted since it was last cut, so what the map is drawing is not what the image says. */
export function isStale(master: MasterOnDisk): boolean {
  return master.cutAt !== null && master.editedAt > master.cutAt;
}

/**
 * Whether a master's sprite map is out of date, and so whether its scenery is standing on stale ground.
 *
 * Two ways for it to be: the image was painted since, or **`world/biomes.json` was saved since**. The
 * second is the one that matters in practice and the one this existed without for a moment: tuning a
 * look edits that file and nothing else, so a sprite map goes out of date without any master changing,
 * and a panel that only watched the image would have gone on saying every world was current.
 *
 * Separate from `isStale` because the two go stale together and are mended apart: furnishing is half a
 * minute where cutting is five.
 */
export function isUnfurnished(master: MasterOnDisk, tunedAt: number | null): boolean {
  if (master.furnishedAt === null) {
    return true;
  }
  return master.editedAt > master.furnishedAt || (tunedAt !== null && tunedAt > master.furnishedAt);
}

/**
 * What a cut master's origin map needs, if anything: worked out again, because it was never worked out or the
 * master was painted since, which leaves real names on the wrong ground; or only its names carried again,
 * because the review of 1790 was saved since they were. Nothing for a master that is not cut, which has no
 * ground for names to stand on yet. See `docs/plans/real-world-names.md`.
 */
export function originNeeds(master: MasterOnDisk, reviewedAt: number | null): 'origin' | 'names' | null {
  if (master.cutAt === null) {
    return null;
  }
  if (master.originAt === null || master.editedAt > master.originAt) {
    return 'origin';
  }
  if (master.namedAt === null || master.namedAt < master.originAt) {
    return 'names';
  }
  return reviewedAt !== null && reviewedAt > master.namedAt ? 'names' : null;
}

/** What the panel says about a cut master's origin map and names when they are out of date, or nothing. */
export function describeOrigin(master: MasterOnDisk | undefined, reviewedAt: number | null): string {
  const needs = master === undefined ? null : originNeeds(master, reviewedAt);
  if (master === undefined || needs === null) {
    return '';
  }
  if (master.originAt === null) {
    return 'no origin map yet, so no real names in this world';
  }
  return needs === 'origin'
    ? `painted ${since(master.editedAt)} ago, after its origin map was worked out: names may stand on the wrong ground`
    : 'world/names saved after its names were carried';
}

/** The listing's own times, beside the masters: when world/biomes.json and the review of 1790 were saved. */
export interface MastersListing {
  masters: MasterOnDisk[];
  tunedAt: number | null;
  reviewedAt: number | null;
}

/**
 * Every master in the folder. Empty if nothing answers, which is what a built app looks like: there is
 * no dev server there to read a directory, and the world was cut before it was built.
 */
export async function listMasters(): Promise<MastersListing> {
  const none = { masters: [], tunedAt: null, reviewedAt: null };
  try {
    const response = await fetch('/world-api/masters');
    if (!response.ok) {
      return none;
    }
    const body = (await response.json()) as Partial<MastersListing>;
    return {
      masters: body.masters ?? [],
      tunedAt: body.tunedAt ?? null,
      reviewedAt: body.reviewedAt ?? null,
    };
  } catch {
    return none;
  }
}

/**
 * Cuts one master, putting every line the world commands print into the debug log as it arrives.
 *
 * The response is read as a stream rather than waited for, because it takes minutes, and a spinner that
 * says nothing for minutes cannot be told from a hang.
 */
export async function cutMaster(name: string): Promise<boolean> {
  return errand(name, 'cut');
}

/**
 * Works out one master's biomes and stands, without recutting its tiles.
 *
 * The errand for a `world/biomes.json` edit, which is the one somebody tuning a look does over and over:
 * half a minute rather than five minutes, because the tiles have not changed.
 */
export async function furnishMaster(name: string): Promise<boolean> {
  return errand(name, 'furnish');
}

/**
 * Works out where one master's land came from and carries its names through it again, two minutes; or, when
 * only the review of 1790 has changed, carries the names alone, a second. What `originNeeds` says it needs.
 */
export async function mendOrigin(name: string, needs: 'origin' | 'names'): Promise<boolean> {
  return errand(name, needs);
}

/** What the dev server can be asked to do to a master. */
export type Errand = 'cut' | 'furnish' | 'origin' | 'names';

async function errand(name: string, which: Errand): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(`/world-api/masters/${encodeURIComponent(name)}/${which}`, { method: 'POST' });
  } catch (cause) {
    note('world', `could not ask for ${name} to be ${which}: ${(cause as Error).message}`);
    return false;
  }

  if (!response.ok || response.body === null) {
    note('world', `${which} on ${name} was refused: ${(await response.text()).trim() || response.status}`);
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
export function describeMaster(
  chosen: MasterOnDisk | undefined,
  master: string,
  working: false | Errand,
  tunedAt: number | null = null,
): string {
  if (working === 'cut') {
    return 'tracing the coast, cutting the tiles, working out the biomes and where the land came from. Eight minutes or so.';
  }
  if (working === 'furnish') {
    return 'working out the biomes and the stands. Half a minute.';
  }
  if (working === 'origin') {
    return 'working out where the land came from and carrying the names through it. Two minutes.';
  }
  if (working === 'names') {
    return 'carrying the names through the origin map. A second.';
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
  if (chosen.furnishedAt === null) {
    return `${size}${odd}, cut ${since(chosen.cutAt)} ago, and growing nothing: it has no sprite map`;
  }
  if (isUnfurnished(chosen, tunedAt)) {
    const why =
      tunedAt !== null && tunedAt > chosen.furnishedAt
        ? `world/biomes.json saved ${since(tunedAt)} ago`
        : `painted ${since(chosen.editedAt)} ago`;
    return `${size}${odd}, ${why}, after its biomes were worked out`;
  }
  return `${size}${odd}, cut ${since(chosen.cutAt)} ago, furnished ${since(chosen.furnishedAt)} ago`;
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
