import { describe, expect, it } from 'vitest';

import { armSpawn, askSpawn, critterSpawnStore, takeSpawns } from './critterSpawn';
import { lastsFor, posesOf } from './critterClock';
import { CRITTERS_LOOK } from './look';
import { spawnedAt } from './spawned';
import type { Cover, Ground, SpawnAsk } from './types';

/** Oaks two world units apart on the ground said, the house seeing none of it, unless told otherwise. */
function ground(land = 'mixed-forest', kind = 'oak', change: Partial<Ground> = {}): Ground {
  return {
    coverIn(fromX, fromY, toX, toY) {
      const cover: Cover[] = [];
      for (let y = Math.ceil(fromY / 2) * 2; y < toY; y += 2) {
        for (let x = Math.ceil(fromX / 2) * 2; x < toX; x += 2) cover.push({ x, y, kind, height: 4 });
      }
      return cover;
    },
    classAt: () => land,
    sees: () => false,
    ...change,
  };
}

const NOW = Date.UTC(2026, 9, 17, 9, 0, 0) / 1000;
const ask = (kind: string, x = 1000.7, y = 2000.2): SpawnAsk => ({ id: 7, kind, x, y, at: NOW });

describe('a critter put where a click asks', () => {
  it('bursts a flock out of the tree nearest the click, now, where the house sees nothing', () => {
    const event = spawnedAt(ask('songbird'), NOW, ground());
    if (event === null || typeof event === 'string') throw new Error(`no flock: ${event}`);
    expect(event.behaviour).toBe('flush');
    expect(event.startsAt).toBe(NOW);
    expect(event.from).toMatchObject({ x: 1000, y: 2000 });
    expect(event.animals.length).toBeGreaterThanOrEqual(CRITTERS_LOOK.flush.flock[0]);
    expect(event.animals.some((bird) => bird.to === null)).toBe(true);
    expect(posesOf(event, NOW + 0.5, 3).length).toBeGreaterThan(0);
  });

  it('sends a squirrel or a hare from the cover nearest the click to more near it', () => {
    const squirrel = spawnedAt(ask('squirrel'), NOW, ground());
    if (squirrel === null || typeof squirrel === 'string') throw new Error(`no squirrel: ${squirrel}`);
    expect(squirrel.behaviour).toBe('hop');
    expect(squirrel.animals[0]!.to).not.toBeNull();
    const hare = spawnedAt(ask('hare'), NOW, ground('meadow', 'grass'));
    if (hare === null || typeof hare === 'string') throw new Error(`no hare: ${hare}`);
    expect(hare.kind).toBe('hare');
    expect(lastsFor(hare)).toBeGreaterThan(0);
  });

  it('leaps a fish from the water clicked, and says why not on land', () => {
    const fish = spawnedAt(ask('fish'), NOW, ground('lake'));
    if (fish === null || typeof fish === 'string') throw new Error(`no fish: ${fish}`);
    expect(fish.behaviour).toBe('leap');
    expect(fish.from).toMatchObject({ x: 1000.7, y: 2000.2 });
    expect(spawnedAt(ask('fish'), NOW, ground())).toMatch(/water/);
  });

  it('circles a hawk over the open ground clicked, and says why not over a wood', () => {
    const hawk = spawnedAt(ask('hawk'), NOW, ground('meadow'));
    if (hawk === null || typeof hawk === 'string') throw new Error(`no hawk: ${hawk}`);
    expect(hawk.behaviour).toBe('soar');
    expect(hawk.from).toMatchObject({ x: 1000.7, y: 2000.2 });
    expect(spawnedAt(ask('hawk'), NOW, ground())).toMatch(/open ground/);
  });

  it('says why when nothing near could come there, and waits while the ground is not known', () => {
    expect(spawnedAt(ask('songbird'), NOW, ground('mixed-forest', 'boulder'))).toMatch(/nothing/);
    expect(
      spawnedAt(ask('songbird'), NOW, ground('mixed-forest', 'oak', { coverIn: () => null })),
    ).toBeNull();
    expect(spawnedAt(ask('fish'), NOW, ground('lake', 'oak', { classAt: () => null }))).toBeNull();
  });

  it('is asked for only while a kind is armed, and taken once', () => {
    armSpawn(null);
    askSpawn(1, 2);
    expect(takeSpawns()).toEqual([]);
    armSpawn('hare');
    askSpawn(3, 4);
    expect(critterSpawnStore.get().asked).toHaveLength(1);
    expect(takeSpawns()).toMatchObject([{ kind: 'hare', x: 3, y: 4 }]);
    expect(takeSpawns()).toEqual([]);
    armSpawn(null);
  });
});
