import { describe, expect, it } from 'vitest';

import { LINE_UP, slowestFrames } from './slowFrames';
import type { TimedProfile } from './slowFrames';

const SRC = 'http://localhost:5555/src/';
const node = (id: number, functionName: string, url: string, children: number[] = []) => ({
  id,
  callFrame: { functionName, url, lineNumber: 9 },
  children,
});

/**
 * The root calling the line-up mark, the game's `draw`, which calls into Pixi, MapLibre on its own, and nothing; a
 * sample every millisecond on a clock of the profile's own that begins at five seconds.
 */
function profile(samples: number[]): TimedProfile {
  return {
    startTime: 5_000_000,
    nodes: [
      node(1, '(root)', '', [2, 3, 5, 6]),
      node(2, LINE_UP, `${SRC}never.ts`),
      node(3, 'draw', `${SRC}sprites/roads/RoadsLayer.ts`, [4]),
      node(4, 'render', 'http://localhost:5555/node_modules/.vite/deps/pixi__js.js'),
      node(5, '_render', 'http://localhost:5555/node_modules/maplibre-gl/dist/maplibre-gl.mjs'),
      node(6, '(idle)', ''),
    ],
    samples,
    timeDeltas: samples.map(() => 1000),
  };
}

// The mark's last sample ends where the page said 100 ms, so the samples that follow are at 101, 102 and on.
const samples = [2, 2, 2, 3, 4, 4, 5, 6, 6, 3, 5, 6];

describe('the slowest frames', () => {
  it('lines the profile up by the mark, and gives a library’s time to the game’s function that called it', () => {
    expect(slowestFrames(profile(samples), [100, 101, 130], 100, 200)).toEqual([
      {
        at: 1,
        ms: 29,
        ran: [
          { name: 'draw sprites/roads/RoadsLayer.ts:10', ms: 3 },
          { name: 'maplibre-gl', ms: 2 },
        ],
      },
    ]);
  });

  it('keeps only frames that came late, the slowest first and no more than asked for', () => {
    const frames = [100, 101, 130, 131, 171, 180];
    expect(slowestFrames(profile(samples), frames, 100, 200).map((frame) => frame.ms)).toEqual([40, 29]);
    expect(slowestFrames(profile(samples), frames, 100, 200, 1).map((frame) => frame.at)).toEqual([31]);
  });

  it('says nothing when the profile cannot be lined up', () => {
    expect(slowestFrames(profile([3, 4, 5]), [100, 101, 130], 100, 200)).toEqual([]);
  });
});
