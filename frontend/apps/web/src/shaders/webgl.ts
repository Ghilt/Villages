import { whenLinked } from './compileAhead';

/**
 * The little WebGL the map's own shaders share, the water's and the relief's: a program linked and its uniforms
 * found, with the page waiting or not, and the one quad every tile is drawn as.
 */

/** A linked program, and where each of its uniforms is. */
export interface LinkedProgram<Name extends string = string> {
  program: WebGLProgram;
  where: Record<Name, WebGLUniformLocation | null>;
}

/**
 * A vertex and a fragment shader linked, with the quad's corners in attribute nought, and where each named
 * uniform is. A shader that will not compile or link throws, saying which shader it was, `what`. It waits on the
 * graphics driver until the program is linked: `linkProgramAhead` does not.
 */
export function linkProgram<Name extends string>(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
  uniforms: readonly Name[],
  what: string,
): LinkedProgram<Name> {
  return linked(gl, handedOver(gl, vertex, fragment), uniforms, what);
}

/**
 * The same, without the page waiting: the program is handed to the driver now, and settles once the browser says it
 * is linked, asked through `KHR_parallel_shader_compile` (`compileAhead.ts`), or as null when the context is lost
 * or `stop` is signalled first. A browser without the extension links it at once and waits, as `linkProgram` does.
 * The first visit's water waited 0.7 s on its program (experiment 0026).
 */
export async function linkProgramAhead<Name extends string>(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
  uniforms: readonly Name[],
  what: string,
  stop?: AbortSignal,
): Promise<LinkedProgram<Name> | null> {
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const linking = handedOver(gl, vertex, fragment);
  if (parallel !== null && !(await whenLinked(gl, parallel, linking.program, stop))) {
    gl.deleteProgram(linking.program);
    for (const shader of linking.shaders) gl.deleteShader(shader);
    return null;
  }
  return linked(gl, linking, uniforms, what);
}

/** A program's two shaders handed to the driver and the program linked from them, which goes on out of the page's way. */
function handedOver(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
): { program: WebGLProgram; shaders: WebGLShader[] } {
  const shaderOf = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const shaders = [shaderOf(gl.VERTEX_SHADER, vertex), shaderOf(gl.FRAGMENT_SHADER, fragment)];
  const program = gl.createProgram();
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  return { program, shaders };
}

/** A program handed over, once linked: whether it compiled and linked, which waits until it has, and its uniforms. */
function linked<Name extends string>(
  gl: WebGL2RenderingContext,
  { program, shaders }: { program: WebGLProgram; shaders: WebGLShader[] },
  uniforms: readonly Name[],
  what: string,
): LinkedProgram<Name> {
  for (const shader of shaders) {
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`${what} shader: ${gl.getShaderInfoLog(shader) ?? 'did not compile'}`);
    }
  }
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`${what} program: ${gl.getProgramInfoLog(program) ?? 'did not link'}`);
  }
  const where = {} as Record<Name, WebGLUniformLocation | null>;
  for (const name of uniforms) {
    where[name] = gl.getUniformLocation(program, name);
  }
  return { program, where };
}

/** The unit quad every tile is drawn as, a strip of four corners in attribute nought. */
export function unitQuad(gl: WebGL2RenderingContext): { vao: WebGLVertexArrayObject; buffer: WebGLBuffer } {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  return { vao, buffer };
}
