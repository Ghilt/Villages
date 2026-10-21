import { Sprite } from 'pixi.js';
import type { Container } from 'pixi.js';

import { GROUND_LATTICE, frameOf, jettyKey, settlementPieceKey, worldXOf, worldYOf } from '@villages/world';
import type { LaidOut } from '@villages/world';

import { groundTilt, pixelsPerWorldUnit, tiltGround, toMercatorExact } from '../../geometry/cameraMath';
import type { CameraView } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import type { MapSprite } from '../SpriteRenderer';
import { footprintAt } from '../standing/footprint';
import type { StandingThing } from '../standing/StandingLayer';
import type { SettlementPictures } from './settlementPictures';

/*
 * A settlement's dress: what its layout puts down that is no structure - a jetty, a net rack, a boat - a sprite each
 * from the settlements' atlas, standing on its own foot, all of them together one thing among the trees with the
 * structures inside the settlement, its footprint the settlement's square (0110, `standTogether.ts`). Its houses, its
 * mill and its market are structures, drawn as structures are. What the marks layer asks of a settlement's mark, apart
 * from it so the layer stays one size. See docs/plans/houses-bridges-and-road-render.md.
 */

const FRAME = frameOf(GROUND_LATTICE);
/** How far the camera tips the ground when it is closest in, for the box the trees are sorted against. */
const LEAN = Math.SQRT1_2;

/** One piece as drawn: its sprite and shadow, where it stands on the ground in world units, and how tall it is. */
interface Piece {
  readonly sprite: Sprite;
  readonly shadow: Sprite | null;
  readonly x: number;
  readonly y: number;
  readonly tall: number;
}

/** A settlement's pieces, in the order they are drawn, and the layout they were dressed from. */
export interface SettlementDress {
  readonly laid: LaidOut;
  readonly pieces: readonly Piece[];
}

/** What a settlement's dress reads and writes of a mark: `markEntry.ts`'s `Entry`, as far as a settlement goes. */
export interface SettlementMark {
  readonly spec: MapSprite;
  readonly ground: Sprite | null;
  readonly shadow: Sprite | null;
  settlement: SettlementDress | null;
}

const corner = (u: number, v: number) => ({ x: worldXOf(FRAME, u, v), y: worldYOf(FRAME, u, v) });

/** Takes a settlement's pieces off the map for good. */
export function undressSettlement(entry: SettlementMark): void {
  for (const piece of entry.settlement?.pieces ?? []) {
    piece.sprite.destroy();
    piece.shadow?.destroy();
  }
  entry.settlement = null;
}

/**
 * Dresses a settlement's mark in its buildings as its layout says, once the layout is known and the pictures read:
 * again only when either changes, so a layout that holds still keeps its sprites. A mark that is not a settlement, or
 * whose layout is not known yet, has none, and is drawn as its one picture.
 */
export function dressSettlement(
  entry: SettlementMark,
  pictures: SettlementPictures,
  among: Container,
  shadows: Container,
): void {
  const laid = entry.spec.structure?.laid;
  if (laid === undefined || !pictures.read) {
    if (entry.settlement !== null) undressSettlement(entry);
    return;
  }
  if (entry.settlement?.laid === laid) return;
  undressSettlement(entry);
  const pieces: (Piece & { low: boolean })[] = [];
  const add = (key: string, at: { x: number; y: number }, low: boolean) => {
    const picture = pictures.of(key);
    if (picture === null) return;
    const sprite = new Sprite(picture.texture);
    sprite.anchor.set(picture.foot.x, picture.foot.y);
    sprite.visible = false;
    let shadow: Sprite | null = null;
    if (picture.shadow !== null) {
      shadow = new Sprite(picture.shadow.texture);
      shadow.anchor.set(picture.shadow.foot.x, picture.shadow.foot.y);
      shadow.visible = false;
      shadows.addChild(shadow);
    }
    pieces.push({ sprite, shadow, ...at, tall: picture.tall, low });
  };
  for (const jetty of laid.jetties) add(jettyKey(jetty.axis), corner(jetty.u, jetty.v), true);
  for (const one of laid.dress) {
    add(settlementPieceKey(one.piece, one.culture), corner(one.u, one.v), one.piece === 'boat');
  }
  // Farthest first: what lies on the water under the rest, then up the screen to down it, the camera looking north.
  pieces.sort((a, b) => Number(b.low) - Number(a.low) || a.y - b.y);
  for (const piece of pieces) among.addChild(piece.sprite);
  entry.settlement = { laid, pieces };
}

/** Where a settlement's middle stands on the ground, in world units. */
function middleOf(entry: SettlementMark): { x: number; y: number } {
  const at = toMercatorExact(entry.spec.at);
  return { x: at.x * WORLD_MASTER_WIDTH, y: at.y * WORLD_MASTER_WIDTH };
}

/**
 * Lays a settlement's pieces out on the screen about its middle, drawn at `point`, each on its own foot and as tall as
 * it stands, at `alpha`, its shadow `dark`; the mark's own picture and shadow hidden. Nothing for a mark undressed.
 */
export function placeSettlement(
  entry: SettlementMark,
  point: { x: number; y: number },
  view: CameraView,
  alpha: number,
  dark: number,
): void {
  const dress = entry.settlement;
  if (dress === null) return;
  if (entry.ground !== null) entry.ground.visible = false;
  if (entry.shadow !== null) entry.shadow.visible = false;
  const scale = pixelsPerWorldUnit(view.zoom);
  const tilt = groundTilt(view);
  const middle = middleOf(entry);
  for (const { sprite, shadow, x, y, tall } of dress.pieces) {
    const off = tiltGround(x - middle.x, y - middle.y, tilt);
    sprite.visible = alpha > 0;
    sprite.alpha = alpha;
    sprite.scale.set((tall * scale) / sprite.texture.height);
    sprite.position.set(point.x + off.x * scale, point.y + off.y * scale);
    if (shadow !== null) {
      shadow.visible = alpha * dark > 0;
      shadow.alpha = alpha * dark;
      shadow.scale.set(sprite.scale.x);
      shadow.position.set(sprite.x, sprite.y);
    }
  }
}

/** Hides a settlement's pieces, as its mark is off the screen or faded out. */
export function hideSettlement(entry: SettlementMark): void {
  for (const piece of entry.settlement?.pieces ?? []) {
    piece.sprite.visible = false;
    if (piece.shadow !== null) piece.shadow.visible = false;
  }
}

/**
 * A settlement as it stands among the trees: every piece's sprite, farthest first, on its square of ground, and the
 * box its pictures fill, worked out as the camera sees them closest in. Null for a mark not dressed as one.
 */
export function settlementStanding(entry: SettlementMark): StandingThing | null {
  const dress = entry.settlement;
  if (dress === null || dress.pieces.length === 0) return null;
  const place = squareCorner(dress.laid.square);
  let left = 0;
  let right = 0;
  let top = 0;
  for (const { sprite, x, y, tall } of dress.pieces) {
    const off = { x: x - place.x, y: (y - place.y) * LEAN };
    const wide = (tall * sprite.texture.width) / sprite.texture.height;
    left = Math.min(left, off.x - sprite.anchor.x * wide);
    right = Math.max(right, off.x + (1 - sprite.anchor.x) * wide);
    top = Math.min(top, off.y - sprite.anchor.y * tall);
  }
  const wide = Math.max(0.1, right - left);
  return {
    id: entry.spec.id,
    sprites: dress.pieces.map((piece) => piece.sprite),
    place,
    anchor: -left / wide,
    footprint: footprintAt(place, dress.laid.square.side),
    tall: Math.max(0.1, -top),
    wide,
    shown: dress.pieces.some((piece) => piece.sprite.visible),
  };
}

/** The front corner of a settlement's square, in world units: where it stands among the trees. */
export function squareCorner(square: LaidOut['square']): { x: number; y: number } {
  return corner(square.fromU + square.side, square.fromV + square.side);
}

/** How far from a point a settlement's nearest piece drawn under it stands, or null for none under it. */
export function settlementHit(entry: SettlementMark, point: { x: number; y: number }): number | null {
  let nearest: number | null = null;
  for (const { sprite } of entry.settlement?.pieces ?? []) {
    if (!sprite.visible) continue;
    const box = sprite.getBounds();
    if (point.x < box.minX || point.x > box.maxX || point.y < box.minY || point.y > box.maxY) continue;
    const away = Math.hypot(point.x - sprite.x, point.y - sprite.y);
    nearest = nearest === null ? away : Math.min(nearest, away);
  }
  return nearest;
}
