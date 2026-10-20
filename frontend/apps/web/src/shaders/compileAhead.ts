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
export function compileAhead(
  gl: WebGL2RenderingContext | null | undefined,
  sources: ProgramSources,
  stop?: AbortSignal,
): Promise<number | null> {
  const parallel = gl?.getExtension('KHR_parallel_shader_compile') ?? null;
  if (gl === null || gl === undefined || parallel === null || stop?.aborted === true) {
    return Promise.resolve(null);
  }
  const began = performance.now();
  const shaders = [
    shaderOf(gl, gl.VERTEX_SHADER, sources.vertex),
    shaderOf(gl, gl.FRAGMENT_SHADER, sources.fragment),
  ];
  const program = gl.createProgram();
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  // Deleted once compiled: Chrome keeps what it linked, and this copy is never drawn with.
  const letGo = () => {
    gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
  };
  return new Promise((resolve) => {
    let asking: ReturnType<typeof setTimeout> | undefined;
    const end = (ms: number | null) => {
      clearTimeout(asking);
      stop?.removeEventListener('abort', stopped);
      letGo();
      resolve(ms);
    };
    const stopped = () => end(null);
    const ask = () => {
      if (gl.isContextLost()) {
        end(null);
      } else if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) === true) {
        end(performance.now() - began);
      } else {
        asking = setTimeout(ask, ASKED_EVERY);
      }
    };
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
