import { describe, expect, it } from 'vitest';

import { kindOf, middleOf, moduleOf, requestsByKind, spanOf, spentIn } from './startupStats';

describe('a span of the start', () => {
  it('counts the long tasks begun in it, and the gaps between its frames a player sees', () => {
    const tasks = [
      { at: 100, ms: 80 },
      { at: 900, ms: 300 },
      { at: 2_100, ms: 60 },
    ];
    const frames = [0, 16, 33, 400, 416, 433, 1_300, 1_316, 2_000];
    const span = spanOf(tasks, frames, 0, 2_000);
    expect(span.longTasks).toEqual({ count: 2, total: 380, longest: 300 });
    expect(span.frames).toBe(9);
    expect(span.worstGap).toBe(867);
    expect(span.janky).toBe(3);
  });

  it('is quiet when nothing happened in it', () => {
    expect(spanOf([], [], 0, 10)).toEqual({
      longTasks: { count: 0, total: 0, longest: 0 },
      frames: 0,
      worstGap: 0,
      janky: 0,
    });
  });
});

describe('what was fetched', () => {
  it('names a fetch by its kind', () => {
    expect(kindOf('http://localhost:5454/src/map/MapView.tsx?t=1')).toBe('code');
    expect(kindOf('http://localhost:5454/node_modules/.vite/deps/maplibre-gl.js?v=1')).toBe('code');
    expect(kindOf('http://localhost:5454/@vite/client')).toBe('code');
    expect(kindOf('http://localhost:5454/world/masters/terrain3/tiles/7/90/31.png')).toBe('tiles');
    expect(kindOf('http://localhost:5454/art/scenery.webp')).toBe('pictures');
    expect(kindOf('http://localhost:5454/world/paint.json')).toBe('world');
    expect(kindOf('http://localhost:5454/world-api/masters')).toBe('world');
  });

  it('counts each kind and its kilobytes', () => {
    expect(
      requestsByKind([
        { name: 'http://h/src/a.ts', transferSize: 2048, encodedBodySize: 1024 },
        { name: 'http://h/src/b.ts', transferSize: 0, encodedBodySize: 1024 },
      ]),
    ).toEqual({ code: { count: 2, kb: 3 } });
  });
});

describe('where the CPU went', () => {
  it('names a module by the game’s path, a package, or the world package', () => {
    expect(moduleOf('http://localhost:5454/src/sprites/land/LandLayer.ts?t=1')).toBe(
      'sprites/land/LandLayer.ts',
    );
    expect(moduleOf('http://localhost:5454/node_modules/.vite/deps/maplibre-gl.js?v=9')).toBe('maplibre-gl');
    expect(moduleOf('http://localhost:5454/node_modules/.vite/deps/pixi__js.js')).toBe('pixi.js');
    expect(moduleOf('http://localhost:5454/@fs/E:/x/frontend/packages/world/src/scatter.ts')).toBe(
      '@villages/world: scatter.ts',
    );
    expect(moduleOf('', '(garbage collector)')).toBe('(garbage collector)');
    expect(moduleOf('', '(program)')).toBe('(the browser)');
  });

  it('adds up each function’s own time, a sample lasting until the next', () => {
    const spent = spentIn({
      nodes: [
        { id: 1, callFrame: { functionName: '(root)', url: '', lineNumber: -1 } },
        { id: 2, callFrame: { functionName: 'paint', url: 'http://h/src/map/paint.ts', lineNumber: 9 } },
        { id: 3, callFrame: { functionName: '(idle)', url: '', lineNumber: -1 } },
        { id: 4, callFrame: { functionName: '(garbage collector)', url: '', lineNumber: -1 } },
      ],
      samples: [2, 2, 3, 4, 2],
      timeDeltas: [0, 1_000, 2_000, 4_000, 500],
    });
    expect(spent.functions[0]).toEqual({ name: 'paint map/paint.ts:10', ms: 3 });
    expect(spent.idle).toBe(4);
    expect(spent.gc).toBe(0.5);
    expect(spent.busy).toBe(3.5);
    expect(spent.modules.map((module) => module.name)).toEqual(['map/paint.ts', '(garbage collector)']);
  });

  it('takes the middle of several loads by when they were ready', () => {
    const loads = [{ ready: 9 }, { ready: null }, { ready: 4 }, { ready: 6 }];
    expect(middleOf(loads)).toEqual({ ready: 6 });
    expect(middleOf([])).toBeNull();
  });
});
