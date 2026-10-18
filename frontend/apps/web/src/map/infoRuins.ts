import type * as maplibregl from 'maplibre-gl';
import { CULTURES } from '@villages/world';
import type { Culture, RuinsMapFile } from '@villages/world';

import { WORLD_MASTER_WIDTH } from '../geometry/world';
import { heldStandsOf, onStandsArrived } from '../net/stands';

/**
 * The ruins on the Info map: every ruined town of 1790 the game server sent this page, a ring at the radius its ruins
 * are built over and a fainter one at how far they reach, in the colour of the culture they are built in - the Culture
 * renderer's. Only what the fog let through is here, because nothing else ever reached the page: with the fog lifted,
 * every town under the cells the page follows; with it down, only those touching ground the house has revealed. The
 * game server sends ruins from zoom 6 in, as it sends the scenery's stands. See decision record 0103.
 */

const COLOURS: Record<Culture, string> = {
  european: '#4a70b0',
  islamic: '#3e9660',
  eastAsian: '#c44034',
  african: '#d6a03a',
};

/** A point of world space as the map's longitude and latitude: Web Mercator, the world's square. */
function lngLatOf(x: number, y: number): [number, number] {
  return [
    (x / WORLD_MASTER_WIDTH) * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD_MASTER_WIDTH))) * 180) / Math.PI,
  ];
}

/** How the ruins are read, once fetched for a master: the overgrown ring's share, to find a town's built radius. */
export async function ruinsMapOf(master: string): Promise<RuinsMapFile | null> {
  const answer = await fetch(`/world/masters/${master}/sprites/ruins/map.json`, { cache: 'no-store' });
  return answer.ok ? ((await answer.json()) as RuinsMapFile) : null;
}

/** Repaints the map whenever ruins arrive, so they are drawn without waiting for the camera. Returns what stops it. */
export function repaintOnRuins(map: maplibregl.Map): () => void {
  return onStandsArrived((_, __, layer) => {
    if (layer === 'ruins') map.triggerRepaint();
  });
}

/** Every ruined town held, once each - a town is sent in every tile its ruins reach - drawn as its two rings. */
export function drawRuins(
  context: CanvasRenderingContext2D,
  map: maplibregl.Map,
  file: RuinsMapFile,
): number {
  const seen = new Set<string>();
  let drawn = 0;
  for (const { chunk } of heldStandsOf('ruins')) {
    for (let at = 0; at < chunk.count; at += 1) {
      const x = chunk.x[at]!;
      const y = chunk.y[at]!;
      const key = `${Math.round(x * 8) % (WORLD_MASTER_WIDTH * 8)}/${Math.round(y * 8)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const reach = chunk.reach[at]!;
      const middle = map.project(lngLatOf(x, y));
      const edge = map.project(lngLatOf(x + reach, y));
      const reachPixels = Math.abs(edge.x - middle.x);
      if (reachPixels < 0.5) continue;
      const colour = COLOURS[CULTURES[chunk.dominant[at]!] ?? 'european'];
      context.strokeStyle = colour;
      context.globalAlpha = 0.9;
      context.lineWidth = 1.5;
      context.setLineDash([]);
      context.beginPath();
      context.arc(middle.x, middle.y, reachPixels / (1 + file.ring), 0, 2 * Math.PI);
      context.stroke();
      context.globalAlpha = 0.45;
      context.lineWidth = 1;
      context.setLineDash([4, 3]);
      context.beginPath();
      context.arc(middle.x, middle.y, reachPixels, 0, 2 * Math.PI);
      context.stroke();
      drawn += 1;
    }
  }
  context.globalAlpha = 1;
  context.setLineDash([]);
  return drawn;
}
