import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as forward } from 'node:http';
import { extname, join, normalize } from 'node:path';

import { build } from 'vite';

import { freePort } from './devServer.ts';

/**
 * The page as a player is handed it: built by the tree's own Vite settings, and served by a server of the tool's own,
 * the build first and the app's public folder behind it, where the world's tiles are. Building copies nothing of the
 * public folder - hundreds of megabytes of tiles - into the build, which is what a deploy would do and what this need
 * not. Nothing of the dev server's own answers is there, as on a built page; the page is told its game server is the
 * tool's, and `/auth` is passed through to it, as whatever serves the page to a player must, so it signs in at its own
 * address (decision record 0111).
 */
export interface BuiltPage {
  readonly url: string;
  stop(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
  '.pbf': 'application/x-protobuf',
  '.geojson': 'application/geo+json',
};

export async function builtPage(tree: string, into: string, gamePort: number): Promise<BuiltPage> {
  const web = join(tree, 'frontend', 'apps', 'web');
  const before = process.env['VITE_GATEWAY_URL'];
  process.env['VITE_GATEWAY_URL'] = `ws://localhost:${gamePort}/ws`;
  try {
    await build({
      root: web,
      configFile: join(web, 'vite.config.ts'),
      logLevel: 'warn',
      build: { outDir: into, emptyOutDir: true, copyPublicDir: false },
    });
  } finally {
    if (before === undefined) delete process.env['VITE_GATEWAY_URL'];
    else process.env['VITE_GATEWAY_URL'] = before;
  }
  const port = await freePort();
  const fileFor = (path: string): string | null => {
    for (const folder of [into, join(web, 'public')]) {
      const file = normalize(join(folder, path));
      if (file.startsWith(folder) && existsSync(file) && statSync(file).isFile()) return file;
    }
    return null;
  };
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0]!);
    if (path.startsWith('/auth/')) {
      const toGame = { port: gamePort, path: request.url, method: request.method, headers: request.headers };
      const asked = forward(toGame, (answer) => {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
      });
      asked.on('error', () => {
        response.statusCode = 502;
        response.end();
      });
      request.pipe(asked);
      return;
    }
    // A path that is no file is the page, as a host serving a single-page app answers it.
    const file = fileFor(path) ?? (extname(path) === '' ? join(into, 'index.html') : null);
    if (file === null) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://localhost:${port}/`,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
