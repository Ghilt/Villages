import type { ReactNode } from 'react';

import type { Size } from '../../ui/diorama/dioramaFit';
import { latticeAt, latticeFrom, onCell } from '../../ui/diorama/lattice';
import type { ScreenLattice } from '../../ui/diorama/lattice';
import type { SideKey } from '../replay';

/** A place in a venue's scene, in its units. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * A venue held one way: wide, or deep. Where everything stands in its scene - the map's buildings and trees, each
 * house's platform and speaker, the places its summons take as they come and its things put on the line, the
 * townsfolk's places on either side, and the mist, path and receptacle its happenings travel by - each house on its own
 * bank, the first on the left, so no figure is seen from behind (decision record 0116). All of it is laid on the map's
 * own lattice, a world unit to a cell: a building on the cells of its footprint and as tall as the map draws it, a
 * figure in the middle of a cell, and the path running along the cells' sides.
 */
export interface Arrangement {
  readonly scene: Size;
  /** The ground's lattice in the scene: where its cells are, and how many of the scene's units a world unit is. */
  readonly lattice: ScreenLattice;
  readonly cell: number;
  /** How tall a figure stands, in the scene's units. */
  readonly figure: number;
  readonly ground: ReactNode;
  /** The map's buildings, by their picture, `palace`, in the culture the challenge is fought in: each at its front corner. */
  readonly buildings: readonly (Point & { readonly picture: string; readonly height: number })[];
  /** The map's scenery, by its kind, `oak`. */
  readonly trees: readonly (Point & { readonly kind: string; readonly height: number })[];
  /** The middle of each house's platform on the ground; its speaker stands on top of it. */
  readonly platforms: Readonly<Record<SideKey, Point>>;
  /** Where each house's summons stand, in the order they come. */
  readonly summons: Readonly<Record<SideKey, readonly Point[]>>;
  /** Where each house's things put on the line stand, and how tall. */
  readonly onTheLine: Readonly<Record<SideKey, readonly Point[]>>;
  readonly lineHeight: number;
  /** The townsfolk's places on each side, nearest the house's speaker first. */
  readonly townsfolk: Readonly<Record<SideKey, readonly Point[]>>;
  /** The patch of mist the happenings' seals form in. */
  readonly mist: Point;
  /**
   * The way a seal travels, from the mist to where it rests in the receptacle, laid in the ground as a channel along the
   * cells' sides.
   */
  readonly path: readonly Point[];
  /** Where the receptacle a seal comes to rest in on its second stands: the font, or whatever the venue has. */
  readonly receptacle: Point;
  /** How wide a seal is drawn, in the scene's units. */
  readonly seal: number;
}

/** A venue: what a kind of challenge is shown in, held wide and held deep. */
export interface Venue {
  readonly name: string;
  readonly wide: Arrangement;
  readonly deep: Arrangement;
}

/** How a venue's ground is laid out: its lattice, and where a corner or a cell of it is in the scene. */
export function groundOf(lattice: ScreenLattice) {
  return {
    /** Corner (u, v): where a building's front corner stands, and the path turns. */
    corner: (u: number, v: number): Point => latticeAt(lattice, u, v),
    /** The middle of cell (u, v): where a figure stands. */
    cell: (u: number, v: number): Point => latticeAt(lattice, u + 0.5, v + 0.5),
  };
}

/**
 * The middles of a block of the lattice's cells, `us` and `vs` the first and last of each axis, every other one so a
 * crowd has room to stand, the `count` nearest `toward`, nearest first.
 */
export function crowdOn(
  lattice: ScreenLattice,
  us: readonly [number, number],
  vs: readonly [number, number],
  toward: Point,
  count: number,
): Point[] {
  const points: Point[] = [];
  for (let u = us[0]; u <= us[1]; u += 1) {
    for (let v = vs[0]; v <= vs[1]; v += 1) {
      if ((u + v) % 2 === 0) points.push(latticeAt(lattice, u + 0.5, v + 0.5));
    }
  }
  const away = (point: Point) => Math.hypot(point.x - toward.x, (point.y - toward.y) * 1.6);
  return points.sort((one, other) => away(one) - away(other)).slice(0, count);
}

/** A set of places mirrored across a scene's middle, for the other bank, each in the middle of the cell it falls in. */
export function mirroredOn(lattice: ScreenLattice, points: readonly Point[], width: number): Point[] {
  return points.map((point) => onCell(lattice, { x: width - point.x, y: point.y }));
}

/** A corner mirrored across a scene's middle onto the nearest corner of the lattice: a building's on the other bank. */
export function mirroredCorner(lattice: ScreenLattice, point: Point, width: number): Point {
  const { u, v } = latticeFrom(lattice, { x: width - point.x, y: point.y });
  return latticeAt(lattice, Math.round(u), Math.round(v));
}
