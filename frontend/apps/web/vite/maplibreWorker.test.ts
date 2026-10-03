import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { WORKER, whereMaplibreIs, workerFiles } from './maplibreWorker.ts';

const INSTALLED = 'E:/Code/Villages/frontend/node_modules/maplibre-gl/dist';

describe("MapLibre's worker in a production build", () => {
  it('goes beside the chunk MapLibre was bundled into, from the folder it was installed in', () => {
    const chunks = [
      { fileName: 'assets/UiComponents-B1.js', moduleIds: ['E:/x/src/admin/UiComponents.tsx'], code: '' },
      {
        fileName: 'assets/index-C2.js',
        moduleIds: ['E:/x/src/main.tsx', `${INSTALLED}/maplibre-gl.mjs`],
        code: `new URL(\`./\${"${WORKER}"}\`, import.meta.url)`,
      },
    ];

    expect(whereMaplibreIs(chunks)).toEqual({ beside: 'assets', installed: INSTALLED });
  });

  it('fails the build when MapLibre is in none of its chunks', () => {
    const chunks = [{ fileName: 'assets/index-C2.js', moduleIds: ['E:/x/src/main.tsx'], code: '' }];

    expect(() => whereMaplibreIs(chunks)).toThrow(/MapLibre is in none of the chunks/);
  });

  it('fails the build when MapLibre no longer asks for its worker by that name', () => {
    const chunks = [
      {
        fileName: 'assets/index-C2.js',
        moduleIds: [`${INSTALLED}/maplibre-gl.mjs`],
        code: 'new Worker(blob)',
      },
    ];

    expect(() => whereMaplibreIs(chunks)).toThrow(/no longer asks for maplibre-gl-worker\.mjs/);
  });

  it('is, for the MapLibre installed, its worker and the shared module it imports, less their source maps', () => {
    const installed = join(
      dirname(createRequire(import.meta.url).resolve('maplibre-gl/package.json')),
      'dist',
    );
    const read = (name: string): string => readFileSync(join(installed, name), 'utf8');

    const files = workerFiles(read);

    expect(read('maplibre-gl.mjs')).toContain(WORKER);
    expect([...files.keys()]).toEqual(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);
    for (const [name, source] of files) {
      expect(read(name)).toContain('sourceMappingURL');
      expect(source).not.toContain('sourceMappingURL');
    }
  });
});
