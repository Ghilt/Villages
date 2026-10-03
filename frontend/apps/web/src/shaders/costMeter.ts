/**
 * What a shader costs the graphics card, measured there rather than guessed: the time between two marks on the
 * card, averaged over a run of frames, and handed over once when the card has answered for all of them. A card or
 * a browser that will not say hands over nothing, and a run the card was interrupted in is measured again. The
 * first few frames after a start are let go by, because they carry the setting up - a picture made, a texture sent
 * - and not what a frame costs once it is going.
 */

/** How many frames are let go by before the measuring starts. */
const SETTLING = 6;
export interface CostMeter {
  /** Marks the start of what a frame draws; false when this frame is not being measured. */
  start(): boolean;
  /** Marks the end of it, after a start that said true; a frame that drew nothing is not counted. */
  stop(drewSomething: boolean): void;
  /** Hands over the milliseconds a frame, once, when they are known; null until then. */
  read(): number | null;
  /** Measures again, after what is drawn has changed. */
  again(): void;
  dispose(): void;
}

export function createCostMeter(gl: WebGL2RenderingContext | null | undefined, frames = 30): CostMeter {
  const timer = gl?.getExtension('EXT_disjoint_timer_query_webgl2') ?? null;
  let queries: WebGLQuery[] = [];
  let running: WebGLQuery | null = null;
  let done = timer === null;
  let settling = SETTLING;

  const clear = () => {
    for (const query of queries) gl!.deleteQuery(query);
    queries = [];
  };

  return {
    start() {
      if (done || gl === null || gl === undefined || timer === null || queries.length >= frames) {
        return false;
      }
      if (settling > 0) {
        settling -= 1;
        return false;
      }
      running = gl.createQuery();
      gl.beginQuery(timer.TIME_ELAPSED_EXT, running);
      return true;
    },

    stop(drewSomething) {
      if (running !== null) {
        gl!.endQuery(timer!.TIME_ELAPSED_EXT);
        if (drewSomething) {
          queries.push(running);
        } else {
          gl!.deleteQuery(running);
        }
        running = null;
      }
    },

    read() {
      if (done || queries.length < frames || gl === null || gl === undefined || timer === null) {
        return null;
      }
      if (!queries.every((query) => gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) as boolean)) {
        return null;
      }
      if (gl.getParameter(timer.GPU_DISJOINT_EXT) as boolean) {
        clear();
        return null;
      }
      const total = queries.reduce<number>(
        (sum, query) => sum + (gl.getQueryParameter(query, gl.QUERY_RESULT) as number),
        0,
      );
      clear();
      done = true;
      return total / frames / 1e6;
    },

    again() {
      if (gl !== null && gl !== undefined && timer !== null) {
        clear();
        done = false;
        settling = SETTLING;
      }
    },

    dispose() {
      if (gl !== null && gl !== undefined) clear();
    },
  };
}
