# 0086. A tile glides when its size is asked for, and never with the window

- Status: accepted
- Date: 2026-10-06
- Adds motion to 0041's spread and 0085's letter; nothing in either changes where anything ends up.
- Amended 2026-10-06, Adam's word: **the windows on the rail glide too.** They are flow items rather than
  rectangles the stage writes, so no transition can move them: the stage measures each one after every change to
  what is on the rail and animates it from where it stood - its height, and a shift that makes up whatever the
  flow does not - so a window opened or put away grows or shrinks, one arriving grows in from nothing, and the
  rest slide, a window brought to the top included. A window gone leaves nothing to animate and the rest slide up
  into its room. Its frame fills its box while the box is the taller, so one put away shrinks rather than snapping
  to its strip. The arithmetic is pure and tested in `railGlide.ts`; the motion is looked at.

## Context

Adam asked for very quick animations on a desktop whenever a bay changes size, and found no bay where one
would not work. The letter needed the most thought: it goes from a chip in the bottom row to a box over
everything, and its cards say far more opened out than anywhere else, so Adam allowed what they say to fade in
rather than be drawn while the box is still growing.

Every tile is an absolutely placed box whose four numbers the stage writes from `bayBox`, so a change of size is
a change of four inline numbers. The same four numbers also change every time the window is resized, the debug
panel is opened or a grip is dragged, and a tile that trailed behind a grip would read as the layout lagging.

## Decision

**In the spread, a tile changing size or place glides there in 160 milliseconds**, eased out: the rail, the
corner and its tab bar, the right column and the letter. A CSS transition on the four numbers, and nothing else.

**Not the floor**, whose map would be redrawn at every step, and **not when the stage itself changed** - a
resize, the debug panel coming or going, the fold - when everything follows the window at once. The stage
compares its size and form with the last ones it laid out at, and says which with `data-easing`; the
transitions are only on under it. Nothing glides on a phone, where the arrangement is the fold's.

**The veil fades in and out with the letter**, so it is always there in the spread and takes no press while it
is down. **The tile lying over the others stays over them until it has landed**, and rises over them at once,
so the letter going back to its chip shrinks over the corner and the dialogues rather than under them.

**What the letter says fades in once its box has landed**: the chip as it shrinks to it, the letter as it opens
out, and the cards' details - what the option is and the marks of the omens that brought it - a beat after
their titles. Two names for one fade, so it plays whichever way the letter went. It is done before a rolled
hand's first omen lands, at 320 milliseconds, so the roll plays as it did.

**A player who has asked for less motion gets none of the glide**: one number, `--glide`, is nought for them.

**The rail watches its own height as well as its windows'**, because it now glides to a new height when the
corner below it changes size, and the room on it is what it comes to rather than where it set out from.

## Consequences

**A tile's content reflows while its box glides**, everywhere but the letter: the house card, the key figures
and a conversation are drawn at each step of the 160. Fast enough that it reads as the box moving; if one of
them looks wrong in motion, it can fade as the letter does.

**The glide is not tested.** Where each tile ends up is, as before; that it gets there smoothly is looked at.

**Opened out with nothing asked**, the letter is Take action in the middle of a box over everything. That was so
before this, and the motion makes it more noticeable.

## Alternatives considered

- **Animating in JavaScript**, measuring and tweening each tile. It would know which change is a resize without
  the stage saying so, and it is a great deal more code for four numbers the browser can already move.
- **Fading every tile's content** as the letter's does. A conversation blinking out and back in to be made
  wider is worse than it reflowing for 160 milliseconds.
- **Gliding with the window too.** A grip that the tiles trail behind feels like the layout cannot keep up.
