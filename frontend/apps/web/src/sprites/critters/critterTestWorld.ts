import { eventIn, slotOf } from './critterClock';
import type { Cover, CritterEvent, Ground } from './critterClock';

/**
 * The world the critters' tests are run in, shared by the clock's, the hop's and the leap's: a wood of oaks, a ruined
 * town grown over by one, a patch of cells over it, an afternoon, and every critter they bring over an hour. Only the
 * tests import it.
 */

/** A wood of oaks so many world units apart, two unless told, the house seeing all of it, unless told otherwise. */
export function wood(change: Partial<Ground> = {}, kind = 'oak', land = 'mixed-forest', apart = 2): Ground {
  return {
    coverIn(fromX, fromY, toX, toY) {
      const cover: Cover[] = [];
      for (let y = Math.ceil(fromY / apart) * apart; y < toY; y += apart) {
        for (let x = Math.ceil(fromX / apart) * apart; x < toX; x += apart) {
          cover.push({ x: x + 0.3, y: y + 0.7, kind, height: 4 });
        }
      }
      return cover;
    },
    classAt: () => land,
    sees: () => true,
    ...change,
  };
}

/**
 * A ruined town grown over by a wood on farmland: pieces of the ruins two world units apart, by turns a hall, a heap of
 * rubble, a broken house and an oak, the house seeing all of it, unless told otherwise.
 */
export function ruinedWood(change: Partial<Ground> = {}): Ground {
  const kinds = ['ruin:hall-european', 'ruin:rubble-european', 'ruin:shell-islamic', 'oak'];
  return wood(
    {
      coverIn(fromX, fromY, toX, toY) {
        const cover: Cover[] = [];
        for (let y = Math.ceil(fromY / 2) * 2; y < toY; y += 2) {
          for (let x = Math.ceil(fromX / 2) * 2; x < toX; x += 2) {
            const kind = kinds[(x / 2 + y) % kinds.length]!;
            cover.push({ x: x + 0.3, y: y + 0.7, kind, height: kind === 'ruin:hall-european' ? 8 : 3 });
          }
        }
        return cover;
      },
      ...change,
    },
    'oak',
    'farmland-with-woods',
  );
}

export const CELLS = { fromX: 2000, toX: 2040, fromY: 1000, toY: 1030 };
/** An afternoon of 2026, in seconds of the wall clock. */
export const NOW = Date.UTC(2026, 9, 16, 15, 0, 0) / 1000;

/** A corner of those cells, for the tests that fill every cell's every slot. */
export const CORNER = { fromX: 2000, toX: 2020, fromY: 1000, toY: 1015 };

/**
 * The default wood's hours, by density: the clock is a function of where and when and nothing else, so the same hour
 * is the same critters every time, and the tests that ask for it - eleven of them across the critters' files - share
 * one working-out a file rather than each spending most of a second on its own (2026-10-20). Only read, never changed.
 */
const hours = new Map<number, Map<string, CritterEvent>>();

/** Every critter of the cells over an hour, or as many seconds as said, by its key. */
export function anHour(
  density: number,
  ground?: Ground,
  seconds = 3600,
  cells = CELLS,
): ReadonlyMap<string, CritterEvent> {
  if (ground !== undefined || seconds !== 3600 || cells !== CELLS) {
    return critters(density, ground ?? wood(), seconds, cells);
  }
  const hour = hours.get(density) ?? critters(density, wood(), seconds, cells);
  hours.set(density, hour);
  return hour;
}

function critters(
  density: number,
  ground: Ground,
  seconds: number,
  cells: typeof CELLS,
): Map<string, CritterEvent> {
  const events = new Map<string, CritterEvent>();
  for (let slot = slotOf(NOW); slot < slotOf(NOW + seconds); slot += 1) {
    for (let cellY = cells.fromY; cellY <= cells.toY; cellY += 1) {
      for (let cellX = cells.fromX; cellX <= cells.toX; cellX += 1) {
        const event = eventIn(cellX, cellY, slot, density, ground);
        if (event !== null) events.set(event.key, event);
      }
    }
  }
  return events;
}

/** The flocks among some critters: the birds bursting out of cover or flitting to shelter. */
export const flocks = (events: Iterable<CritterEvent>) =>
  [...events].filter((event) => event.behaviour === 'flush');
