/**
 * What a set of vision points covers, with surface tension. The other half of `villages.protocol.Coverage` in
 * Kotlin, held to the same vectors in `contracts/fixtures/coverage.json`.
 *
 * Every circle, and every gap or notch between them that a ball as big as the tension cannot get into: two
 * circles close together are seen across, a notch where two overlap is rounded off, and a lone circle stays
 * exactly its circle, because the ball reaches all the way round it. A place seen again and again adds
 * nothing. The gateway holds back by this, and the page asks it which marks stand in vision; the fog itself
 * is drawn from a distance field that comes to the same edge. Adam's picture, and decision record 0064.
 *
 * A place inside a circle is covered. Otherwise it is covered when every ball of the tension's size that
 * contains it would stray into a circle: when the disc of every centre such a ball could have is covered by
 * the circles grown by the tension. A disc is covered by discs when its rim is, and when no two of them cross
 * inside it at a point no third one covers, because a hole among discs always has a corner like that.
 */

import { mercatorX, mercatorY, reachAcross } from './reach';

/** A vision point's circle: where it is, and how far it sees, in kilometres. */
export interface CoverageCircle {
  lat: number;
  lon: number;
  kilometres: number;
}

export interface Coverage {
  covers(place: { lat: number; lon: number }): boolean;
}

interface Disc {
  x: number;
  y: number;
  r: number;
}

const TURN = 2 * Math.PI;

const holds = (outer: Disc, inner: Disc): boolean =>
  Math.hypot(outer.x - inner.x, outer.y - inner.y) + inner.r <= outer.r;

export function coverageOf(circles: readonly CoverageCircle[], tension: number): Coverage {
  const plain: Disc[] = circles.map((circle) => ({
    x: mercatorX(circle.lon),
    y: mercatorY(circle.lat),
    r: reachAcross(circle.lat, circle.kilometres),
  }));
  // The circles grown by the tension, less any lying wholly inside another: it could change no answer, and
  // revealed ground is mostly circles inside circles. Of two the same, the first stands.
  const all: Disc[] = circles.map((circle) => ({
    x: mercatorX(circle.lon),
    y: mercatorY(circle.lat),
    r: reachAcross(circle.lat, circle.kilometres + tension),
  }));
  const grown = all.filter(
    (disc, i) => !all.some((other, j) => j !== i && holds(other, disc) && (!holds(disc, other) || j < i)),
  );

  return {
    covers(place) {
      const x = mercatorX(place.lon);
      const y = mercatorY(place.lat);
      if (plain.some((disc) => Math.hypot(disc.x - x, disc.y - y) <= disc.r)) {
        return true;
      }
      if (tension <= 0) {
        return false;
      }
      const ball = reachAcross(place.lat, tension);
      const near = grown.filter((disc) => Math.hypot(disc.x - x, disc.y - y) < disc.r + ball);
      if (near.length === 0) {
        return false;
      }
      if (near.some((disc) => Math.hypot(disc.x - x, disc.y - y) + ball <= disc.r)) {
        return true;
      }
      return rimCovered(near, x, y, ball) && noUncoveredCorner(near, x, y, ball);
    },
  };
}

/** Whether the rim of the disc of radius `ball` about the place lies wholly inside the discs near it. */
function rimCovered(near: readonly Disc[], x: number, y: number, ball: number): boolean {
  const arcs: [number, number][] = [];
  for (const disc of near) {
    const dx = disc.x - x;
    const dy = disc.y - y;
    const apart = Math.hypot(dx, dy);
    const cosine = (apart * apart + ball * ball - disc.r * disc.r) / (2 * apart * ball);
    if (cosine >= 1) {
      continue;
    }
    const middle = Math.atan2(dy, dx);
    const half = Math.acos(Math.max(-1, cosine));
    let from = (middle - half) % TURN;
    if (from < 0) {
      from += TURN;
    }
    const to = from + 2 * half;
    if (to > TURN) {
      arcs.push([from, TURN], [0, to - TURN]);
    } else {
      arcs.push([from, to]);
    }
  }
  arcs.sort((a, b) => a[0] - b[0]);
  let reached = 0;
  for (const [from, to] of arcs) {
    if (from > reached) {
      return false;
    }
    reached = Math.max(reached, to);
  }
  return reached >= TURN;
}

/** Whether every point inside the disc where two discs cross is inside a third, so that no hole has a corner. */
function noUncoveredCorner(near: readonly Disc[], x: number, y: number, ball: number): boolean {
  for (let i = 0; i < near.length; i += 1) {
    for (let j = i + 1; j < near.length; j += 1) {
      const a = near[i]!;
      const b = near[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const apart = Math.hypot(dx, dy);
      if (apart >= a.r + b.r || apart <= Math.abs(a.r - b.r)) {
        continue;
      }
      const along = (apart * apart + a.r * a.r - b.r * b.r) / (2 * apart);
      const off = Math.sqrt(Math.max(0, a.r * a.r - along * along));
      const midX = a.x + (along * dx) / apart;
      const midY = a.y + (along * dy) / apart;
      for (const side of [-1, 1]) {
        const cornerX = midX - (side * off * dy) / apart;
        const cornerY = midY + (side * off * dx) / apart;
        if (Math.hypot(cornerX - x, cornerY - y) >= ball) {
          continue;
        }
        const coveredByAThird = near.some(
          (disc, k) => k !== i && k !== j && Math.hypot(cornerX - disc.x, cornerY - disc.y) < disc.r,
        );
        if (!coveredByAThird) {
          return false;
        }
      }
    }
  }
  return true;
}
