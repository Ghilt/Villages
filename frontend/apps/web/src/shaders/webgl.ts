/**
 * The little WebGL the map's own shaders share, the water's and the relief's: a program linked and its uniforms
 * found, and the one quad every tile is drawn as.
 */

/** A linked program, and where each of its uniforms is. */
export interface LinkedProgram<Name extends string = string> {
  program: WebGLProgram;
  where: Record<Name, WebGLUniformLocation | null>;
}

/**
 * A vertex and a fragment shader linked, with the quad's corners in attribute nought, and where each named
 * uniform is. A shader that will not compile or link throws, saying which shader it was, `what`.
 */
export function linkProgram<Name extends string>(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string,
  uniforms: readonly Name[],
  what: string,
): LinkedProgram<Name> {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`${what} shader: ${gl.getShaderInfoLog(shader) ?? 'did not compile'}`);
    }
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
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
