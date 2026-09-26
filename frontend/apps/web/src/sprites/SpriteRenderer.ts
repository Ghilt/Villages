import type { Coverage } from '@villages/protocol';

import type { FogField } from '../fog/fogField';

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
   * is drawn at every zoom because it is the thing they are being asked about. A character is a person
   * standing somewhere, in the colours of the house they serve. See decision record 0055.
   */
  kind: 'house' | 'candidate' | 'character';
  /**
   * Drawn however far back the camera is, like a candidate and for a different reason: this one is the
   * player's own and they asked to keep it in sight. Never set for anyone else's. See 0038.
   */
  always?: boolean;
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
  /**
   * Which house or person is at this point on the screen, by the id they were drawn under, or null.
   *
   * The renderer answers because it is the only thing that knows where it drew: the canvas takes no
   * pointer events, so the map hands the click over. Houses and characters answer; a candidate is a place
   * being offered rather than a thing standing in the world.
   */
  hitTest(point: { x: number; y: number }): string | null;
  /** Marks one sprite as the selected one, or nothing when null. */
  setSelected(id: string | null): void;
  /**
   * Whether this window is showing everything: the debug switch, which takes the distance floor off
   * every mark rather than one. A player's own eye is `always` on the sprite instead. See 0038.
   */
  setEverything(on: boolean): void;
  /**
   * How the world is furnished, and where the terrain it is scattered from is served.
   *
   * Scenery is not a `MapSprite`: there are tens of thousands of them, none of them is a thing the
   * game knows about, and none of them can be clicked. They are a carpet the renderer lays under the
   * marks from the terrain alone. See decision record 0051.
   */
  setScenery(how: SceneryHow): void;
  /**
   * The fog of war to draw, or null for none: the switch off, or nothing heard yet about what the house
   * sees. It is drawn inside this renderer rather than over it, because it has to lie between the world and
   * the signs for the things in it. See decision record 0062.
   */
  setFog(fog: FogHow | null): void;
  /** Stop following, release the canvas and the textures. */
  destroy(): void;
}

/**
 * The fog of a house: the distance field it is drawn from, null for a house that sees nothing, and what it has
 * in vision, which says which marks stand in vision and so go over it. See decision records 0061 and 0064.
 */
export interface FogHow {
  field: FogField | null;
  vision: Coverage;
}

/** What the renderer needs in order to furnish the world. */
export interface SceneryHow {
  on: boolean;
  /** A multiplier on what the sprite map asked for: one is exactly that, a half is half of it. */
  dial: number;
  /** A multiplier on every kind's `apart`: one is what the file says, nought spaces nothing. */
  spacing: number;
  /** How much later than its natural zoom each kind arrives, in zoom levels. */
  laterBy: number;
  /** How dark the scenery's shadows are, nought to one. Nought draws none at all. See experiment 0013. */
  shadows: number;
  /** Where this page's flat tiles live, which is what the terrain is read from. */
  tilesRoot: string;
}

/**
 * The camera the renderer follows, which is all it needs from the map.
 *
 * `watch` is what makes the two canvases agree. The overlay used to draw on its own animation frame,
 * which read the camera at a different instant from the one the map had just drawn with, so the marks
 * slid against the ground for the length of every flight. Now the map says when it has drawn and the
 * overlay draws then, from the same camera, into the same browser frame. Nothing is drawn while the
 * map is still, which is the other half of the bargain: with the idle motion gone there is nothing to
 * animate, so a still map costs nothing at all.
 */
export interface CameraSource {
  center(): LngLat;
  zoom(): number;
  size(): { width: number; height: number };
  /**
   * How far the camera has tipped, and which way is up, in degrees.
   *
   * Both are zero for every player, and are only ever moved by the debug panel's Camera section. They
   * are here rather than assumed away because the overlay draws its own projection: a camera the map
   * has tilted and an overlay that has not heard about it is marks sliding off their own ground. See
   * experiment 0008.
   */
  pitch(): number;
  bearing(): number;
  /** Calls back whenever the map has drawn. Returns what stops it. */
  watch(drawn: () => void): () => void;
}
