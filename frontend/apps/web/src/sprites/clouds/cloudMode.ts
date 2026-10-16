import { createStore } from '@villages/client-core';
import type { Readable } from '@villages/client-core';

import { note } from '../../log/log';
import { sayLevel } from '../../shaders/levels';
import type { ShaderLevel } from '../../shaders/levels';

import type { CloudBandName } from './cloudBands';
import { CLOUD_LOOK } from './look';

/**
 * How this window draws the clouds: their level, off, low or high, high at every load. A way of looking, neither
 * remembered nor sent. A store, the one shape every piece of state the page watches takes.
 */
const clouds = createStore<{ level: ShaderLevel }>({ level: 'high' });

export const cloudStore: Readable<{ level: ShaderLevel }> = clouds;

export function setCloudLevel(level: ShaderLevel): void {
  if (level === clouds.get().level) {
    return;
  }
  note('clouds', level === 'off' ? 'off: the sky is clear' : sayLevel(level, CLOUD_LOOK.levels[level]));
  clouds.set({ level });
}

/** What the clouds are drawing at the camera's zoom: its band, and how much of them, in whole per cent. */
export interface CloudReading {
  band: CloudBandName;
  share: number;
}

const reading = createStore<CloudReading>({ band: 'gone', share: 0 });

/** The reading in the Clouds part's bar. Set only when the band or the share changes, never every frame. */
export const cloudReadingStore: Readable<CloudReading> = reading;

export function readClouds(band: CloudBandName, amount: number): void {
  const share = Math.round(amount * 100);
  const was = reading.get();
  if (was.band !== band || was.share !== share) {
    reading.set({ band, share });
  }
}
