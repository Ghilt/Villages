import { hot } from './paintStrokes';
import type { Rgb } from './paintStrokes';
import type { Moment } from './strike';

/**
 * A moment of lightning drawn by a shader: every pixel lit by how near it is to each line of light - a hot core, a halo
 * falling off quickly and a long faint glow - and by each flash, the light added up and eased so it saturates to white
 * rather than clipping. The lines go to the card as a texture of segments, one column each: its two ends, its colour and
 * brightness, its thickness and which line it is of, so a pixel is lit by its nearest segment of each line and a line's
 * joints do not shine brighter than its runs.
 */

const VERTEX = `#version 300 es
in vec2 corner;
void main() { gl_Position = vec4(corner, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D segments;
uniform int count;
uniform sampler2D flashes;
uniform int flashCount;
uniform float height;
uniform float scale;
out vec4 colour;

float toSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 lit(float d, vec4 tint, vec4 shape) {
  float w = shape.x;
  float core = smoothstep(w, w * 0.25, d);
  float halo = exp(-d / (w * 2.4));
  float glow = 0.4 * (w * 3.0 / (d + w * 3.0)) * smoothstep(160.0, 0.0, d);
  return tint.a * (tint.rgb * (halo * 0.95 + glow) + vec3(shape.yzw) * core);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, height - gl_FragCoord.y) / scale;
  vec3 light = vec3(0.0);
  float nearest = 1e9;
  float line = -1.0;
  vec4 tint = vec4(0.0);
  vec4 shape = vec4(0.0);
  for (int at = 0; at < count; at++) {
    vec4 ends = texelFetch(segments, ivec2(at, 0), 0);
    vec4 itsTint = texelFetch(segments, ivec2(at, 1), 0);
    vec4 itsShape = texelFetch(segments, ivec2(at, 2), 0);
    float itsLine = texelFetch(segments, ivec2(at, 3), 0).x;
    if (itsLine != line) {
      if (line >= 0.0) light += lit(nearest, tint, shape);
      nearest = 1e9;
      line = itsLine;
      tint = itsTint;
      shape = itsShape;
    }
    nearest = min(nearest, toSegment(p, ends.xy, ends.zw));
  }
  if (line >= 0.0) light += lit(nearest, tint, shape);
  for (int at = 0; at < flashCount; at++) {
    vec4 flash = texelFetch(flashes, ivec2(at, 0), 0);
    vec3 itsColour = texelFetch(flashes, ivec2(at, 1), 0).rgb;
    float d = length(p - flash.xy) / flash.z;
    light += itsColour * flash.w * 0.6 * exp(-d * d * 3.0);
  }
  light = 1.0 - exp(-light * 1.4);
  colour = vec4(light, max(light.r, max(light.g, light.b)));
}`;

export interface ShaderPainter {
  readonly paint: (moments: readonly Moment[], colourOf: (colour: string) => Rgb, scale: number) => void;
  readonly dispose: () => void;
}

function compiled(gl: WebGL2RenderingContext, kind: number, source: string): WebGLShader | null {
  const shader = gl.createShader(kind);
  if (shader === null) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true ? shader : null;
}

function texture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const made = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, made);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return made;
}

/** A shader painting on `canvas`, or null where the browser has no WebGL 2. */
export function shaderPainter(canvas: HTMLCanvasElement): ShaderPainter | null {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true });
  if (gl === null) return null;
  const vertex = compiled(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compiled(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (vertex === null || fragment === null) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) return null;
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const segments = texture(gl);
  const flashes = texture(gl);
  const where = (name: string) => gl.getUniformLocation(program, name);
  const paint = (moments: readonly Moment[], colourOf: (colour: string) => Rgb, scale: number) => {
    const rows: number[][] = [[], [], [], []];
    let line = 0;
    for (const moment of moments) {
      for (const light of moment.lights) {
        if (light.bright <= 0) continue;
        const [r, g, b] = colourOf(light.colour);
        const [hr, hg, hb] = hot([r, g, b]);
        for (let at = 1; at < light.points.length; at += 1) {
          const from = light.points[at - 1]!;
          const to = light.points[at]!;
          rows[0]!.push(from.x, from.y, to.x, to.y);
          rows[1]!.push(r / 255, g / 255, b / 255, light.bright);
          rows[2]!.push(light.width * 0.9, hr / 255, hg / 255, hb / 255);
          rows[3]!.push(line, 0, 0, 0);
        }
        line += 1;
      }
    }
    const flashRows: number[][] = [[], []];
    for (const moment of moments) {
      for (const flash of moment.flashes) {
        const [r, g, b] = colourOf(flash.colour);
        flashRows[0]!.push(flash.at.x, flash.at.y, flash.reach, flash.bright);
        flashRows[1]!.push(r / 255, g / 255, b / 255, 0);
      }
    }
    const count = rows[0]!.length / 4;
    const flashCount = flashRows[0]!.length / 4;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (count === 0 && flashCount === 0) return;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, segments);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      Math.max(count, 1),
      4,
      0,
      gl.RGBA,
      gl.FLOAT,
      count > 0 ? new Float32Array(rows.flat()) : new Float32Array(16),
    );
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, flashes);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      Math.max(flashCount, 1),
      2,
      0,
      gl.RGBA,
      gl.FLOAT,
      flashCount > 0 ? new Float32Array(flashRows.flat()) : new Float32Array(8),
    );
    gl.uniform1i(where('segments'), 0);
    gl.uniform1i(where('flashes'), 1);
    gl.uniform1i(where('count'), count);
    gl.uniform1i(where('flashCount'), flashCount);
    gl.uniform1f(where('height'), canvas.height);
    gl.uniform1f(where('scale'), scale);
    const at = gl.getAttribLocation(program, 'corner');
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const dispose = () => {
    gl.deleteProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteBuffer(corners);
    gl.deleteTexture(segments);
    gl.deleteTexture(flashes);
  };
  return { paint, dispose };
}
