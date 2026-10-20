import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { linkProgramAhead } from './webgl';

const COMPLETION = 0x91b1;
const LINK_STATUS = 0x8b82;

/** WebGL as far as linking uses it: the program says it is linked once asked `askedUntilDone` times. */
function fakeGl(options: { parallel: boolean; askedUntilDone?: number }) {
  const asked: number[] = [];
  const deleted: string[] = [];
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS,
    getExtension: (name: string) =>
      name === 'KHR_parallel_shader_compile' && options.parallel
        ? { COMPLETION_STATUS_KHR: COMPLETION }
        : null,
    createShader: (type: number) => ({ type }),
    shaderSource: () => undefined,
    compileShader: () => undefined,
    getShaderParameter: () => true,
    createProgram: () => ({}),
    attachShader: () => undefined,
    bindAttribLocation: () => undefined,
    linkProgram: () => undefined,
    getProgramParameter: (_program: unknown, which: number) => {
      asked.push(which);
      return (
        which === LINK_STATUS ||
        asked.filter((one) => one === COMPLETION).length >= (options.askedUntilDone ?? 1)
      );
    },
    getUniformLocation: (_program: unknown, name: string) => ({ name }),
    deleteProgram: () => deleted.push('program'),
    deleteShader: () => deleted.push('shader'),
    isContextLost: () => false,
  };
  return { gl: gl as unknown as WebGL2RenderingContext, asked, deleted };
}

describe('a program linked without the page waiting', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks only whether it is done until it is, then asks whether it linked and finds its uniforms', async () => {
    const fake = fakeGl({ parallel: true, askedUntilDone: 3 });
    let settled: unknown;
    void linkProgramAhead(fake.gl, 'v', 'f', ['uTime'], 'water').then((linked) => (settled = linked));
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBeUndefined();
    expect(fake.asked.every((which) => which === COMPLETION)).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toMatchObject({ where: { uTime: { name: 'uTime' } } });
    expect(fake.asked.at(-1)).toBe(LINK_STATUS);
    expect(fake.deleted).toEqual([]);
  });

  it('lets the program go when told to stop first', async () => {
    const fake = fakeGl({ parallel: true, askedUntilDone: 1000 });
    const stop = new AbortController();
    const linking = linkProgramAhead(fake.gl, 'v', 'f', ['uTime'], 'water', stop.signal);
    await vi.advanceTimersByTimeAsync(100);
    stop.abort();
    expect(await linking).toBeNull();
    expect(fake.deleted).toEqual(['program', 'shader', 'shader']);
    expect(fake.asked).not.toContain(LINK_STATUS);
  });

  it('links at once in a browser that cannot be asked without waiting, as before', async () => {
    const fake = fakeGl({ parallel: false });
    expect(await linkProgramAhead(fake.gl, 'v', 'f', ['uTime'], 'water')).toMatchObject({
      where: { uTime: { name: 'uTime' } },
    });
    expect(fake.asked).toEqual([LINK_STATUS]);
  });
});
