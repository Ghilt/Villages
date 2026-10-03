import { link } from './program';
import type { Program } from './program';

/**
 * The water at a part of the screen's size, for its low level: drawn into a picture of its own, a share of the
 * map's width and height, and then laid over the map in one stroke, stretched, so the fragment shaders run for a
 * quarter of the pixels at a half. The patterns are soft enough to stand the stretching.
 *
 * Whatever MapLibre was drawing into - its canvas, or a picture of its own - is asked for before and put back
 * after, with the part of it being drawn to, so the map goes on as if the water had been drawn straight onto it.
 */

const VERTEX = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uPicture;
out vec4 fragColor;
void main() {
  fragColor = texture(uPicture, vUv);
}
`;

export interface Picture {
  /** Draws into the picture from here on, at this share of the width and height being drawn to, cleared. */
  begin(gl: WebGL2RenderingContext, share: number): void;
  /** Goes back to what was being drawn to, and lays the picture over it with the unit quad. */
  end(gl: WebGL2RenderingContext, quad: WebGLVertexArrayObject): void;
  dispose(gl: WebGL2RenderingContext | null): void;
}

export function createPicture(gl: WebGL2RenderingContext): Picture {
  const laying: Program = link(gl, FRAGMENT, ['uPicture'], VERTEX);
  let texture: WebGLTexture | null = null;
  let framebuffer: WebGLFramebuffer | null = null;
  let size = { width: 0, height: 0 };
  let outer: WebGLFramebuffer | null = null;
  let viewport: Int32Array = new Int32Array(4);

  const make = (width: number, height: number) => {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    size = { width, height };
  };

  return {
    begin(context, share) {
      outer = context.getParameter(context.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
      viewport = context.getParameter(context.VIEWPORT) as Int32Array;
      const width = Math.max(1, Math.round(viewport[2]! * share));
      const height = Math.max(1, Math.round(viewport[3]! * share));
      if (width !== size.width || height !== size.height) {
        make(width, height);
      }
      context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
      context.viewport(0, 0, width, height);
      context.clearColor(0, 0, 0, 0);
      context.clear(context.COLOR_BUFFER_BIT);
    },

    end(context, quad) {
      context.bindFramebuffer(context.FRAMEBUFFER, outer);
      context.viewport(viewport[0]!, viewport[1]!, viewport[2]!, viewport[3]!);
      context.useProgram(laying.program);
      context.bindVertexArray(quad);
      context.enable(context.BLEND);
      context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);
      context.activeTexture(context.TEXTURE0);
      context.bindTexture(context.TEXTURE_2D, texture);
      context.uniform1i(laying.where.uPicture!, 0);
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4);
      context.bindVertexArray(null);
    },

    dispose(context) {
      context?.deleteTexture(texture);
      context?.deleteFramebuffer(framebuffer);
      context?.deleteProgram(laying.program);
    },
  };
}
