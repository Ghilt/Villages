import { note } from '../debug/log';
import { WORLD_MASTER_WIDTH } from '../map/worldStyle';
import { groundTilt, pixelsPerWorldUnit, toMercatorExact } from '../sprites/cameraMath';
import type { CameraSource } from '../sprites/SpriteRenderer';

import { REACH } from './fogField';
import type { FogField } from './fogField';

/**
 * The fog of war, drawn: one canvas lying over the map and the sprites alike, so the trees and the castles
 * are under it as well as the ground.
 *
 * It follows the map's camera the way the sprites do, drawing when the map has drawn and reading the camera
 * the map just used, and it asks the same projection they ask - `groundTilt`, `pixelsPerWorldUnit` and the
 * Mercator centre - backwards, pixel by pixel, to find which piece of ground each pixel of the screen lies
 * on. A tipped camera is parallel, so that is a turn, an unsquash and a scale, and the fog lies on its own
 * ground at every tilt and zoom as a castle stands on its own. See decision records 0060 and 0061.
 *
 * What it reads for that piece of ground is the distance field, which is worked out once for each change
 * to the house's vision points; nothing about the fog is recomputed while the camera moves except this.
 */

/** What the fog should draw: nothing at all, or the fog of a house, whose field is null when it sees nothing. */
export type FogToDraw = { field: FogField | null } | null;

/** One triangle that covers the whole canvas, so the fragment shader runs once for every pixel. */
const COVER = new Float32Array([-1, -1, 3, -1, -1, 3]);

const VERTEX = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}
`;

/*
 * The colours and how see-through each is are Adam's to judge by eye; these are the first guess. The haze
 * is dark and lets the coast through. The wash is a middling grey at half strength, which takes colour out
 * of whatever it lies on, pale ground or dark: the parchment of the interface was tried first and all but
 * vanished over farmland, which is pale already. It stands in for the colour being taken out properly.
 */
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 halfSize;
uniform vec2 pixelRatio;
uniform float bufferHeight;
uniform vec2 centre;
uniform float scale;
uniform vec3 tilt;
uniform float worldSide;
uniform sampler2D field;
uniform vec2 fieldOrigin;
uniform vec2 fieldSize;
uniform float hasField;
uniform float reach;

out vec4 colour;

const vec3 HAZE = vec3(0.105, 0.098, 0.125);
const float HAZE_ALPHA = 0.62;
const vec3 WASH = vec3(0.62, 0.61, 0.60);
const float WASH_ALPHA = 0.5;

float hash(ivec2 cell) {
  uvec2 u = uvec2(cell) * uvec2(1597334673u, 3812015801u);
  uint n = (u.x ^ u.y) * 1597334673u;
  return float(n) / 4294967296.0;
}

float noise(vec2 at) {
  vec2 whole = floor(at);
  vec2 part = at - whole;
  vec2 w = part * part * (3.0 - 2.0 * part);
  ivec2 cell = ivec2(whole);
  float a = hash(cell);
  float b = hash(cell + ivec2(1, 0));
  float c = hash(cell + ivec2(0, 1));
  float d = hash(cell + ivec2(1, 1));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

// How much of a pattern whose features are this many world units across is worth drawing at this zoom:
// all of it once they are a dozen pixels and more, none once they are down to a few, so nothing far out
// sparkles as the camera moves.
float worth(float units) {
  return clamp((units * scale - 4.0) / 12.0, 0.0, 1.0);
}

void main() {
  vec2 onScreen = vec2(gl_FragCoord.x, bufferHeight - gl_FragCoord.y) / pixelRatio - halfSize;
  float along = onScreen.y / max(tilt.z, 0.0001);
  vec2 ground = vec2(onScreen.x * tilt.x - along * tilt.y, onScreen.x * tilt.y + along * tilt.x);
  vec2 world = centre + ground / scale;
  if (world.x < 0.0 || world.y < 0.0 || world.x > worldSide || world.y > worldSide) {
    colour = vec4(0.0);
    return;
  }

  vec2 away = vec2(reach);
  if (hasField > 0.5) {
    away = texture(field, (world - fieldOrigin) / fieldSize).rg;
  }

  // The edge wanders a little, so that a circle reads as the limit of what can be seen rather than as a
  // line drawn with compasses, and it is soft by a world unit and a half close in and a pixel far out.
  float wander = (noise(world / 9.0) - 0.5) * 2.4 * worth(9.0) + (noise(world / 3.0) - 0.5) * 0.8 * worth(3.0);
  float soft = max(1.5, 1.2 / scale);
  float revealed = 1.0 - smoothstep(-soft, soft, away.r + wander);
  float vision = 1.0 - smoothstep(-soft, soft, away.g + wander);

  // A haze rather than a flat grey: it thickens and thins a little, in patches a couple of dozen units
  // across, and goes flat far out where the patches would be smaller than a few pixels.
  float cloud = mix(1.0, 0.8 + 0.4 * noise(world / 24.0), worth(24.0));
  float haze = HAZE_ALPHA * (1.0 - revealed) * cloud;
  float wash = WASH_ALPHA * revealed * (1.0 - vision);
  colour = vec4(HAZE * haze + WASH * wash, haze + wash);
}
`;

const UNIFORMS = [
  'halfSize',
  'pixelRatio',
  'bufferHeight',
  'centre',
  'scale',
  'tilt',
  'worldSide',
  'field',
  'fieldOrigin',
  'fieldSize',
  'hasField',
  'reach',
] as const;

type Uniform = (typeof UNIFORMS)[number];

/** What the development probe reports, for a console and for checking a hidden pane. */
export interface FogReport {
  drawing: 'nothing' | 'everything unknown' | 'a field';
  field: { originX: number; originY: number; width: number; height: number; unitsPerTexel: number } | null;
  draws: number;
  canvas: { width: number; height: number } | null;
}

function compile(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader {
  const shader = gl.createShader(kind);
  if (shader === null) {
    throw new Error('no shader could be made');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'the fog shader did not compile');
  }
  return shader;
}

export function createFogRenderer(camera: CameraSource) {
  let canvas: HTMLCanvasElement | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let uniforms: Partial<Record<Uniform, WebGLUniformLocation | null>> = {};
  let unwatch: (() => void) | null = null;
  let toDraw: FogToDraw = null;
  let uploaded: FogField | null = null;
  let draws = 0;
  let disposed = false;

  function prepare(context: WebGL2RenderingContext): void {
    const built = context.createProgram();
    context.attachShader(built, compile(context, context.VERTEX_SHADER, VERTEX));
    context.attachShader(built, compile(context, context.FRAGMENT_SHADER, FRAGMENT));
    context.bindAttribLocation(built, 0, 'corner');
    context.linkProgram(built);
    if (!context.getProgramParameter(built, context.LINK_STATUS)) {
      throw new Error(context.getProgramInfoLog(built) ?? 'the fog shader did not link');
    }
    program = built;
    uniforms = Object.fromEntries(UNIFORMS.map((name) => [name, context.getUniformLocation(built, name)]));

    const cover = context.createVertexArray();
    context.bindVertexArray(cover);
    const buffer = context.createBuffer();
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, COVER, context.STATIC_DRAW);
    context.enableVertexAttribArray(0);
    context.vertexAttribPointer(0, 2, context.FLOAT, false, 0, 0);

    texture = context.createTexture();
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  }

  /** Hands the field to the graphics card, once for each change to it. Half floats, which filter. */
  function upload(context: WebGL2RenderingContext, field: FogField): void {
    context.bindTexture(context.TEXTURE_2D, texture);
    context.pixelStorei(context.UNPACK_ALIGNMENT, 1);
    context.texImage2D(
      context.TEXTURE_2D,
      0,
      context.RG16F,
      field.width,
      field.height,
      0,
      context.RG,
      context.FLOAT,
      field.distances,
    );
    uploaded = field;
  }

  function draw(): void {
    if (canvas === null || gl === null || program === null || disposed) {
      return;
    }
    const { width, height } = camera.size();
    if (width === 0 || height === 0) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const bufferWidth = Math.max(1, Math.round(width * ratio));
    const bufferHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    gl.viewport(0, 0, bufferWidth, bufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (toDraw === null) {
      return;
    }

    const field = toDraw.field;
    if (field !== null && field !== uploaded) {
      upload(gl, field);
    }
    const centre = toMercatorExact(camera.center());
    const tilt = groundTilt({ pitch: camera.pitch(), bearing: camera.bearing() });

    gl.useProgram(program);
    gl.uniform2f(uniforms.halfSize ?? null, width / 2, height / 2);
    gl.uniform2f(uniforms.pixelRatio ?? null, bufferWidth / width, bufferHeight / height);
    gl.uniform1f(uniforms.bufferHeight ?? null, bufferHeight);
    gl.uniform2f(uniforms.centre ?? null, centre.x * WORLD_MASTER_WIDTH, centre.y * WORLD_MASTER_WIDTH);
    gl.uniform1f(uniforms.scale ?? null, pixelsPerWorldUnit(camera.zoom()));
    gl.uniform3f(uniforms.tilt ?? null, tilt.cos, tilt.sin, tilt.lean);
    gl.uniform1f(uniforms.worldSide ?? null, WORLD_MASTER_WIDTH);
    gl.uniform1f(uniforms.reach ?? null, REACH);
    gl.uniform1f(uniforms.hasField ?? null, field === null ? 0 : 1);
    if (field !== null) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.field ?? null, 0);
      gl.uniform2f(uniforms.fieldOrigin ?? null, field.originX, field.originY);
      gl.uniform2f(
        uniforms.fieldSize ?? null,
        field.width * field.unitsPerTexel,
        field.height * field.unitsPerTexel,
      );
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    draws += 1;
  }

  function report(): FogReport {
    const field = toDraw?.field ?? null;
    return {
      drawing: toDraw === null ? 'nothing' : field === null ? 'everything unknown' : 'a field',
      field:
        field === null
          ? null
          : {
              originX: Math.round(field.originX),
              originY: Math.round(field.originY),
              width: field.width,
              height: field.height,
              unitsPerTexel: field.unitsPerTexel,
            },
      draws,
      canvas: canvas === null ? null : { width: canvas.width, height: canvas.height },
    };
  }

  return {
    mount(container: HTMLElement): void {
      canvas = document.createElement('canvas');
      container.appendChild(canvas);
      const context = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
      });
      if (context === null) {
        note('fog', 'no WebGL2 for the fog of war, so it is not drawn');
        return;
      }
      try {
        prepare(context);
      } catch (cause) {
        note('fog', `the fog of war could not be drawn: ${(cause as Error).message}`);
        return;
      }
      gl = context;
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        gl = null;
        // Letting go of it on purpose, as `destroy` does, is not news; the browser taking it away is.
        if (!disposed) {
          note('fog', 'the fog lost its graphics context; a reload draws it again');
        }
      });
      unwatch = camera.watch(draw);
      draw();
      if (import.meta.env.DEV) {
        (window as unknown as { villagesFog?: () => FogReport }).villagesFog = report;
      }
    },

    /** What to draw from now on. Drawn at once, because the map may be standing still. */
    show(next: FogToDraw): void {
      toDraw = next;
      draw();
    },

    destroy(): void {
      disposed = true;
      unwatch?.();
      unwatch = null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      gl = null;
      canvas?.remove();
      canvas = null;
    },
  };
}
