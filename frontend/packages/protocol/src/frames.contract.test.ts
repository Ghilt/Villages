import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { clientFrameSchema, deltaSchema, frameTypesOf, serverFrameSchema } from './frames';

/**
 * The fixtures own the wire format. Every fixture parses under its side's schema and comes back unchanged,
 * every fixture names a frame the schema knows, and every frame the schema knows has a fixture. The Kotlin
 * module runs the same check on the same files, so neither side can drift without a test saying so.
 */
const fixtures = fileURLToPath(new URL('../../../../contracts/fixtures/frames/', import.meta.url));

function framesIn(side: 'client' | 'server'): { name: string; frame: unknown }[] {
  return readdirSync(`${fixtures}${side}`)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      name: file,
      frame: JSON.parse(readFileSync(`${fixtures}${side}/${file}`, 'utf8')) as unknown,
    }));
}

const typeOf = (frame: unknown): string => (frame as { type: string }).type;

describe('the client frames', () => {
  const found = framesIn('client');

  it('parse from every fixture and come back unchanged', () => {
    expect(found.length).toBeGreaterThan(0);
    for (const { name, frame } of found) {
      const parsed = clientFrameSchema.safeParse(frame);
      expect(parsed.success, `${name}: ${parsed.success ? '' : parsed.error.message}`).toBe(true);
      expect(parsed.data).toEqual(frame);
    }
  });

  it('are exactly the frames the fixtures describe, in both directions', () => {
    expect([...new Set(found.map(({ frame }) => typeOf(frame)))].sort()).toEqual(
      [...frameTypesOf(clientFrameSchema)].sort(),
    );
  });
});

describe('the server frames', () => {
  const found = framesIn('server');

  it('parse from every fixture and come back unchanged', () => {
    expect(found.length).toBeGreaterThan(0);
    for (const { name, frame } of found) {
      const parsed = serverFrameSchema.safeParse(frame);
      expect(parsed.success, `${name}: ${parsed.success ? '' : parsed.error.message}`).toBe(true);
      expect(parsed.data).toEqual(frame);
    }
  });

  it('are exactly the frames the fixtures describe, in both directions', () => {
    expect([...new Set(found.map(({ frame }) => typeOf(frame)))].sort()).toEqual(
      [...frameTypesOf(serverFrameSchema)].sort(),
    );
  });

  it('carry every kind of delta in the batch fixture, so a new delta needs a fixture too', () => {
    const batch = found.find(({ name }) => name === 'batch.json')?.frame as { deltas: unknown[] };

    expect([...new Set(batch.deltas.map(typeOf))].sort()).toEqual([...frameTypesOf(deltaSchema)].sort());
  });
});

describe('what the schemas refuse', () => {
  it('a cell that is not eight digits of 0 to 3', () => {
    expect(clientFrameSchema.safeParse({ type: 'subscribeCells', cells: ['1234567'] }).success).toBe(false);
    expect(clientFrameSchema.safeParse({ type: 'subscribeCells', cells: ['1200312a'] }).success).toBe(false);
  });

  it('a frame of a type nobody declared', () => {
    expect(serverFrameSchema.safeParse({ type: 'goodbye' }).success).toBe(false);
  });
});
