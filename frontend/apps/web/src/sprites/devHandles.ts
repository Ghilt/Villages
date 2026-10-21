import type { FogField } from '../fog/fogField';
import type { DrawnSprite } from './SpriteRenderer';

/** What the sprite canvas tells a development build about itself, read when the console or a test asks. */
export interface DevReadings {
  fog: () => { drawing: string; field: FogField | null };
  marksInVision: () => number;
  /** Whether the haze's slow clock is running, which it does only while there is haze to move. */
  undulating: () => boolean;
  sprites: () => Record<string, DrawnSprite>;
  /** How many bridges are held, and how many drawn now. */
  bridges: () => { bridges: number; drawn: number };
  /** How many stretches of road are held to draw. */
  roads: () => { strips: number; roadside: number };
}

/**
 * The sprite canvas's handles on the window, in a development build only: `villagesFog`, what the fog is drawing
 * and from what, `villagesSprites`, where every sprite actually ended up, `villagesBridges`, how many bridges
 * stand, and `villagesRoads`, how many stretches of road and things of the roadside are drawn - for the console and for the
 * end-to-end test, which has no other way to ask a canvas what it drew.
 */
export function hangDevHandles(readings: DevReadings): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const handles = window as unknown as {
    villagesFog?: () => unknown;
    villagesSprites?: () => Record<string, DrawnSprite>;
    villagesBridges?: () => { bridges: number; drawn: number };
    villagesRoads?: () => { strips: number; roadside: number };
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
  handles.villagesBridges = readings.bridges;
  handles.villagesRoads = readings.roads;
}
