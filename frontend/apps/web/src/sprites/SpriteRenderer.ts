import type { Coverage } from '@villages/protocol';

import type { FogField } from '../fog/fogField';

import type { LngLat } from '../geometry/cameraMath';

/**
 * What the renderer needs to know about a thing on the map. Deliberately not a structure or a person: the renderer
 * draws marks on a map and knows nothing about the game, so each is turned into one of these on the way in.
 */
export interface MapSprite {
  /** Stable across updates, and the seed of the sprite's own place in the idle motion. */
  id: string;
  at: LngLat;
  /** The tincture of the field, as a colour, until real banners arrive. */
  tint: number;
  /**
   * What sort of mark this is. A structure is a building standing in the world, drawn in its own colours with
   * its holder's pennant over it, and fades out when the camera is too far back to make it out; see 0093. A
   * candidate is a place being offered to the player right now, and is drawn at every zoom because it is the
   * thing they are being asked about. A character is a person standing somewhere, in the colours of the house
   * they serve; see decision record 0055. A house is not drawn at all: its structures are.
   */
  kind: 'candidate' | 'character' | 'structure';
  /**
   * A structure's picture, by its type's name, and its height on the ground in world units, which its level
   * raises; how many of the ground's diamonds its base covers along a side, its footprint; and whether it is a ruin,
   * whose yard is going back to grass (docs/plans/worked-ground.md). Its tint is white, because a structure is drawn
   * in its own colours. Absent for every other kind.
   */
  structure?: { picture: string; groundHeight?: number; footprint?: number; ruin?: boolean };
  /**
   * A structure the player's house controls, or one of its key figures: far out it becomes its mark, a type's pin
   * or a bust, and is drawn at every zoom. Anyone else's stays itself, shrinks with the map and fades at the floor.
   */
  yours?: boolean;
  /** How much it matters to the world, which decides which of a crowd of marks far out leads it. See 0096. */
  significance?: number;
  /** What it is called, for the card a crowd of marks opens into. */
  name?: string;
  /** The colour of the pennant flown over it, its holder's field, or absent for a thing nobody holds. */
  pennant?: number;
}

/**
 * The seam behind which the renderer lives. Pixi is one implementation; a custom map layer or a
 * data-driven overlay could be another, and nothing outside this folder would notice. See docs/adr/0005.
 *
 * It is handed the whole scene at once, and works out what changed; it asks for a frame and draws once, at the
 * next one, however much changed, and the map moving draws it in the map's own frame.
 */
export interface SpriteRenderer {
  /**
   * Attach to a container that overlays the map, and follow that map's camera from now on. Asynchronous
   * because the renderer has to acquire a graphics context before it can draw anything. `uncolouring` is a
   * canvas between the map and this one, where the renderer takes the colour out of the map on ground the
   * house has only revealed; see `fog/uncolouring.ts` and decision record 0065.
   */
  mount(container: HTMLElement, uncolouring?: HTMLCanvasElement): Promise<void>;
  /** What is on the map now. The renderer works out what changed since the last, and draws once. */
  setScene(scene: Scene): void;
  /**
   * Which house or person is at this point on the screen, by the id they were drawn under, or null.
   *
   * The renderer answers because it is the only thing that knows where it drew: the canvas takes no
   * pointer events, so the map hands the click over. Characters and structures answer, and a crowd's "+N" as
   * `group:<leader>`; a candidate is a place being offered rather than a thing standing in the world.
   */
  hitTest(point: { x: number; y: number }): string | null;
  /**
   * Every mark of the crowd a mark leads far out, as last drawn, the leader first and the rest in rank order: what a
   * click on its `group:<leader>` badge opens.
   */
  groupOf(leader: string): readonly string[];
  /** Stop following, release the canvas and the textures. */
  destroy(): void;
}

/** Everything the renderer draws, handed over whole. Each part keeps its identity while it has not changed. */
export interface Scene {
  /** What is on the map. The renderer works out what appeared, changed and went away. */
  sprites: readonly MapSprite[];
  /** The one sprite marked as selected, or nothing when null. */
  selected: string | null;
  /**
   * The fog of war to draw, or null for none: the switch off, or nothing heard yet about what the house
   * sees. It is drawn inside this renderer rather than over it, because it has to lie between the world and
   * the signs for the things in it. See decision record 0062.
   */
  fog: FogHow | null;
  /**
   * How the world is furnished, and where the terrain it is scattered from is served.
   *
   * Scenery is not a `MapSprite`: there are tens of thousands of them, none of them is a thing the
   * game knows about, and none of them can be clicked. They are a carpet the renderer lays under the
   * marks from the terrain alone. See decision record 0051.
   */
  scenery: SceneryHow;
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

/** What the development probe reports about one sprite. */
export interface DrawnSprite {
  x: number;
  y: number;
  visible: boolean;
  /** Which form is drawn, or `both` while they are trading places. */
  form: 'ground' | 'icon' | 'both' | 'none';
  /** How tall it is on the screen right now, which is what a ground-anchored size is checked by. */
  height: number;
  /** How much of it is here: nought on its way out, one arrived. */
  presence: number;
  /** Whether its ground form is drawn over the fog, which it is in vision. Its icon always is. */
  groundOverTheFog: boolean;
  /** Whether a pennant is flown over it, for a structure held by a house; absent for a mark that has none. */
  pennant?: boolean;
}
