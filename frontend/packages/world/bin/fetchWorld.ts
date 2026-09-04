import { createWriteStream, existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { Unzip, UnzipInflate } from 'fflate';

import { SOURCE_DIR } from './paths.ts';
import { WORLD_SOURCES } from './worldSources.ts';
import type { WorldSource } from './worldSources.ts';

/**
 * Downloads everything the world is built from, unattended.
 *
 * The world had been rebuilt several times off a copy of this data that happened to still be in a
 * temporary directory. That is not a plan. This exists so that the world stays changeable when the
 * temporary directory is cleared, which it will be, and so that nobody has to find five download pages
 * again. About 4.5 GB, once, into a directory that is not committed.
 *
 *   node bin/fetchWorld.ts [--list] [--force]
 */

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const force = args.includes('--force');

const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

/** Whether a file is already here and the size it should be. A truncated download is not "here". */
function alreadyHave(path: string, bytes: number | undefined): boolean {
  if (force || !existsSync(path)) {
    return false;
  }
  if (bytes === undefined) {
    return statSync(path).size > 0;
  }
  return statSync(path).size === bytes;
}

async function download(source: WorldSource, into: string): Promise<void> {
  const response = await fetch(source.url);
  if (!response.ok || response.body === null) {
    throw new Error(`${source.url} answered ${response.status}`);
  }

  await mkdir(dirname(into), { recursive: true });
  const expected = Number(response.headers.get('content-length') ?? 0);
  let had = 0;
  let announced = 0;

  const counted = new Readable({ read() {} });
  const body = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
  body.on('data', (chunk: Buffer) => {
    had += chunk.length;
    counted.push(chunk);
    // Every tenth of a gigabyte, so a long download is visibly alive without being noisy.
    if (expected > 0 && had - announced > 100 * 1048576) {
      announced = had;
      console.log(`    ${megabytes(had)} of ${megabytes(expected)}`);
    }
  });
  body.on('end', () => counted.push(null));
  body.on('error', (error) => counted.destroy(error));

  await pipeline(counted, createWriteStream(into));
}

/**
 * Takes named members out of a zip without holding it in memory. The river archive expands to two
 * gigabytes, which is more than a whole-archive unzip survives, so this streams member by member.
 */
async function downloadAndUnzip(source: WorldSource): Promise<void> {
  const wanted = source.members ?? [];
  const response = await fetch(source.url);
  if (!response.ok || response.body === null) {
    throw new Error(`${source.url} answered ${response.status}`);
  }
  for (const member of wanted) {
    await mkdir(dirname(resolve(SOURCE_DIR, member.into)), { recursive: true });
  }

  const writing: Promise<void>[] = [];
  const unzip = new Unzip((entry) => {
    const member = wanted.find((candidate) => entry.name.endsWith(candidate.endsWith));
    if (member === undefined) {
      return;
    }
    const out = createWriteStream(resolve(SOURCE_DIR, member.into));
    writing.push(
      new Promise<void>((done, failed) => {
        out.on('error', failed);
        out.on('close', () => {
          console.log(`    ${member.into}, ${megabytes(statSync(resolve(SOURCE_DIR, member.into)).size)}`);
          done();
        });
      }),
    );
    entry.ondata = (error, chunk, final) => {
      if (error !== null) {
        out.destroy(error);
        return;
      }
      out.write(chunk);
      if (final) {
        out.end();
      }
    };
    entry.start();
  });
  unzip.register(UnzipInflate);

  const expected = Number(response.headers.get('content-length') ?? 0);
  let had = 0;
  let announced = 0;
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    had += chunk.length;
    if (expected > 0 && had - announced > 100 * 1048576) {
      announced = had;
      console.log(`    ${megabytes(had)} of ${megabytes(expected)} unpacked as it arrives`);
    }
    unzip.push(chunk, had >= expected);
  }
  await Promise.all(writing);
}

if (listOnly) {
  console.log(`the world is built from these, into ${SOURCE_DIR}:\n`);
  for (const source of WORLD_SOURCES) {
    const paths = source.into !== undefined ? [source.into] : (source.members ?? []).map((m) => m.into);
    const here = paths.every((path) => existsSync(resolve(SOURCE_DIR, path)));
    console.log(`  ${here ? 'have' : 'need'}  ${source.name}`);
    console.log(`        ${source.what}`);
    console.log(`        ${source.credit}`);
  }
  process.exit(0);
}

await mkdir(SOURCE_DIR, { recursive: true });
let fetched = 0;

for (const source of WORLD_SOURCES) {
  if (source.into !== undefined) {
    const into = resolve(SOURCE_DIR, source.into);
    if (alreadyHave(into, source.bytes)) {
      console.log(`have  ${source.name}`);
      continue;
    }
    console.log(`fetch ${source.name}`);
    await download(source, into);
    fetched += 1;
    continue;
  }

  const members = source.members ?? [];
  if (members.every((member) => alreadyHave(resolve(SOURCE_DIR, member.into), member.bytes))) {
    console.log(`have  ${source.name}`);
    continue;
  }
  console.log(`fetch ${source.name}, unpacking as it arrives`);
  await downloadAndUnzip(source);
  fetched += 1;
}

console.log(`\n${fetched === 0 ? 'nothing to fetch, everything is here' : `fetched ${fetched} sources`}`);
console.log(`into ${SOURCE_DIR}`);
console.log('\ncredits, if any of this world is published:');
for (const credit of new Set(WORLD_SOURCES.map((source) => source.credit))) {
  console.log(`  ${credit}`);
}
