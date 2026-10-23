/**
 * A program compiled ahead of its first use, so that the page never waits on the graphics driver for it. Pixi links
 * a program the first time it draws with it and asks at once whether it linked, which holds the page until the
 * driver is done; the land's motions take from a fraction of a second to five (experiment 0025). Here the same
 * sources are handed to the driver early and asked after through `KHR_parallel_shader_compile`, which answers
 * without waiting while the browser compiles out of the page's way. Chrome keeps a program it has linked, so Pixi's
 * own link of the same sources later finds it there and costs milliseconds.
 *
 * A browser without the extension cannot be asked without waiting, so it is told at once that it cannot compile
 * ahead, and its first use waits on the driver as it always did.
 */

/** The sources a program is linked from, exactly as its first use will hand them over: Pixi's `GlProgram` has them. */
export interface ProgramSources {
  readonly vertex: string;
  readonly fragment: string;
}

/** How often the browser is asked whether the program is compiled, in milliseconds. */
const ASKED_EVERY = 50;

/**
 * Hands a program's sources to the driver now. Settles with the milliseconds from now until it was compiled, or with
 * null when this browser cannot compile ahead, the context is lost, or `stop` is signalled first.
 */
export async function compileAhead(
  gl: WebGL2RenderingContext | null | undefined,
  sources: ProgramSources,
  stop?: AbortSignal,
): Promise<number | null> {
  const parallel = gl?.getExtension('KHR_parallel_shader_compile') ?? null;
  if (gl === null || gl === undefined || parallel === null || stop?.aborted === true) {
    return null;
  }
  const began = performance.now();
  const shaders = [
    shaderOf(gl, gl.VERTEX_SHADER, sources.vertex),
    shaderOf(gl, gl.FRAGMENT_SHADER, sources.fragment),
  ];
  const program = gl.createProgram();
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  const linked = await whenLinked(gl, parallel, program, stop);
  // Let go once compiled: Chrome keeps what it linked, and this copy is never drawn with.
  gl.deleteProgram(program);
  for (const shader of shaders) gl.deleteShader(shader);
  return linked ? performance.now() - began : null;
}

/**
 * Settles true once the browser says a program handed to it is linked, asking without waiting; false when the context
 * is lost or `stop` is signalled first. For a context the extension was asked of, which `parallel` is.
 */
export function whenLinked(
  gl: WebGL2RenderingContext,
  parallel: KHR_parallel_shader_compile,
  program: WebGLProgram,
  stop?: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    let asking: ReturnType<typeof setTimeout> | undefined;
    const end = (linked: boolean) => {
      clearTimeout(asking);
      stop?.removeEventListener('abort', stopped);
      resolve(linked);
    };
    const stopped = () => end(false);
    const ask = () => {
      if (gl.isContextLost()) {
        end(false);
      } else if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) === true) {
        end(true);
      } else {
        asking = setTimeout(ask, ASKED_EVERY);
      }
    };
    if (stop?.aborted === true) {
      end(false);
      return;
    }
    stop?.addEventListener('abort', stopped);
    asking = setTimeout(ask, ASKED_EVERY);
  });
}

function shaderOf(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/** A layer's programs compiled ahead: handed to the driver when `begin` is first called, and `ready` once compiled. */
export interface ProgramsAhead {
  /** Hands the programs to the driver now, if they have not been already. */
  begin(): void;
  /** Whether they are compiled, or this browser cannot compile ahead and its first use will wait as it always did. */
  ready(): boolean;
  stop(): void;
}

/**
 * The programs of a layer that draws only once the driver has compiled them, as the land's and the clouds' are:
 * `begin` once the game has started, so as not to slow the start, or the first time the layer is wanted if that is
 * sooner. `said` is told the milliseconds the slowest of them took, or null where this browser cannot compile ahead;
 * `repaint` asks for the frame that draws them. Pixi keeps a program's sources, preprocessed, until it is destroyed.
 */
export function programsAhead(
  gl: WebGL2RenderingContext | null | undefined,
  programs: readonly { readonly glProgram: { readonly vertex?: string; readonly fragment?: string } }[],
  said: (ms: number | null) => void,
  repaint: () => void,
): ProgramsAhead {
  const stopping = new AbortController();
  let begun = false;
  let compiled = false;
  return {
    begin(): void {
      if (begun || stopping.signal.aborted) return;
      begun = true;
      void Promise.all(
        programs.map(({ glProgram: { vertex, fragment } }) =>
          compileAhead(gl, { vertex: vertex!, fragment: fragment! }, stopping.signal),
        ),
      ).then((times) => {
        if (stopping.signal.aborted) return;
        compiled = true;
        said(times.some((ms) => ms === null) ? null : Math.max(...(times as number[])));
        repaint();
      });
    },
    ready: () => compiled,
    stop: () => stopping.abort(),
  };
}
