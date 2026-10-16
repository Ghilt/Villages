import { existsSync, watch } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

/**
 * The event catalogue for the events' inspect page: `/event-catalogue/` sends `docs/EVENTS.md` as it is written, and
 * every sample of an event in `contracts/fixtures/events/` by the type it is a sample of - the one named for the type
 * first, then the cases in `cases/`, `villages.player.givenChoice.v1.pledge.json` named `pledge`. Read again on every
 * ask and sent without a cache; when either changes on disk the page is told, `villages:events-changed`, and reads it
 * again. The page parses the document; this only reads files. Development only, as the catalogues are.
 */

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, '..', '..', '..', '..');
const DOCUMENT = resolve(REPO, 'docs', 'EVENTS.md');
const SAMPLES = resolve(REPO, 'contracts', 'fixtures', 'events');

/** Let a burst of writes settle - an editor saves in several - before the page is told. */
const SETTLE_MS = 150;

/** What the hot-reload channel carries when the document or a sample changes on disk. */
export const EVENTS_CHANGED = 'villages:events-changed';

/** One sample of an event: its name, `sample` for the one named for the type or the case's name, and the event. */
export interface EventSample {
  readonly name: string;
  readonly event: unknown;
}

/** What `/event-catalogue/` sends. */
export interface EventCatalogueFiles {
  readonly document: string;
  readonly samples: Readonly<Record<string, readonly EventSample[]>>;
}

/** The type a sample's file is of, and its case's name: `villages.house.founded.v1.json` is the type's own sample. */
export function sampleOf(file: string, inCases: boolean): { type: string; name: string } | null {
  const match = /^(villages\.[a-z]+\.[a-zA-Z]+\.v\d+)(?:\.([a-zA-Z-]+))?\.json$/.exec(file);
  if (match === null || (inCases && match[2] === undefined) || (!inCases && match[2] !== undefined))
    return null;
  return { type: match[1]!, name: match[2] ?? 'sample' };
}

async function samplesIn(folder: string, inCases: boolean): Promise<[string, EventSample][]> {
  if (!existsSync(folder)) return [];
  const files = (await readdir(folder)).sort();
  const read: [string, EventSample][] = [];
  for (const file of files) {
    const named = sampleOf(file, inCases);
    if (named === null) continue;
    read.push([
      named.type,
      { name: named.name, event: JSON.parse(await readFile(resolve(folder, file), 'utf8')) as unknown },
    ]);
  }
  return read;
}

export async function eventCatalogueFiles(): Promise<EventCatalogueFiles> {
  const samples: Record<string, EventSample[]> = {};
  for (const [type, sample] of [
    ...(await samplesIn(SAMPLES, false)),
    ...(await samplesIn(resolve(SAMPLES, 'cases'), true)),
  ]) {
    (samples[type] ??= []).push(sample);
  }
  return { document: await readFile(DOCUMENT, 'utf8'), samples };
}

export function eventsApi(): Plugin {
  return {
    name: 'villages:events',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/event-catalogue', (request, response, next) => {
        if (request.method !== 'GET') {
          next();
          return;
        }
        eventCatalogueFiles().then(
          (files) => {
            response.setHeader('Content-Type', 'application/json');
            response.setHeader('Cache-Control', 'no-store');
            response.end(JSON.stringify(files));
          },
          (unread: unknown) => {
            response.statusCode = 500;
            response.end(`docs/EVENTS.md or contracts/fixtures/events could not be read: ${String(unread)}`);
          },
        );
      });

      let waiting: ReturnType<typeof setTimeout> | undefined;
      const changed = () => {
        clearTimeout(waiting);
        waiting = setTimeout(() => server.ws.send({ type: 'custom', event: EVENTS_CHANGED }), SETTLE_MS);
      };
      // The document's folder rather than the document: an editor that saves by renaming over a file ends a watch of it.
      const watchers = [
        existsSync(DOCUMENT) && watch(dirname(DOCUMENT), (_, name) => name === 'EVENTS.md' && changed()),
        existsSync(SAMPLES) && watch(SAMPLES, { recursive: true }, changed),
      ].filter((watcher) => watcher !== false);
      server.httpServer?.on('close', () => watchers.forEach((watcher) => watcher.close()));
    },
  };
}
