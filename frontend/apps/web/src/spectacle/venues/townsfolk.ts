import type { SideKey } from '../replay';

/**
 * Which side each of the townsfolk stands on at a tug: the first as many as side A's share of the crowd, the rest with
 * side B. The share is the tug's - at 28 toward A, 64 in a hundred - so the crowd moves as the tug bar does, and a
 * townsperson who changes sides is the first of B's or the last of A's, walking across the square. Decision record
 * 0116.
 */
export function townsfolkSides(tug: number, count: number): SideKey[] {
  const share = (Math.max(-100, Math.min(100, tug)) + 100) / 200;
  const withA = Math.round(share * count);
  return Array.from({ length: count }, (_, at) => (at < withA ? 'a' : 'b'));
}

/**
 * Where each of the townsfolk stands: side A's share at A's places nearest its speaker first, the rest at B's nearest
 * theirs first, so a crowd swinging fills from each platform outward.
 */
export function townsfolkPlaces<P>(
  sides: readonly SideKey[],
  places: Readonly<Record<SideKey, readonly P[]>>,
): P[] {
  const count = sides.length;
  return sides.map((side, at) => {
    const place = side === 'a' ? places.a[at] : places.b[count - 1 - at];
    if (place === undefined) {
      throw new Error(`the venue has no place for townsperson ${at} on side ${side}`);
    }
    return place;
  });
}
