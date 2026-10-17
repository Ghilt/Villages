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

/** Where one world step of a master stands in this tree, as the world cache tells it: see decision record 0095. */
export type Standing = 'current' | 'on the shelf' | 'to make' | 'cannot';

/** One world step of a master - the tiles, the flow, the sprite map, the origin - and why it is not current. */
export interface StepOnDisk {
  name: string;
  standing: Standing;
  why: string[];
}

/** One master image in `world/master`, as the dev server sees it. */
export interface MasterOnDisk {
  name: string;
  file: string;
  width: number;
  height: number;
  bytes: number;
  /** Whether this tree has its tiles at all, current or not: whether the map can draw it without waiting. */
  drawn: boolean;
  steps: StepOnDisk[];
}

/** The steps a repaint makes stale and only cutting again mends. The rest are mended apart, and quicker. */
const CUT_STEPS = ['import', 'tile', 'styles', 'flow', 'ground'];
const ORIGIN_STEPS = ['origin', 'culture', 'height'];

const notCurrent = (step: StepOnDisk) => step.standing === 'on the shelf' || step.standing === 'to make';
const stale = (master: MasterOnDisk, names: string[]) =>
  master.steps.filter((step) => names.includes(step.name) && notCurrent(step));

/**
 * Whether what is drawn is not what the image and the files it is made from say: told from what each step is made
 * from, never from a date, so a tree checked out a minute ago is not told its borrowed world is stale.
 */
export function isStale(master: MasterOnDisk): boolean {
  return master.drawn && stale(master, CUT_STEPS).length > 0;
}

/**
 * Whether a master's sprite map is out of date, and so whether its scenery is standing on stale ground: the image
 * painted since, or **`world/biomes.json` saved since**, which tuning a look does over and over without touching
 * a master. Separate from `isStale` because the two go stale together and are mended apart.
 */
export function isUnfurnished(master: MasterOnDisk): boolean {
  return master.steps.some(
    (step) => (step.name === 'sprites' || step.name === 'ruins') && step.standing !== 'current',
  );
}

/**
 * What a cut master's origin map needs, if anything: worked out again, with the cultures and the height fitted
 * through it, because the master was painted since; or only its names carried again, because the review of 1790
 * was saved since. Nothing for a master that is not drawn yet. See `docs/plans/real-world-names.md`.
 */
export function originNeeds(master: MasterOnDisk): 'origin' | 'names' | null {
  if (!master.drawn) {
    return null;
  }
  if (stale(master, ORIGIN_STEPS).length > 0) {
    return 'origin';
  }
  return stale(master, ['names']).length > 0 ? 'names' : null;
}

/** Why a step is not current, in a few words, or nothing when it is. */
const reason = (step: StepOnDisk | undefined) =>
  step === undefined ? '' : `${step.name}: ${step.why[0] ?? ''}`;

/** What the panel says about a cut master's origin map and names when they are out of date, or nothing. */
export function describeOrigin(master: MasterOnDisk | undefined): string {
  const needs = master === undefined ? null : originNeeds(master);
  if (master === undefined) {
    return '';
  }
  const names = master.steps.find((step) => step.name === 'names');
  if (needs === null) {
    return names?.standing === 'cannot' ? `no real names in this world: ${names.why[0] ?? ''}` : '';
  }
  return needs === 'origin'
    ? `its origin map is out of date (${reason(stale(master, ORIGIN_STEPS)[0])}): names may stand on the wrong ground`
    : `its names are out of date (${reason(names)})`;
}

/** The listing, and who is making this tree's world just now, if anybody is. */
export interface MastersListing {
  masters: MasterOnDisk[];
  working: string | null;
}

/**
 * Every master in the folder. Empty if nothing answers, which is what a built app looks like: there is
 * no dev server there to read a directory, and the world was cut before it was built.
 */
export async function listMasters(): Promise<MastersListing> {
  const none = { masters: [], working: null };
  try {
    const response = await fetch('/world-api/masters');
    if (!response.ok) {
      return none;
    }
    const body = (await response.json()) as Partial<MastersListing>;
    return { masters: body.masters ?? [], working: body.working ?? null };
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
 * What the panel says under the terrain dropdown: enough to know whether what is on the screen is what the image
 * on disk and the files it is made from say, and why not.
 *
 * Picking a master that is already drawn reloads the page straight away, so the only states that get as far as
 * being described are the one being drawn and the ones that need cutting first.
 */
export function describeMaster(
  chosen: MasterOnDisk | undefined,
  master: string,
  working: false | Errand,
): string {
  if (working === 'cut') {
    return 'making what is out of date and borrowing the rest from the world cache: seconds for what another tree made, nine minutes for a master nobody has.';
  }
  if (working === 'furnish') {
    return 'working out the biomes and the stands, or borrowing them. Half a minute at most.';
  }
  if (working === 'origin') {
    return 'working out where the land came from, and the names, cultures and height carried through it. Two minutes, or seconds from the world cache.';
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
  const borrowable = chosen.steps.every((step) => step.standing !== 'to make');

  if (!chosen.drawn) {
    return `${size}${odd}, never cut into a world${borrowable ? ' here, and the world cache has it: seconds' : ''}`;
  }
  if (isStale(chosen)) {
    return `${size}${odd}, out of date: ${reason(stale(chosen, CUT_STEPS)[0])}`;
  }
  const sprites = chosen.steps.find((step) => step.name === 'sprites');
  if (sprites?.standing === 'cannot') {
    return `${size}${odd}, growing nothing: ${sprites.why[0] ?? 'it has no sprite map'}`;
  }
  if (isUnfurnished(chosen)) {
    return `${size}${odd}, its sprite map is out of date: ${sprites?.why[0] ?? ''}`;
  }
  const cannot = chosen.steps.filter((step) => step.standing === 'cannot').map((step) => step.name);
  return `${size}${odd}, current: every step is what it is made from${cannot.length > 0 ? `, but no ${cannot.join(' or ')}` : ''}`;
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
