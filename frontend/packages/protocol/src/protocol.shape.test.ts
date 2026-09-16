import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  clientFrameSchema,
  commandPayloadSchema,
  deltaSchema,
  effectViewSchema,
  serverFrameSchema,
} from './frames';
import { PROTOCOL_VERSION } from './index';

/**
 * This end of the wire is the shape recorded for the version it declares, which is the same file the
 * Kotlin `ProtocolShapeSpec` holds itself to. Two ends checking one recording is what keeps the two
 * `PROTOCOL_VERSION` constants equal: declare a different number here and this test reads a different
 * file, or none at all.
 *
 * Why it is worth a test of its own, when the fixtures already own the format: a fixture proves that a
 * frame we know about is written the way both ends expect. Nothing but this proves that the set of
 * frames has not moved underneath a version number, which is the shape of the bug where a server built
 * last week answers a page built today with "could not resolve type id".
 */

const recording = fileURLToPath(
  new URL(`../../../../contracts/protocol-v${PROTOCOL_VERSION}.txt`, import.meta.url),
);

/** Enough of a zod discriminated union to read the names and fields off it. */
type Union = { options: readonly { shape: Record<string, { value?: unknown }> }[] };

function linesOf(side: string, union: unknown, discriminator: 'type' | 'kind'): string[] {
  return (union as Union).options.map((option) => {
    const literal = option.shape[discriminator];
    if (literal === undefined) {
      throw new Error(`a ${side} frame with no ${discriminator} cannot be told apart on the wire`);
    }
    const name = literal.value;
    const fields = Object.keys(option.shape)
      .filter((field) => field !== discriminator)
      .sort();
    return [side, String(name), ...fields].join(' ');
  });
}

const shape = [
  ...linesOf('client', clientFrameSchema, 'type'),
  ...linesOf('command', commandPayloadSchema, 'type'),
  ...linesOf('delta', deltaSchema, 'type'),
  ...linesOf('effect', effectViewSchema, 'kind'),
  ...linesOf('server', serverFrameSchema, 'type'),
].sort();

const meaningful = readFileSync(recording, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));

describe('the wire', () => {
  it('is the shape recorded for the version it declares', () => {
    expect(meaningful).toEqual([`version ${PROTOCOL_VERSION}`, ...shape]);
  });
});
