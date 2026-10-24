import './lightning.css';

import { useEffect, useRef } from 'react';

import { shaderPainter } from './paintShader';
import type { ShaderPainter } from './paintShader';
import { paintStrokes } from './paintStrokes';
import type { Rgb } from './paintStrokes';
import { LIFE, momentOf } from './strike';
import type { Look, Strike } from './strike';

export type { Box } from './bolt';
export type { Look, Strike } from './strike';

/** How lightning is drawn: as strokes on a canvas, or by a shader lighting every pixel by how near it is to a bolt. */
export type Glow = 'strokes' | 'shader';

const BLACK: Rgb = [0, 0, 0];

/** A CSS colour as red, green and blue, a custom property's read off `element`: what a canvas or a shader is given. */
function colourReader(element: HTMLElement): (colour: string) => Rgb {
  const known = new Map<string, Rgb>();
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  return (colour) => {
    const kept = known.get(colour);
    if (kept !== undefined) return kept;
    const named = /^var\((--[\w-]+)\)$/.exec(colour.trim());
    const css = named === null ? colour : getComputedStyle(element).getPropertyValue(named[1]!).trim();
    if (probe === null) return BLACK;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
    const rgb: Rgb = [r, g, b];
    known.set(colour, rgb);
    return rgb;
  };
}

/** A strike where its box is now: where it follows it to, if it follows one. */
function placed(strike: Strike): Strike {
  const to = strike.follow?.() ?? null;
  return to === null ? strike : { ...strike, to };
}

/**
 * Lightning over whatever box it is laid in: each strike arching through the air from its source to its box and
 * crackling round it, in its look, drawn as strokes or by a shader; a box that moves or grows is followed. A strike runs once when it first comes, and again
 * whenever its key changes, for a second; while none is running nothing is drawn and nothing ticks. Given `at`, every
 * strike is held at that many milliseconds, for the components page. Places are in the box's own pixels. Lets the
 * pointer through. See docs/UI-COMPONENTS.md and decision record 0116.
 */
export function Lightning({
  strikes,
  look = 'leader',
  glow = 'strokes',
  at,
}: {
  strikes: readonly Strike[];
  look?: Look;
  glow?: Glow;
  at?: number;
}) {
  return <LightningCanvas key={glow} strikes={strikes} look={look} glow={glow} at={at} />;
}

interface Painter {
  readonly colourOf: (colour: string) => Rgb;
  readonly context: CanvasRenderingContext2D | null;
  readonly shader: ShaderPainter | null;
  /** The canvas's pixels to a CSS pixel: fewer for the shader, whose light is soft and whose every pixel costs. */
  readonly fineness: number;
}

function LightningCanvas({
  strikes,
  look,
  glow,
  at,
}: {
  strikes: readonly Strike[];
  look: Look;
  glow: Glow;
  at: number | undefined;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const painter = useRef<Painter | null>(null);
  const begun = useRef(new Map<string, number>());
  useEffect(() => {
    const element = canvas.current;
    if (element === null) return undefined;
    const shader = glow === 'shader' ? shaderPainter(element) : null;
    painter.current = {
      colourOf: colourReader(element),
      context: glow === 'strokes' ? element.getContext('2d') : null,
      shader,
      fineness: glow === 'shader' ? Math.min(window.devicePixelRatio, 1) * 0.6 : window.devicePixelRatio,
    };
    return () => {
      shader?.dispose();
      painter.current = null;
    };
  }, [glow]);
  useEffect(() => {
    const element = canvas.current;
    const paint = painter.current;
    if (element === null || paint === null) return undefined;
    const time = performance.now();
    const begins = new Map<string, number>();
    for (const strike of strikes) begins.set(strike.key, begun.current.get(strike.key) ?? time);
    begun.current = begins;
    let frame = 0;
    const draw = () => {
      const width = Math.round(element.clientWidth * paint.fineness);
      const height = Math.round(element.clientHeight * paint.fineness);
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      const now = performance.now();
      const since = (strike: Strike) => at ?? now - (begins.get(strike.key) ?? now);
      const moments = strikes.map((strike) => momentOf(look, placed(strike), since(strike)));
      if (paint.context !== null) paintStrokes(paint.context, moments, paint.colourOf, paint.fineness);
      paint.shader?.paint(moments, paint.colourOf, paint.fineness);
      const running = at === undefined && strikes.some((strike) => since(strike) < LIFE);
      frame = running ? requestAnimationFrame(draw) : 0;
    };
    draw();
    const watch = new ResizeObserver(() => {
      if (frame === 0) draw();
    });
    watch.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      watch.disconnect();
    };
  }, [strikes, look, at]);
  return <canvas ref={canvas} className="ui-lightning" aria-hidden="true" />;
}
