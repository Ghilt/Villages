import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { buildApi } from './vite/build.ts';
import { worldApi } from './vite/worldApi.ts';
import { worktreeApi } from './vite/worktrees.ts';
import { worktreeHere } from './vite/worktreePort.ts';

// Which tree this is, and therefore which port it serves on: the main checkout keeps 5173 and every
// worktree gets its own, so several sessions can serve at once. See decision record 0031.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const tree = worktreeHere(REPO);

export default defineConfig({
  // worldApi is the dev server's own answer to "what masters are there, and cut me that one".
  plugins: [react(), worldApi(), worktreeApi(), buildApi()],
  define: {
    // Which world this page belongs to. Every tree runs its own game server now, so a page that
    // assumed 8080 would be putting its events into whichever tree happened to own that port. An
    // explicit VITE_GATEWAY_URL still wins; this is only the answer when nothing was said. See 0031.
    'import.meta.env.VITE_GAME_PORT': JSON.stringify(String(tree.gamePort)),
  },
  // MapLibre spawns its own module worker. Pre-bundling the package rewrites the import graph and the
  // worker URL 404s, which leaves a live map that draws nothing but its background colour.
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
