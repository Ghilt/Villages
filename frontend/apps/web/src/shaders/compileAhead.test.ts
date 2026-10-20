import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { compileAhead } from './compileAhead';

const COMPLETION = 0x91b1;

/** WebGL as far as compiling ahead uses it: the program says it is compiled once asked `askedUntilDone` times. */
function fakeGl(options: { parallel: boolean; askedUntilDone?: number }) {
  const sources: string[] = [];
  const deleted: string[] = [];
  let asked = 0;
  let lost = false;
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    getExtension: (name: string) =>
      name === 'KHR_parallel_shader_compile' && options.parallel
        ? { COMPLETION_STATUS_KHR: COMPLETION }
        : null,
    createShader: (type: number) => ({ type }),
    shaderSource: (_shader: unknown, source: string) => sources.push(source),
    compileShader: () => undefined,
    createProgram: () => ({}),
    attachShader: () => undefined,
    linkProgram: () => undefined,
    getProgramParameter: (_program: unknown, which: number) => {
      if (which !== COMPLETION) throw new Error('asked something that waits on the driver');
      asked += 1;
      return asked >= (options.askedUntilDone ?? 1);
    },
    deleteProgram: () => deleted.push('program'),
    deleteShader: () => deleted.push('shader'),
    isContextLost: () => lost,
  };
  return {
    gl: gl as unknown as WebGL2RenderingContext,
    sources,
    deleted,
    asked: () => asked,
    lose: () => (lost = true),
  };
}

const SOURCES = { vertex: 'the vertex', fragment: 'the fragment' };

describe('compiling a program ahead of its first use', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hands the driver the sources the first use will, and settles once the browser says it is compiled', async () => {
    const fake = fakeGl({ parallel: true, askedUntilDone: 3 });
    let settled: number | null | undefined;
    void compileAhead(fake.gl, SOURCES).then((ms) => (settled = ms));
    expect(fake.sources).toEqual(['the vertex', 'the fragment']);
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(100);
    expect(typeof settled).toBe('number');
    expect(fake.asked()).toBe(3);
    expect(fake.deleted).toEqual(['program', 'shader', 'shader']);
  });

  it('says at once that a browser without the extension cannot, and hands the driver nothing', async () => {
    const fake = fakeGl({ parallel: false });
    expect(await compileAhead(fake.gl, SOURCES)).toBeNull();
    await expect(compileAhead(undefined, SOURCES)).resolves.toBeNull();
    expect(fake.sources).toEqual([]);
  });

  it('stops asking when told to, or when the context is lost, and lets the program go', async () => {
    const stopped = fakeGl({ parallel: true, askedUntilDone: 1000 });
    const stop = new AbortController();
    const asking = compileAhead(stopped.gl, SOURCES, stop.signal);
    await vi.advanceTimersByTimeAsync(200);
    stop.abort();
    expect(await asking).toBeNull();
    const asked = stopped.asked();
    await vi.advanceTimersByTimeAsync(1000);
    expect(stopped.asked()).toBe(asked);
    expect(stopped.deleted).toEqual(['program', 'shader', 'shader']);

    const lost = fakeGl({ parallel: true, askedUntilDone: 1000 });
    const losing = compileAhead(lost.gl, SOURCES);
    lost.lose();
    await vi.advanceTimersByTimeAsync(100);
    expect(await losing).toBeNull();
  });
});
