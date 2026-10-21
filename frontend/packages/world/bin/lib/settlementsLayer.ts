import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { standsDirOf } from '../../src/masters.ts';
import { encodeSettlements } from '../../src/settlementRecords.ts';
import type { SettlementRecord, SettlementsMapFile } from '../../src/settlementRecords.ts';

import { freshFolder, writtenAt } from './outputs.ts';
import { STANDS_DIR } from './paths.ts';

/*
 * The settlements as the page is sent them, written by `world:settlements`: the layer of the stands and how to read it
 * (decision record 0117).
 */

const LAYER = 'settlements';
const TILE_UNITS = 256;
/**
 * The settlements layer of the stands and how to read it: a record a settlement in every tile its circle touches, into
 * `world/stands/<master>/settlements/`, which only the game server reads, and each one's site's id and name by its
 * number, into the master's `sprites/settlements/map.json`, which says nothing of where any is. Says how many bytes.
 */
export async function writeSettlementsLayer(
  settlements: readonly (SettlementRecord & { readonly id: string; readonly name: string })[],
  master: string,
  worldDir: string,
  width: number,
): Promise<number> {
  const across = Math.floor(width / TILE_UNITS);
  const byTile = new Map<number, SettlementRecord[]>();
  for (const one of settlements) {
    for (
      let tileY = Math.max(0, Math.floor((one.y - one.radius) / TILE_UNITS));
      tileY <= Math.min(across - 1, Math.floor((one.y + one.radius) / TILE_UNITS));
      tileY += 1
    ) {
      for (
        let tileX = Math.floor((one.x - one.radius) / TILE_UNITS);
        tileX <= Math.floor((one.x + one.radius) / TILE_UNITS);
        tileX += 1
      ) {
        const wrapped = ((tileX % across) + across) % across;
        const record = { ...one, x: one.x + (wrapped - tileX) * TILE_UNITS };
        const at = tileY * across + wrapped;
        const here = byTile.get(at);
        if (here === undefined) byTile.set(at, [record]);
        else here.push(record);
      }
    }
  }
  const mapDir = writtenAt(resolve(worldDir, 'sprites', LAYER));
  const standsDir = writtenAt(resolve(STANDS_DIR, standsDirOf(master, LAYER)));
  // Both halves go, so neither outlives the other and nothing the page could fetch is left behind (0067, 0095).
  freshFolder(mapDir, 'the settlements map');
  freshFolder(standsDir, 'the settlements');
  await mkdir(mapDir, { recursive: true });
  await mkdir(standsDir, { recursive: true });
  let bytes = 0;
  for (const [at, held] of [...byTile].sort((a, b) => a[0] - b[0])) {
    const tileX = at % across;
    const tileY = Math.floor(at / across);
    const chunk = encodeSettlements(held, tileX, tileY, TILE_UNITS);
    await mkdir(resolve(standsDir, String(tileX)), { recursive: true });
    await writeFile(resolve(standsDir, String(tileX), `${tileY}.bin`), chunk);
    bytes += chunk.length;
  }
  // Last of the stands, so that the game server never takes a half-written folder for a finished one.
  await writeFile(
    resolve(standsDir, 'stands.json'),
    `${JSON.stringify(
      {
        master,
        layer: LAYER,
        at: new Date().toISOString(),
        stands: settlements.length,
        chunks: byTile.size,
        bytes,
      },
      null,
      2,
    )}\n`,
  );
  const map: SettlementsMapFile & { $comment: string } = {
    $comment:
      'Written by npm run world:settlements: how to read the settlements layer of the stands, each settlement by the number its record carries. Worked out again from world/settlements.json, the tiles, the names and the ruins, never edited.',
    master,
    layer: LAYER,
    at: new Date().toISOString(),
    world: { side: width, tileUnits: TILE_UNITS },
    settlements: [...settlements].sort((a, b) => a.index - b.index).map(({ id, name }) => ({ id, name })),
  };
  // Last of all, so that a manifest never claims a world that is not finished.
  await writeFile(resolve(mapDir, 'map.json'), `${JSON.stringify(map)}\n`);
  return bytes;
}
