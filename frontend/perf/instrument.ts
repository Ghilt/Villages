/**
 * What the measuring hangs on every WebGL 2 context the page makes, before anything of the page runs: handed to
 * Playwright's `addInitScript` whole, so it may use nothing from outside itself.
 *
 * It takes the graphics card's timer for itself. The page's own meters (`shaders/costMeter.ts`) are told there is none,
 * so they say nothing and never hold a query of their own while one of these is open: only one may be at a time. It
 * follows which program each context is drawing with, by the name Pixi writes into every program it builds
 * (`#define SHADER_NAME land-fragment`), and for the map's context by the style layer MapLibre is drawing
 * (`painter.id`, which the tool names once the map exists). While recording, every run of draws under one name is timed
 * as one, and the times are handed back by frame. The wall clock is held too, so the clouds, the wind and the critters
 * stand where they stood the last time: they move by `Date.now()`, which is all that is held.
 */
export function instrument(): void {
  const TIME_ELAPSED = 0x88bf;
  const DISJOINT = 0x8fbb;
  const TIMER = 'EXT_disjoint_timer_query_webgl2';

  interface Run {
    key: string;
    query: WebGLQuery;
  }
  interface Context {
    gl: WebGL2RenderingContext;
    canvas: HTMLCanvasElement;
    name: string;
    timer: unknown;
    keyOf: (() => string | null) | null;
    current: string;
    run: Run | null;
  }
  interface Timed {
    context: Context;
    key: string;
    query: WebGLQuery;
    frame: number;
  }

  const contexts: Context[] = [];
  const sources = new WeakMap<WebGLShader, string>();
  const attached = new WeakMap<WebGLProgram, WebGLShader[]>();
  const names = new WeakMap<WebGLProgram, string>();
  let recording: 'off' | 'attributed' | 'whole' = 'off';
  let frame = 0;
  let pending: Timed[] = [];
  let counted: Map<string, number> | null = null;

  const RealDate = Date;
  let heldAt = RealDate.now();
  let heldFrom = performance.now();
  const now = (): number => heldAt + (performance.now() - heldFrom);
  class HeldDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now());
      else super(...(args as [number]));
    }
    static override now(): number {
      return now();
    }
  }
  (globalThis as { Date: DateConstructor }).Date = HeldDate as unknown as DateConstructor;

  const hash = (text: string): string => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
  };

  const programName = (gl: WebGL2RenderingContext, program: WebGLProgram): string => {
    const fragment = (attached.get(program) ?? []).find(
      (shader) => gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER,
    );
    const source = fragment === undefined ? '' : (sources.get(fragment) ?? '');
    const named = /#define SHADER_NAME (\S+)/.exec(source)?.[1]?.replace(/-(fragment|vertex)(-\d+)?$/, '');
    // Pixi names every program it is not told a name for `pixi-program`: those are told apart by what they draw.
    return named === undefined || named === 'pixi-program' ? `${named ?? 'program'}#${hash(source)}` : named;
  };

  const end = (context: Context): void => {
    if (context.run === null) return;
    context.gl.endQuery(TIME_ELAPSED);
    pending.push({ context, key: context.run.key, query: context.run.query, frame });
    context.run = null;
  };

  const before = (context: Context, kind: 'draw' | 'clear'): void => {
    const named = kind === 'clear' ? 'clear' : (context.keyOf?.() ?? context.current);
    if (counted !== null) {
      const key = `${context.name}:${named}`;
      counted.set(key, (counted.get(key) ?? 0) + 1);
    }
    if (recording === 'off' || context.timer === null) return;
    const key = recording === 'whole' ? `${context.name}:whole` : `${context.name}:${named}`;
    if (context.run?.key === key) return;
    end(context);
    const query = context.gl.createQuery();
    context.gl.beginQuery(TIME_ELAPSED, query);
    context.run = { key, query };
  };

  const adopt = (gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void => {
    const context: Context = {
      gl,
      canvas,
      name: `gl${contexts.length}`,
      timer: gl.getExtension(TIMER),
      keyOf: null,
      current: 'none',
      run: null,
    };
    contexts.push(context);
    const getExtension = gl.getExtension.bind(gl);
    const getSupportedExtensions = gl.getSupportedExtensions.bind(gl);
    const shaderSource = gl.shaderSource.bind(gl);
    const attachShader = gl.attachShader.bind(gl);
    const linkProgram = gl.linkProgram.bind(gl);
    const useProgram = gl.useProgram.bind(gl);
    const clear = gl.clear.bind(gl);
    Object.assign(gl, {
      getExtension: (name: string) => (name === TIMER ? null : getExtension(name)),
      getSupportedExtensions: () => (getSupportedExtensions() ?? []).filter((name) => name !== TIMER),
      shaderSource: (shader: WebGLShader, source: string) => {
        sources.set(shader, source);
        shaderSource(shader, source);
      },
      attachShader: (program: WebGLProgram, shader: WebGLShader) => {
        attached.set(program, [...(attached.get(program) ?? []), shader]);
        attachShader(program, shader);
      },
      linkProgram: (program: WebGLProgram) => {
        linkProgram(program);
        names.set(program, programName(gl, program));
      },
      useProgram: (program: WebGLProgram | null) => {
        context.current = program === null ? 'none' : (names.get(program) ?? 'unnamed');
        useProgram(program);
      },
      clear: (mask: number) => {
        before(context, 'clear');
        clear(mask);
      },
    });
    for (const draw of [
      'drawArrays',
      'drawElements',
      'drawArraysInstanced',
      'drawElementsInstanced',
      'drawRangeElements',
    ] as const) {
      const real = (gl[draw] as (...args: unknown[]) => void).bind(gl);
      (gl as unknown as Record<string, unknown>)[draw] = (...args: unknown[]) => {
        before(context, 'draw');
        real(...args);
      };
    }
  };

  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: unknown[]
  ) {
    const made = (getContext as (...args: unknown[]) => unknown).call(this, type, ...rest);
    if (type === 'webgl2' && made !== null && !contexts.some((context) => context.gl === made)) {
      adopt(made as WebGL2RenderingContext, this);
    }
    return made;
  } as typeof getContext;

  const perf = {
    /** The contexts the page has made, by name, with their canvases' sizes and whether each has the timer. */
    contexts: () =>
      contexts.map((context) => ({
        name: context.name,
        width: context.canvas.width,
        height: context.canvas.height,
        timer: context.timer !== null,
        shown: context.canvas.isConnected,
      })),
    /** Names a context, the one whose GL is `gl`, and how a draw on it is named when not by its program. */
    name: (gl: unknown, name: string, keyOf: (() => string | null) | null): boolean => {
      const context = contexts.find((each) => each.gl === gl);
      if (context === undefined) return false;
      context.name = name;
      context.keyOf = keyOf;
      return true;
    },
    /**
     * Names every context on the page the map's is not, the sprite canvas Pixi draws in: those on canvases the page
     * shows, because a library tries a context or two on canvases it never shows to learn what the card can do.
     */
    nameRest: (name: string): void => {
      contexts
        .filter((context) => /^gl\d+$/.test(context.name) && context.canvas.isConnected)
        .forEach((context, i) => {
          context.name =
            i === 0 && !contexts.some((each) => each.name === name)
              ? name
              : `${name}${contexts.indexOf(context)}`;
        });
    },
    /** Holds the wall clock at a moment, from now on. */
    holdClock: (at: number): void => {
      heldAt = at;
      heldFrom = performance.now();
    },
    record: (how: 'off' | 'attributed' | 'whole'): void => {
      recording = how;
    },
    /** A frame begins: what is timed from here is this frame's, by the number handed back. */
    startFrame: (): number => {
      frame += 1;
      return frame;
    },
    /** A frame ends: every run still open is closed. */
    endFrame: (): void => {
      contexts.forEach(end);
    },
    /** Counts draws by name, from now until `counts` is asked. */
    count: (): void => {
      counted = new Map();
    },
    counts: (): Record<string, number> => {
      const said = Object.fromEntries(counted ?? []);
      counted = null;
      return said;
    },
    /**
     * The times recorded since the last ask, in milliseconds by frame and name, once the card has answered for all;
     * and how many runs each name was timed in, each its own query, which costs a little of its own.
     */
    collect: async (): Promise<{
      frames: Record<string, Record<string, number>>;
      runs: Record<string, Record<string, number>>;
      disjoint: boolean;
      lost: number;
    }> => {
      const asked = pending;
      pending = [];
      const giveUp = performance.now() + 5_000;
      const ready = (each: Timed) =>
        each.context.gl.getQueryParameter(each.query, each.context.gl.QUERY_RESULT_AVAILABLE) as boolean;
      while (!asked.every(ready) && performance.now() < giveUp) {
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      const disjoint = contexts.some(
        (context) => context.timer !== null && (context.gl.getParameter(DISJOINT) as boolean),
      );
      const frames: Record<string, Record<string, number>> = {};
      const runs: Record<string, Record<string, number>> = {};
      let lost = 0;
      for (const each of asked) {
        const { gl } = each.context;
        if (!ready(each)) {
          lost += 1;
        } else {
          const ms = (gl.getQueryParameter(each.query, gl.QUERY_RESULT) as number) / 1e6;
          const times = (frames[each.frame] ??= {});
          times[each.key] = (times[each.key] ?? 0) + ms;
          const counted = (runs[each.frame] ??= {});
          counted[each.key] = (counted[each.key] ?? 0) + 1;
        }
        gl.deleteQuery(each.query);
      }
      return { frames, runs, disjoint, lost };
    },
  };
  (globalThis as unknown as { __perf: typeof perf }).__perf = perf;
}

/** What `instrument` hangs on the page, as the tool sees it. */
export interface Perf {
  contexts(): { name: string; width: number; height: number; timer: boolean; shown: boolean }[];
  name(gl: unknown, name: string, keyOf: (() => string | null) | null): boolean;
  nameRest(name: string): void;
  holdClock(at: number): void;
  record(how: 'off' | 'attributed' | 'whole'): void;
  startFrame(): number;
  endFrame(): void;
  count(): void;
  counts(): Record<string, number>;
  collect(): Promise<{
    frames: Record<string, Record<string, number>>;
    runs: Record<string, Record<string, number>>;
    disjoint: boolean;
    lost: number;
  }>;
}
