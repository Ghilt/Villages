import type { ReactNode } from 'react';

import type { Size } from '../../ui/diorama/dioramaFit';
import type { SideKey } from '../replay';

/** A place in a venue's scene, in its units. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * A venue held one way: wide, or deep. Where everything stands in its scene - the map's buildings and trees, each
 * house's platform and speaker, the places its summons take as they come and its things put on the line, the
 * townsfolk's places on either side, and the mist, path, receptacle and channels its happenings travel by - each house
 * on its own bank, the first on the left, so no figure is seen from behind (decision record 0116).
 */
export interface Arrangement {
  readonly scene: Size;
  /** How tall a figure stands, in the scene's units. */
  readonly figure: number;
  readonly ground: ReactNode;
  /** The map's buildings, by their picture, `palace`, in the culture the challenge is fought in. */
  readonly buildings: readonly (Point & { readonly picture: string; readonly height: number })[];
  /** The map's scenery, by its kind, `oak`. */
  readonly trees: readonly (Point & { readonly kind: string; readonly height: number })[];
  /** The top middle of each house's platform, where its speaker stands. */
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
  /** The way a seal travels, from the mist to the receptacle, laid in the ground as channels. */
  readonly path: readonly Point[];
  /** Where a seal comes to rest on its second: the font, or whatever the venue has. */
  readonly receptacle: Point;
  /** The channels from the receptacle to each house's platform, which a jolt runs along. */
  readonly channels: Readonly<Record<SideKey, readonly Point[]>>;
  /** How wide a seal is drawn, in the scene's units. */
  readonly seal: number;
}

/** A venue: what a kind of challenge is shown in, held wide and held deep. */
export interface Venue {
  readonly name: string;
  readonly wide: Arrangement;
  readonly deep: Arrangement;
}

/** The points of a grid, a little shaken so a crowd does not stand in rows, nearest `toward` first. */
export function crowdOf(
  xs: readonly number[],
  ys: readonly number[],
  toward: Point,
  count: number,
  seed: number,
): Point[] {
  let state = seed;
  const shake = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return (state / 2147483648) * 16 - 8;
  };
  const points = xs.flatMap((x) =>
    ys.map((y) => ({ x: Math.round(x + shake()), y: Math.round(y + shake()) })),
  );
  points.sort(
    (one, other) =>
      Math.hypot(one.x - toward.x, (one.y - toward.y) * 1.6) -
      Math.hypot(other.x - toward.x, (other.y - toward.y) * 1.6),
  );
  return points.slice(0, count);
}

/** A set of places mirrored across a scene's middle, for the other bank. */
export function mirrored(points: readonly Point[], width: number): Point[] {
  return points.map((point) => ({ x: width - point.x, y: point.y }));
}
