import type { Entry } from './markEntry';
import { settlementHit } from './settlements/settlementDress';
import { formForHit } from './twoForms';

/**
 * What the pointer is over among the marks: a crowd's badge first, then the nearest mark whose form drawn now is
 * under it, a settlement by any of its pieces. Its id, `group:` and a leader's for a badge, or null for nothing.
 */
export function hitAmong(
  entries: ReadonlyMap<string, Entry>,
  point: { x: number; y: number },
): string | null {
  let nearest: { id: string; away: number } | null = null;

  // A crowd's badge sits over the marks, so it answers first.
  for (const [id, entry] of entries) {
    const badge = entry.badge?.view;
    if (badge?.visible === true && !entry.leaving) {
      const box = badge.getBounds();
      if (point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY) {
        return `group:${id}`;
      }
    }
  }

  for (const [id, entry] of entries) {
    // A mark on its way out takes no clicks: it is not a thing on the map any more, it is the
    // last of a picture of one.
    // A candidate is a place being offered rather than a thing standing in the world, so it is not
    // one; a house and a person are.
    // A mark hidden in a crowd is not there to be clicked: its leader stands for it.
    if (entry.spec.kind === 'candidate' || entry.leaving || entry.grouped < 0.5) {
      continue;
    }
    // A settlement answers by its pieces, the nearest of them under the pointer.
    const settled = settlementHit(entry, point);
    if (settled !== null) {
      if (nearest === null || settled < nearest.away) nearest = { id, away: settled };
      continue;
    }
    // One form answers, and the switch is at the crossover where the two are the same size, so the
    // thing you can hit never changes size either. Hitting whichever is more opaque would move the
    // target about mid-fade; hitting both would let an all-but-invisible ghost take a click.
    const which = formForHit(entry.blend);
    const sprite = which === 'ground' ? entry.ground : entry.icon;
    if (sprite === null || !sprite.visible) {
      continue;
    }
    const box = sprite.getBounds();
    if (point.x < box.minX || point.x > box.maxX || point.y < box.minY || point.y > box.maxY) {
      continue;
    }
    // Two marks can overlap where two houses are close. The nearer one is the one meant.
    const away = Math.hypot(point.x - sprite.x, point.y - sprite.y);
    if (nearest === null || away < nearest.away) {
      nearest = { id, away };
    }
  }

  return nearest?.id ?? null;
}
