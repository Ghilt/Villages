import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../log/log';

/**
 * How much of itself each of the map's shaders draws, and the one switch over all of them: what the debug
 * panel's Shaders section sets, in its bar and in each part's.
 *
 * A shader that is a look and nothing more - the water, the grass - is drawn off, low or high. High is the whole
 * of the screen's pixels at its full frame rate; low is a part of them at a lower rate, worked out into a picture
 * of its own and laid over the screen, for a machine the high costs too much on. Each shader keeps its own level,
 * and its own numbers for what low and high are in its `look.ts`. The switch over them turns every one of them off
 * without forgetting their levels. A way of looking, like the fog switch: neither remembered nor sent.
 */
export type ShaderLevel = 'off' | 'low' | 'high';

export const SHADER_LEVELS: readonly ShaderLevel[] = ['off', 'low', 'high'];

/** What a level is, in numbers: the share of the screen's width and height worked out, and how often it moves. */
export interface LevelLook {
  resolution: number;
  framesPerSecond: number;
}

const shaders = createStore({ on: true });

export const shadersStore: Readable<{ on: boolean }> = shaders;

export function setShadersOn(on: boolean): void {
  if (on === shaders.get().on) {
    return;
  }
  note('shaders', on ? 'drawn again, each at its own level' : 'none drawn: the map is as painted');
  shaders.set({ on });
}

/** The level a shader is drawn at: its own, unless the switch over them all is off. */
export function drawnAt(level: ShaderLevel): ShaderLevel {
  return shaders.get().on ? level : 'off';
}

/** How a level is said in the log: how much of the screen and how often. */
export function sayLevel(level: ShaderLevel, look: LevelLook | null): string {
  if (level === 'off' || look === null) {
    return 'off';
  }
  const share = Math.round(look.resolution * look.resolution * 100);
  return `${level}, ${share === 100 ? 'all' : `${share}%`} of the screen's pixels at ${look.framesPerSecond} frames a second`;
}
