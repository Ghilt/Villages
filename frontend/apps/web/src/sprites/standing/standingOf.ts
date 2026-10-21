import { toMercatorExact } from '../../geometry/cameraMath';
import { WORLD_MASTER_WIDTH } from '../../geometry/world';
import { standsAmongTheTrees } from '../fogLayering';
import type { Entry } from '../markEntry';
import { footprintAt } from './footprint';
import type { StandingThing } from './StandingLayer';

/**
 * A structure or a person as they stand among the trees: the picture, and the pennant while that flies over it, the
 * footprint the catalogue gives a structure at its level laid on the ground from its foot - a person's is the foot
 * alone - and whether it is drawn standing at all. Null for a mark that does not stand among them.
 */
export function standingOf(entry: Entry): StandingThing | null {
  const { ground, look, pennant, spec } = entry;
  const tall = look.forms.groundHeight;
  if (!standsAmongTheTrees(spec.kind) || ground === null || tall === undefined) {
    return null;
  }
  const at = toMercatorExact(spec.at);
  const place = { x: at.x * WORLD_MASTER_WIDTH, y: at.y * WORLD_MASTER_WIDTH };
  const wide = (tall * ground.texture.width) / ground.texture.height;
  return {
    id: spec.id,
    sprites: pennant !== null && pennant.parent === ground.parent ? [ground, pennant] : [ground],
    place,
    // Hung from its foot, so its picture reaches that much of its width to the left and the rest to the right.
    anchor: look.groundAnchor,
    footprint: footprintAt(place, spec.structure?.footprint ?? 0),
    tall,
    wide,
    shown: ground.visible,
  };
}
