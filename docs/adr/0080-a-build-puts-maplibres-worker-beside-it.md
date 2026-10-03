# 0080. A build puts MapLibre's worker beside it

- Status: accepted
- Date: 2026-10-03

## Context

MapLibre 6 does its tile work in a module worker, and finds the worker the way a module finds a file beside
it: its own module resolves `./maplibre-gl-worker.mjs` against `import.meta.url`, and the worker imports
`./maplibre-gl-shared.mjs` in turn. The dev server serves the package as it was installed, kept out of
pre-bundling for this reason, so both files are where MapLibre looks.

A production build bundles MapLibre's module into one of the page's chunks and copies neither file. The name
is put together from a variable at run time, so the bundler cannot see that a file is asked for. A built page
asked for `/assets/maplibre-gl-worker.mjs`, `vite preview` answered with `index.html`, and the map never fired
`load`. The terrain drew, because raster tiles do not need the worker, but `MapView` never said it was ready,
so nothing that stands on the map was mounted: no sprites, no castles, no fog, no scenery. Serving a
production build to prove 0079 found it, and 0079 left it to a step of its own.

## Decision

**A production build puts MapLibre's worker, and whatever it imports from beside itself, next to the chunk
MapLibre was bundled into, as they were installed.** `apps/web/vite/maplibreWorker.ts` is a Vite plugin that
applies only to a build. Once the chunks are made, it finds the one that holds MapLibre's module and emits the
worker and the shared module into the same folder, less the last line of each, which points at a source map a
build does not ship. MapLibre then finds its worker in a built page exactly as it does on the dev server.

The development server is left as it was: the plugin does not exist for it.

The build fails, rather than shipping a map that never loads, when MapLibre is in none of the chunks or when
its chunk no longer names `maplibre-gl-worker.mjs`, which is what a MapLibre that renamed its worker, or
stopped loading it from beside itself, would look like. A test holds the installed MapLibre to the same: its
module names the worker, and the worker imports the shared module and nothing else.

## Consequences

- A built page's map loads. The overlays are mounted, a house can be founded from the parchment, and its
  castle stands on the map. Served by `vite preview`, the worker and the shared module come back from
  `/assets/` as JavaScript.
- The two files keep MapLibre's names, without a hash, because MapLibre asks for them by those names. A server
  that caches everything under `/assets/` for good would keep the old worker across an upgrade of MapLibre.
  The first time the page is served by something other than `vite preview`, these two names want a shorter
  cache, or the second alternative below.
- A built page downloads the shared module twice: once inside the page's chunk, where the main thread uses it,
  and once on its own for the worker, about 490 kB before compression. MapLibre's own layout downloads it
  once; this is the price of letting the bundler have the main thread's half.
- An upgrade of MapLibre that changes how it finds its worker fails `npm run check` and the build, rather than
  a page.

## Alternatives considered

- **`setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href)` at startup.**
  Vite emits the worker as an asset of its own, renamed with a hash, and copies nothing it imports. Tried, it
  emitted `maplibre-gl-worker-<hash>.mjs`, which still imports `./maplibre-gl-shared.mjs`, and that was not
  there. It needs the shared module copied beside it all the same, and it changes how the dev server's page
  finds the worker too, unless it is fenced off for a build.
- **`setWorkerUrl` with the worker imported as `?worker&url`.** Vite bundles the worker and what it imports
  into one self-contained file with a hash, 478 kB, which could be cached for good. But it is a line of the
  game's startup that exists only for a build, the import is still made on the dev server, and the worker a
  built page runs would be Vite's rebundling of it rather than the file MapLibre published. Worth taking up if
  the cache above ever matters.
- **Leaving MapLibre out of the bundle**, served from its own folder as installed, so that the shared module is
  downloaded once. It is a larger change to the build for the saving of one download, and nothing has asked
  for it.
