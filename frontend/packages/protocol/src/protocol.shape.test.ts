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
 * last week answers a page built today with "could not resolve type id". Every field is in it however
 * deep, by its path, walked here through zod's own description of each schema and there through the
 * Kotlin classes; the two walks coming to the same lines is a check of its own.
 */

const recording = fileURLToPath(
  new URL(`../../../../contracts/protocol-v${PROTOCOL_VERSION}.txt`, import.meta.url),
);

/** Enough of zod's own description of a schema to walk it. */
type Def = {
  type: string;
  shape?: Record<string, unknown>;
  element?: unknown;
  innerType?: unknown;
  valueType?: unknown;
  options?: readonly unknown[];
  discriminator?: string;
};

const defOf = (schema: unknown): Def => (schema as { _zod: { def: Def } })._zod.def;

const fieldsOf = (object: unknown, without?: string): [string, unknown][] =>
  Object.entries(defOf(object).shape ?? {}).filter(([field]) => field !== without);

/** The name a case of a union is told apart by on the wire. */
function caseName(option: unknown, discriminator: string): string {
  const literal = defOf(option).shape?.[discriminator] as { value?: unknown } | undefined;
  if (literal === undefined) {
    throw new Error(`a case with no ${discriminator} cannot be told apart on the wire`);
  }
  return String(literal.value);
}

function below(
  side: string,
  frame: string,
  path: string,
  object: unknown,
  without: string | undefined,
  seen: ReadonlySet<unknown>,
): string[] {
  const fields = fieldsOf(object, without);
  const inner = new Set(seen).add(object);
  return [
    [side, frame, path, ...fields.map(([field]) => field).sort()].join(' '),
    ...fields.flatMap(([field, schema]) => nested(side, frame, `${path}.${field}`, schema, inner)),
  ];
}

/**
 * The objects a field holds, however deep, each as a line of its path and its fields: through an array, a
 * record's values, an optional and a nullable alike, and into each case of a discriminated union; no further
 * than a value, an enum, or the stored event's data, which the fixtures own.
 */
function nested(
  side: string,
  frame: string,
  path: string,
  schema: unknown,
  seen: ReadonlySet<unknown>,
): string[] {
  const def = defOf(schema);
  switch (def.type) {
    case 'optional':
    case 'nullable':
      return nested(side, frame, path, def.innerType, seen);
    case 'array':
      return nested(side, frame, `${path}[]`, def.element, seen);
    case 'record':
      return nested(side, frame, `${path}{}`, def.valueType, seen);
    case 'object':
      return seen.has(schema) ? [] : below(side, frame, path, schema, undefined, seen);
    case 'union': {
      const discriminator = def.discriminator;
      if (discriminator === undefined) {
        throw new Error(`${frame} ${path} is a union with nothing to tell its cases apart`);
      }
      return (def.options ?? []).flatMap((option) =>
        below(side, frame, `${path}:${caseName(option, discriminator)}`, option, discriminator, seen),
      );
    }
    default:
      return [];
  }
}

function linesOf(side: string, union: unknown, discriminator: 'type' | 'kind'): string[] {
  return (defOf(union).options ?? []).flatMap((option) => {
    const name = caseName(option, discriminator);
    const fields = fieldsOf(option, discriminator);
    return [
      [side, name, ...fields.map(([field]) => field).sort()].join(' '),
      ...fields.flatMap(([field, schema]) => nested(side, name, `.${field}`, schema, new Set([option]))),
    ];
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

  it('reaches inside the frames, to a field three objects down', () => {
    expect(shape.some((line) => line.split(' ')[2]?.includes('[].'))).toBe(true);
  });
});
