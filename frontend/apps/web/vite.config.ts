import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { artApi } from './vite/artApi.ts';
import { buildApi } from './vite/build.ts';
import { catalogueApi } from './vite/catalogueApi.ts';
import { maplibreWorker } from './vite/maplibreWorker.ts';
import { portraitsApi } from './vite/portraitsApi.ts';
import { scenesApi } from './vite/scenesApi.ts';
import { spriteMarksApi } from './vite/spriteMarksApi.ts';
import { structuresArtApi } from './vite/structuresArtApi.ts';
import { uiArtApi } from './vite/uiArtApi.ts';
import { worldApi } from './vite/worldApi.ts';
import { worldFiles } from './vite/worldFiles.ts';
import { worktreeApi } from './vite/worktrees.ts';
import { worktreeHere } from './vite/worktreePort.ts';

// Which tree this is, and therefore which port it serves on: the main checkout keeps 5173 and every
// worktree gets its own, so several sessions can serve at once. See decision record 0031.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const tree = worktreeHere(REPO);

export default defineConfig({
  // worldApi is the dev server's own answer to "what masters are there, and cut me that one", and worldFiles
  // sends the cut world itself, unwatched, because fifty thousand watched tiles slowed every answer;
  // portraitsApi and scenesApi serve Adam's portraits and scenes folders without a cache, so a picture
  // saved over another shows, spriteMarksApi the marks' pictures for the pictures' page, and catalogueApi
  // serves world/catalogues/ the same way; and artApi cuts world/sprites again whenever a picture in it
  // is saved, as uiArtApi does world/ui, and structuresArtApi
  // the structures' own folder in it. maplibreWorker is the build's alone: it puts MapLibre's worker beside
  // the chunk MapLibre was bundled into, where a built page looks for it. See decision record 0080.
  plugins: [
    react(),
    worldApi(),
    worldFiles(),
    portraitsApi(),
    scenesApi(),
    spriteMarksApi(),
    catalogueApi(),
    artApi(),
    structuresArtApi(),
    uiArtApi(),
    worktreeApi(),
    buildApi(),
    maplibreWorker(),
  ],
  define: {
    // Which world this page belongs to. Every tree runs its own game server now, so a page that
    // assumed 8080 would be putting its events into whichever tree happened to own that port. An
    // explicit VITE_GATEWAY_URL still wins; this is only the answer when nothing was said. See 0031.
    'import.meta.env.VITE_GAME_PORT': JSON.stringify(String(tree.gamePort)),
  },
  // MapLibre spawns its own module worker, from the file beside its own. Pre-bundling the package rewrites
  // the import graph and the worker URL 404s, which leaves a live map that draws nothing but its background
  // colour. A production build bundles it all the same, which is what maplibreWorker is for.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    // Still strict, and now it can afford to be: the port belongs to this tree alone, so a clash means
    // either this tree is already served or two names hashed together, and both are worth being told
    // about rather than drifting silently onto a port somebody has bookmarked for something else.
    port: tree.port,
    strictPort: true,
  },
});
