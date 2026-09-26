# 0013. Shadows in a layer of their own

- Status: closed
- Started: 2026-09-26
- Closed: 2026-09-26

## Hypothesis

A shadow under every sprite of scenery - its own outline laid on the ground by the one light, all of them
drawn in one layer under the trees and merged so that two overlapping are no darker than one - stands the
trees on the ground of the tipped map, where without it they look set on top of it, and costs no frame
time anyone could measure.

Adam asked for both halves. On the pictures that came with shadows: *"It would be cool if the shadows
worked to keep and it produced a nice result when stacked the way we stack those sprites."* And then:
*"show me how the shadow layer would look and if it would give performance hit."*

Falsifiable twice over. A shadow may read as a smudge beside a tree rather than a tree's shadow, or a wood
may go dark rather than deep; and doubling the particles may show in the frame, in the thickest woods and
while the camera tips, which is when every foot is written again.

## Setup

Why not the shadows the pictures came with is decision record 0059's amendment: each falls across its
plinth at two heights, and baked into a sprite a shadow darkens whatever it is drawn over and doubles where
two overlap.

- **The shadow is cut with the sprite**, by `shadowOf` in `packages/world/src/art.ts`, from the sprite as
  cut: every row of the picture laid on the ground `lean` times its height to the left of the foot and
  `flat` times its height below it - the light is from the upper right - softened, and black. Each row of the
  shadow averages the rows of the picture it flattens, so a thin trunk lands rather than falling between
  samples. `SHADOW` holds the numbers; they are on their second shape, below.
- **Into the same atlas**, beside each sprite, with its foot where the sprite's foot falls in it. The atlas
  went from 996 by 584 to 996 by 731, and from 383 kB to 405.
- **A layer of their own**, in `SceneryLayer.ts`: a second particle layer under the trees, one particle a
  sprite, on the same foot and at the same size, fading with its sprite. It is drawn first, onto the
  cleared canvas, and **blended by the greater**: where two shadows overlap the ground takes the darker of
  them and no more. Every tree comes after every shadow, so no shadow is ever drawn over a tree. The layer is
  never sorted, because the greater of two is the same whichever comes first.
- **A lever**, in the Scenery section: how dark, from nought to 70 per cent where a shadow is whole, 40 to
  begin with. Nought makes no shadows at all rather than invisible ones, so it costs exactly what the map
  cost before. Moving it never touches the trees: they do not fade out and in again.

## What we will look at

- **Adam's eye**: the same woods with the lever at nought and at 40, and whether the length and the
  darkness are right.
- **The frame**, as a number: a sweep from zoom 8.5 to 10 in twentieths, which tips the camera from 22
  degrees to 45 and so writes every foot again on every frame - the shadows' worst case - timed as a forced
  redraw of the map and then of the sprites, waiting for the sprites' canvas to be finished on the graphics
  card. With and without, one after the other and more than once, so that a drift in the machine cannot be
  read as a cost.

## Observations

**2026-09-26, what it looks like.** Over the woods near Stockholm at zoom 10, tipped 45 degrees, 727 trees:
with the lever at nought the trees stand on the ground like cut-outs laid on it; at 40 each one has a soft
shadow to its left, the lone ones in the open sit where they stand, and in the wood the shadows run together
into one shade without going darker where they cross. They lie across grass, paths and water alike. They
are long and thin, as from a low sun.

**What it costs: nothing that can be measured.** The whole frame - the painted map, the scenery, and the
wait for the graphics card - over the sweep, at the file's own density, up to 1,857 trees:

| run | median | slowest tenth |
| --- | --- | --- |
| shadows on | 11.2 ms | 12.0 ms |
| shadows off | 11.1 ms | 11.9 ms |
| shadows on, again | 11.3 ms | 11.9 ms |
| no scenery at all | 11.4 ms | 12.0 ms |

The frame is the painted map: the scenery does not show in it with or without its shadows. At three times
the density - the panel's `stress it`, 2,916 trees and 2,916 shadows - six rounds of on and then off, each
compared within its round: −0.1, −0.3, +0.1, −0.1, +0.1 and −0.2 ms, a median of −0.1. Below the noise,
which is about two tenths of a millisecond.

One run was thrown away: the lever was moved through a second copy of the settings module, which the page
does not listen to, so "on" and "off" were the same thing. It is the reason the lever is now moved the way a
hand moves it.

**The second shape, from Adam's eye.** *"I think the shadows are a bit too long and sharp, more faded
edges please, and also I think a more shadowy base just beneath the tree would look good - especially on
the oak the shadow seems a bit misaligned."* The misalignment was the shape, and not only the oak's: laid
out 0.8 of a height to the left, a crown's shadow landed well down and away from its trunk, joined to the
foot only by the trunk's own thin shadow, which the softening all but rubbed out - so what showed was a
patch of shade lying beside the tree. The oak, the tallest kind, showed it worst. So:

- **Shorter and flatter**: `lean` 0.35 and `flat` 0.1, where they were 0.8 and 0.2, so a crown's shade
  lies against its own trunk.
- **Lighter and softer the farther it falls**: `fade` takes six tenths off by the far end, and the
  softening grows from 3 pixels at the foot to 8 at the far end, where it was 2 all over - the way a real
  shadow's edge blurs with its distance from what casts it.
- **A pool under every foot**: the ground its lower half shades from every side at once, as wide as six
  tenths of that lower half, a third as deep as it is wide, solid in its middle and fading out past its
  edge, and a fifth of its width towards the shadow so the two run together. Its width comes from the
  picture: a pine or a boulder stands in a wide pool, a palm on its bare trunk in a narrow one.

Every tree now stands in its pool with a short soft shadow running out of it, and the oak's is under its
trunk. At 40 per cent it is quiet; at 55 the trees sit visibly on the ground. How dark is Adam's to set.
The frame cost is unchanged by the shape: the same one particle a tree, covering less ground than before.

## Result

**Confirmed, both halves.** Adam's eye, on the second shape: *"nice shadows."* The first shape was the
smudge beside a tree the hypothesis feared, the oak's worst; the second stands every tree on the ground.
The half that can be measured holds: the shadows cost nothing in the frame, even at three times the density
and while the camera tips.

## Decision

**Keep.** The shadows are cut with the sprites and drawn in their own layer, and the lever starts at 40 per
cent, where Adam looked at them; it stays in the Scenery section for whoever wants to move it.
`LOOK-AND-FEEL.md` says what they look like.

## Follow-ups

- **The length, the softness and the pool**, all in `SHADOW`, each a cut away from being tried.
- **The marks** - castles, figures - cast none yet. They are drawn in code and have to wait for their
  pictures, like everything else about them.
- **A shadow that lies on the tipped ground**: it is drawn upright with its sprite, the way the pictures are,
  and does not flatten further as the camera tips. At 45 degrees the difference is the one a round tree
  hides; a long shadow would show it.
