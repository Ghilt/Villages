import type { FogField } from '../fog/fogField';
import type { DrawnSprite } from './SpriteRenderer';

/** What the sprite canvas tells a development build about itself, read when the console or a test asks. */
export interface DevReadings {
  fog: () => { drawing: string; field: FogField | null };
  marksInVision: () => number;
  /** Whether the haze's slow clock is running, which it does only while there is haze to move. */
  undulating: () => boolean;
  sprites: () => Record<string, DrawnSprite>;
}

/**
 * The sprite canvas's handles on the window, in a development build only: `villagesFog`, what the fog is drawing
 * and from what, and `villagesSprites`, where every sprite actually ended up - for the console and for the
 * end-to-end test, which has no other way to ask a canvas what it drew.
 */
export function hangDevHandles(readings: DevReadings): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const handles = window as unknown as {
    villagesFog?: () => unknown;
    villagesSprites?: () => Record<string, DrawnSprite>;
  };
  handles.villagesFog = () => {
    const { drawing, field } = readings.fog();
    return {
      drawing,
      field:
        field === null
          ? null
          : { width: field.width, height: field.height, unitsPerTexel: field.unitsPerTexel },
      marksInVision: readings.marksInVision(),
      undulating: readings.undulating(),
    };
  };
  handles.villagesSprites = readings.sprites;
}
