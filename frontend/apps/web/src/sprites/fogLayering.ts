import type { MapSprite } from './SpriteRenderer';
import type { Form } from './twoForms';

/**
 * Which side of the fog of war a form of a thing is drawn on. Adam's rule, in his words: the fog covers "the
 * world", not "representations of important things when zoomed out", and a thing in sight is never under it.
 *
 * So an **icon** is always over the fog, because an icon is the sign for a thing rather than the thing, and it
 * is what is drawn far out; and a **ground form** is over the fog while it stands in vision and under it
 * otherwise, because close in it is part of the world. The seats a choice offers and the ring under the
 * selected mark are signs too, and have no ground form to put anywhere else.
 *
 * What is not decided is how significance should enter it: a thing important enough to be drawn from far out
 * should perhaps never be covered, ground form and all. Until significance is worked out properly, whether a
 * form is an icon stands in for it. See decision record 0062.
 */
export function overTheFog(form: Form, inVision: boolean): boolean {
  return form === 'icon' || inVision;
}

/**
 * Whether a kind of thing's ground form stands among the trees instead, on no side of the fog of its own: a
 * structure's and a person's do, because the trees about them are drawn in front of them and behind them, and the
 * trees are under the fog. In vision the fog is clear over the trees and over them, so a thing in sight is still never
 * hidden by it; no cloud is drawn close in. The rule above is for a kind with a ground form that does not stand among
 * them, of which there is none today. See decision record 0110.
 */
export function standsAmongTheTrees(kind: MapSprite['kind']): boolean {
  return kind === 'structure' || kind === 'character';
}

/** Where a kind of thing's ground form is drawn, standing in vision or not: among the trees, over the fog or under it. */
export function groundSideOf(kind: MapSprite['kind'], inVision: boolean): 'among' | 'over' | 'under' {
  return standsAmongTheTrees(kind) ? 'among' : overTheFog('ground', inVision) ? 'over' : 'under';
}
