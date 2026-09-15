import type { LngLat } from './cameraMath';

/**
 * What the renderer needs to know about a thing on the map. Deliberately not a house: the renderer draws
 * marks on a map and knows nothing about the game, so a house is turned into one of these on the way in.
 */
export interface MapSprite {
  /** Stable across updates, and the seed of the sprite's own place in the idle motion. */
  id: string;
  at: LngLat;
  /** The tincture of the field, as a colour, until real banners arrive. */
  tint: number;
  /**
   * What sort of mark this is. A house is a thing standing in the world and fades out when the camera
   * is too far back to make it out; a candidate is a place being offered to the player right now, and
   * is drawn at every zoom because it is the thing they are being asked about.
   */
  kind: 'house' | 'candidate';
}

/**
 * The seam behind which the renderer lives. Pixi is one implementation; a custom map layer or a
 * data-driven overlay could be another, and nothing outside this folder would notice. See docs/adr/0005.
 *
 * Selection and hit testing join this interface when the house inspector needs them.
 */
export interface SpriteRenderer {
  /**
   * Attach to a container that overlays the map, and follow that map's camera from now on. Asynchronous
   * because the renderer has to acquire a graphics context before it can draw anything.
   */
  mount(container: HTMLElement): Promise<void>;
  /** Replace what is on the map. The renderer works out what appeared, changed and went away. */
  setSprites(sprites: readonly MapSprite[]): void;
  /** Stop following, release the canvas and the textures. */
  destroy(): void;
}

/**
 * The camera the renderer follows, which is all it needs from the map. There is no change notification
 * because the renderer draws every frame in any case: the sprites are never quite still.
 */
export interface CameraSource {
  center(): LngLat;
  zoom(): number;
  size(): { width: number; height: number };
}
