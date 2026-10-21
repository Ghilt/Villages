import { groundTilt, pixelsPerWorldUnit, tiltGround, toMercatorExact } from '../geometry/cameraMath';
import type { CameraView, LngLat, ScreenPoint } from '../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../geometry/world';
import type { Entry } from './markEntry';
import type { GroundFootprint } from './standing/footprint';
import { standingOf } from './standing/standingOf';
import { sizesAt } from './twoForms';

/*
 * Where the ring under the selected mark lies. Close in it is a circle on the ground round what the thing stands on -
 * a building's footprint, a person's patch of ground - squashed as the camera squashes the ground, so it lies on it;
 * far out, round its sign, as the sign is. Between the two it eases with the trade between the mark's two forms.
 */

/**
 * The ring on the screen: its middle, how far it reaches across in pixels, how much the ground squashes its height, and
 * whether it is round the thing itself, on the ground under the trees, or round its sign, over the fog with it.
 */
export interface RingPlace {
  x: number;
  y: number;
  across: number;
  lean: number;
  onTheGround: boolean;
}

/** How far round a thing standing on a point the ring reaches, in world units: about a person's own height. */
const ROUND_A_POINT = 1.4;
/** How much further out than a footprint's furthest corner the ring lies, so it rings the base rather than cuts it. */
const ROOM = 1.12;
/** How far round a sign the ring reaches, as a share of the sign's height: as wide as the ring always was. */
const ROUND_A_SIGN = 0.85;

/** What the ring is laid by: where the mark is drawn, its place, the ground it covers and how far it has traded. */
export interface RingOf {
  /** Where both of its forms hang from on the screen. */
  foot: ScreenPoint;
  at: LngLat;
  /** Its footprint on the ground, or null for a thing that stands on a point. */
  footprint: GroundFootprint | null;
  /** How tall its ground form stands, in world units, so a building with no footprint is ringed by its size. */
  tall: number;
  /** Nought showing its sign, one standing itself. */
  blend: number;
  /** How tall its sign is drawn, in pixels. */
  signHeight: number;
}

export function ringOn(of: RingOf, view: CameraView): RingPlace {
  const tilt = groundTilt(view);
  const scale = pixelsPerWorldUnit(view.zoom);
  const mercator = toMercatorExact(of.at);
  const place = { x: mercator.x * WORLD_MASTER_WIDTH, y: mercator.y * WORLD_MASTER_WIDTH };
  let centre = place;
  let reach = Math.max(ROUND_A_POINT, 0.4 * of.tall);
  if (of.footprint !== null) {
    const middle = {
      x: of.footprint.reduce((sum, corner) => sum + corner.x, 0) / of.footprint.length,
      y: of.footprint.reduce((sum, corner) => sum + corner.y, 0) / of.footprint.length,
    };
    const furthest = Math.max(
      ...of.footprint.map((corner) => Math.hypot(corner.x - middle.x, corner.y - middle.y)),
    );
    if (furthest > 0) {
      centre = middle;
      reach = furthest * ROOM;
    }
  }
  const shift = tiltGround(centre.x - place.x, centre.y - place.y, tilt);
  const ground = { x: of.foot.x + shift.x * scale, y: of.foot.y + shift.y * scale, across: reach * scale };
  const sign = { x: of.foot.x, y: of.foot.y, across: of.signHeight * ROUND_A_SIGN };
  const mix = (far: number, near: number) => far + (near - far) * of.blend;
  return {
    x: mix(sign.x, ground.x),
    y: mix(sign.y, ground.y),
    across: mix(sign.across, ground.across),
    lean: tilt.lean,
    onTheGround: of.blend >= 0.5,
  };
}

/** Where the ring lies under a mark as last drawn, or null for one not drawn. */
export function ringUnder(entry: Entry, view: CameraView): RingPlace | null {
  const drawn = entry.ground?.visible === true ? entry.ground : entry.icon;
  if (drawn === null || !drawn.visible) {
    return null;
  }
  return ringOn(
    {
      foot: drawn,
      at: entry.spec.at,
      footprint: standingOf(entry)?.footprint ?? null,
      tall: entry.look.forms.groundHeight ?? 0,
      blend: entry.ground === null ? 0 : entry.icon === null ? 1 : entry.blend,
      signHeight: sizesAt(view.zoom, entry.look.forms).icon,
    },
    view,
  );
}
