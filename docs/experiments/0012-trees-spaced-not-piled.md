# 0012. Trees spaced, not piled

- Status: open, waiting on pictures
- Started: 2026-09-25
- Closed:

## Hypothesis

Spacing the scatter - a tree keeps its place only if nothing that arrives before it stands nearer than
the two kinds' `apart` - makes a wood read as distinct trees in a canopy rather than a heap of them, with
markedly fewer sprites where the stands are thickest and next to no change on open ground, without
breaking any of 0052's promises: the same ground grows the same wood, a cell is only a cache, and a
thinner scattering is always a subset of a fuller one.

Adam's words, looking at the first real tree on the map: *"our current sprite renderer tries to build these
forests by clumping many tree sprites quite unintelligently. In the end i do think we will get away with a
lot fewer sprites more smartly spaced."*

Falsifiable three ways. The thickest stands may lose too few sprites to matter, or so many that a wood is a
lawn with trees on it. Open ground may change, which would mean the rule is doing something other than
what it says. And spacing may show a seam at the edges of cells or of tiles, where each cell decides its
own points.

## Setup

What the code already said and nobody read: every kind in `world/biomes.json` carries an `apart`, "how
near another of its own kind may stand, in world units", and the scatter has never looked at it. Points are
a jittered grid thinned by how thick the stands are, so two trees can land on the same spot and routinely
do.

The smallest thing that answers it:

- **The rule is a Matérn type II thinning**, the textbook hard-core point process, which is exactly the
  shape 0052 needs: every candidate is scattered as before, and one is dropped if any other candidate
  within the pair's distance arrives earlier. It asks only about candidates, never about which of them
  survive, so it has no chain of consequences and is a pure function of the ground near the point.
- **The pair's distance is the mean of the two kinds' `apart`**, so two pines stand at least a pine's
  `apart` from each other, and a bush may stand nearer a tree than another tree may.
- **Earlier wins**: the lower rank, which leans on each kind's `order`, so a tree clears the floor around
  its own foot rather than a fern clearing a tree.
- **A cell looks past its edges** by the widest `apart`, working each neighbouring candidate out from the
  terrain and the stands of whichever tile it stands on. A candidate is the same candidate whichever cell
  asks, so spacing holds across every edge and there is no seam to find.
- **The dial still only ever removes.** The competition is decided at the density the sprite map asked
  for, and the dial thins what survives it, so turning it down is a subset as before.
- **A lever for the experiment**: a spacing multiplier in the Scenery section of the debug panel, from
  nothing - the scatter as it was - to three times every `apart`, so the same wood can be looked at both
  ways without code.

## What we will look at

- **Adam's eye** on the same woods at spacing nought and one: whether a wood reads as trees.
- **The counts**, from the stills and from the Scenery section: how many points each place loses, in the
  thickest stands and on open ground.
- **A test that no two points anywhere are nearer than their pair allows**, across the edges of cells.
- **What a cell costs to cut**, because it now looks at a margin of its neighbours' candidates too.

## Observations

**2026-09-25, the rule, and the three ways it was proved.** Built as set up. A test scatters a block of
cells straddling a tile edge, thick wood on one side and open ground on the other, and finds no pair of
points anywhere nearer than their kinds allow. Broken once by skipping one neighbouring square, it fails;
broken again by giving each cell no margin - every cell deciding its own points alone - it finds three
pairs crowding each other across cell edges, which is the seam the margin exists to prevent. Unspaced, the
same block has more than twenty crowded pairs, so the fault was real rather than assumed. The dial is
still a subset: the existing test passes with spacing on.

**Spacing nought is the old scatter exactly.** The stills at spacing nought come out with the very counts
they had before this experiment - 1,089, 3,674, 5,506 and 2,282 - to the point.

**At the file's own `apart`, it takes out little.** The stills at zoom 9.6:

| place | unspaced | spacing 1 | spacing 2 | spacing 3 |
| --- | --- | --- | --- | --- |
| scandinavia | 1,089 | 1,013 (−7%) | 682 (−37%) | 415 (−62%) |
| alps | 3,674 | 3,487 (−5%) | 2,647 (−28%) | 1,844 (−50%) |
| islands | 5,506 | 4,837 (−12%) | 2,575 (−53%) | 1,262 (−77%) |
| close | 2,282 | 2,144 (−6%) | 1,529 (−33%) | 931 (−59%) |

And in the running program over the same woods near Stockholm, at zoom 9.6 and tipped 43 degrees by the
zoom: 938 trees unspaced, 860 at spacing one, 586 at two.

The reason is in the numbers rather than the rule. The `apart` values were written against the kinds'
old sizes, and they are small beside the pictures now drawn: a pine's is 0.8 world units where its picture
is two wide, and the oak's 1.1 against a crown of four since it was made bigger. At spacing one two pines
may still overlap by more than half. Side by side on the same wood, spacing one is still a heap and
spacing two is distinct trees that still read as a wood; three is open woodland.

**Earlier wins, and it is the tree that is left.** Where a spruce and a heather crowd each other it is the
spruce that stands, because the big kinds arrive earlier. Counted overall, heather keeps a larger share
of itself than spruce does - two spruces must stand 0.9 apart, two heathers only 0.3 - which says nothing
about the rule and was nearly written as a test that said it did.

**What it costs.** A cell now scatters a margin of its neighbours' candidates as well as its own: two grid
squares at the widest `apart`, about half as many candidates again, and near a tile edge the next tile's
terrain and stands. Measured on the running program, recutting a whole screen of cells at once, the worst
frame went from 4.8 ms unspaced to 5 to 6 ms spaced. The generator's own estimate of points a screenful is
worked out before spacing, so it is now an upper bound.

## Result

**Confirmed for the rule, and the number is not yet right.** The spacing is exact, seamless and cheap, it
takes out much more where trees crowd than on open ground, and every one of 0052's promises still holds. What it
does to the look is set by `apart`, and the values in the file are about half what the pictures want.

## Decision

**Keep the rule; leave the number until there are pictures to judge it by.** Adam, 2026-09-26: *"a bit hard
to visualize what will be best, lets leave the lever for far apart for sprites until ive gotten more good
isometric sprites in."* With one real picture among fifteen placeholders, how far apart trees should stand
is a question the placeholders cannot answer. So the spacing ships at the file's own `apart`, the lever
stays in the Scenery section, and the proposal on the table is to double every `apart` - the slider at
two - once the pictures are in.

## Follow-ups

- **A copse sprite.** Where a stand is thickest, one picture of a whole wood instead of the trees in it.
