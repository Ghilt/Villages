import { STAND_TILES, standTilesUnder } from '@villages/protocol';
import { NO_STANDS, decodeStands } from '@villages/world';
import type { StandChunk } from '@villages/world';

import { TILE } from '../../map/painterlyMessages';

/**
 * The stands the gateway has sent this page, a zoom 7 tile at a time, and nothing else.
 *
 * The scenery grows from stands, and since decision 0067 they are the server's to hand out: a page is sent the
 * stands of every tile under the cells it follows, as far as they touch ground its house has revealed, once
 * while it follows them and again when the fog changes what gets through. This keeps what was sent, and nothing
 * the fog held back ever reaches it.
 *
 * **A tile is kept exactly as long as the gateway thinks it was sent**: while a followed cell is over it, by the
 * same rule at both ends (`standTilesUnder`). Kept longer, coming back to it would draw what it was told before
 * the fog last changed; let go sooner, the gateway would never send it again and the cells over it would wait
 * for ever. A tile sent again with the same records changes nothing.
 */

/** One tile's stands as the gateway sent them: decoded, and the records they came in, which say whether they changed. */
export interface SentStands {
  chunk: StandChunk;
  records: string;
}

/** A tile off the top or the bottom of the world, where nothing stands and nothing is sent. */
const OFF_THE_WORLD: SentStands = { chunk: NO_STANDS, records: '' };

const sent = new Map<number, SentStands>();
/** The tiles under the cells being followed: the only ones the gateway sends, and so the only ones kept. */
let coming = new Set<number>();
const arrivals = new Set<(tile: number, stands: SentStands) => void>();
const followings = new Set<() => void>();

/** A tile's key, `y * STAND_TILES + x`, with the column wrapped round the world as the gateway's are. */
export function tileKey(tileX: number, tileY: number): number {
  return tileY * STAND_TILES + (((tileX % STAND_TILES) + STAND_TILES) % STAND_TILES);
}

/** Base64 to bytes, the way the frame carries them. */
function bytesOf(records: string): Uint8Array {
  const text = atob(records);
  const bytes = new Uint8Array(text.length);
  for (let at = 0; at < text.length; at += 1) {
    bytes[at] = text.charCodeAt(at);
  }
  return bytes;
}

/**
 * One `stands` frame. Kept if a followed cell is over the tile, and said to whoever listens if it is new or has
 * changed; a frame for a tile nothing is followed over any more was sent before the gateway heard so, and it has
 * let the tile go too.
 */
export function standsArrived(tileX: number, tileY: number, records: string): void {
  const tile = tileKey(tileX, tileY);
  if (!coming.has(tile) || sent.get(tile)?.records === records) {
    return;
  }
  const stands = { chunk: decodeStands(bytesOf(records), tileX, tileY, TILE), records };
  sent.set(tile, stands);
  for (const told of arrivals) {
    told(tile, stands);
  }
}

/**
 * The cells the gateway is following for this page now, after an ask or a letting go. Every tile no longer under
 * one of them is let go, as the gateway lets it go.
 */
export function followStandsUnder(cells: readonly string[]): void {
  coming = new Set(cells.flatMap(standTilesUnder));
  for (const tile of sent.keys()) {
    if (!coming.has(tile)) {
      sent.delete(tile);
    }
  }
  for (const told of followings) {
    told();
  }
}

/**
 * One tile's stands, or null while the gateway has not sent them.
 *
 * Null means *not yet*, as a missing terrain tile does, and for the same reason: 0022 says ground already on the
 * screen must not change under the player, and a wood thickening when its stands land is that fault.
 */
export function sentStandsOf(tileX: number, tileY: number): SentStands | null {
  if (tileY < 0 || tileY >= STAND_TILES) {
    return OFF_THE_WORLD;
  }
  return sent.get(tileKey(tileX, tileY)) ?? null;
}

/** Whether the gateway will send this tile: whether a followed cell is over it. */
export function standsComing(tile: number): boolean {
  return coming.has(tile);
}

/** Told of every tile that arrives new or changed. Returns what stops it. */
export function onStandsArrived(listener: (tile: number, stands: SentStands) => void): () => void {
  arrivals.add(listener);
  return () => arrivals.delete(listener);
}

/** Told whenever what is followed changes, after the tiles no longer under it have gone. Returns what stops it. */
export function onStandsFollowed(listener: () => void): () => void {
  followings.add(listener);
  return () => followings.delete(listener);
}

/** How many tiles are held, and the stands in them, for the panel. */
export function standsHeld(): { tiles: number; stands: number } {
  let stands = 0;
  for (const tile of sent.values()) {
    stands += tile.chunk.count;
  }
  return { tiles: sent.size, stands };
}

/** Everything sent is forgotten, and nothing is followed. For the tests. */
export function forgetStands(): void {
  sent.clear();
  coming = new Set();
}
