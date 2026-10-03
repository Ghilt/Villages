import type * as maplibregl from 'maplibre-gl';

import { VERTEX } from './glsl';

/**
 * The water's own WebGL, the little of it there is: a program linked and its uniforms found, a texture
 * made from bytes, the one quad every tile is drawn with, and the state a draw starts from.
 *
 * MapLibre resets its own GL state after a custom layer draws, so a draw sets everything it needs; and a texture
 * is made only inside `render`, never from a callback, because that would change a binding MapLibre thinks it
 * knows.
 */

/** A linked program, and where each of its uniforms is. */
export interface Program {
  program: WebGLProgram;
  where: Record<string, WebGLUniformLocation | null>;
}

export const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** How much of each size of a pattern to draw, by how big it is on the screen against its size band. */
export function weightsOf(
  first: number,
  step: number,
  sizes: number,
  band: readonly number[],
  scale: number,
) {
  const [fadeIn, whole, fading, gone] = band as [number, number, number, number];
  const weights = new Float32Array(sizes);
  for (let size = 0; size < sizes; size += 1) {
    const onScreen = first * step ** size * scale;
    weights[size] = smoothstep(fadeIn, whole, onScreen) * (1 - smoothstep(fading, gone, onScreen));
  }
  return weights;
}

/**
 * A fragment shader with the water's vertex shader, or another, and where the uniforms every water shader has are,
 * besides its own.
 */
export function link(
  gl: WebGL2RenderingContext,
  fragment: string,
  uniforms: readonly string[],
  vertex = VERTEX,
): Program {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`water shader: ${gl.getShaderInfoLog(shader) ?? 'did not compile'}`);
    }
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`water program: ${gl.getProgramInfoLog(program) ?? 'did not link'}`);
  }
  const where: Record<string, WebGLUniformLocation | null> = {};
  for (const name of ['uMatrix', 'uTile', 'uTexRect', 'uMask', 'uTime', 'uScale', 'uFade', ...uniforms]) {
    where[name] = gl.getUniformLocation(program, name);
  }
  return { program, where };
}

/** A texture of RGBA bytes so many texels a side, filtered, and clamped at its edges. */
export function textureOf(gl: WebGL2RenderingContext, data: Uint8Array, side: number): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, side, side, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/** The unit quad every tile is drawn as, a strip of four corners in attribute nought. */
export function quadOf(gl: WebGL2RenderingContext): { vao: WebGLVertexArrayObject; buffer: WebGLBuffer } {
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

/** What every draw of the water starts from, whichever program it is. */
export interface DrawStart {
  vao: WebGLVertexArrayObject;
  matrix: maplibregl.ProjectionMatrix;
  /** Seconds, coming round every hour so the shaders' floats keep their precision. */
  time: number;
  /** Screen pixels a world unit. */
  scale: number;
}

/** Starts a draw with a program, setting all of the state it needs: premultiplied blending, no depth. */
export function begin(gl: WebGL2RenderingContext, { program, where }: Program, start: DrawStart): void {
  gl.useProgram(program);
  gl.bindVertexArray(start.vao);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.STENCIL_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniformMatrix4fv(where.uMatrix!, false, start.matrix);
  gl.uniform1f(where.uTime!, start.time);
  gl.uniform1f(where.uScale!, start.scale);
}
