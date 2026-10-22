# 0115. Roads are baked, sent in pieces as a stand layer, and worn into the ground

- Status: accepted
- Date: 2026-10-21
- Plan: `docs/plans/settlements-and-roads.md`
- Builds on 0103, which sends a baked record under the fog when revealed ground lies within its reach, and on 0105,
  which left room in the worked ground for "a road and an old street later"; follows 0114

## Context

Adam, on 2026-10-21, asked for roads between the settlements and to the ruins, and bridges over the rivers that look
good crossing in at least eight directions. Asked how a road should look, worn earth, wider and paler than a path,
with bridges the only road pictures; asked how many directions a bridge has, eight from four pictures, since a bridge
reads the same from either end.

The paths of 0105 are walked by the page between two buildings it holds, which is right for a yard's neighbour and wrong
for a network: which places a road joins depends on every place near them, and a page under the fog knows only some, so
its roads would change as the fog lifted. A road can also be long, far longer than any record the stands carry.

## Decision

**Roads are baked once for the world, and sent through the fog in pieces.**

- **`world:roads`**, a step of the world cache after the settlements, the ruins, the flow and the height, joins the
  settlements to each other and to the ruins by a relative-neighbourhood graph within a longest road, every settlement to
  at least its nearest place and no road from one ruin to another. Each course is the cheapest way over the world's
  units by ground and slope, open water barred, roads merging into trunks where they share ground. A road ends in a
  settlement by one of its streets, and at a ruin by its gate, or its outline where it is not walled.
- **A river is crossed only by a bridge**: a straight run along one of the ground lattice's four axes - its two axes and
  its two diagonals, eight directions - from land over no more than a longest span of river to land, where `world:flow`
  says the river is small enough. A long span is stone, a short one timber.
- **A road is cut into straight pieces that fit the stands' eight bytes**: a middle in eighths of a unit, a reach of half
  its length and width, the half-vector to one end, and a kind - its grade, or a bridge's axis and kind. They are the
  `roads` layer of the stands, sent by the gateway's test of the fog unchanged; the protocol's version goes up once, to
  67, for the layer's name.
- **The page wears a road into the worked ground**, a kind of its own, only on revealed ground and clipped there a
  diamond at a time; no tree grows on it. A bridge stands among the trees on the strip of its deck, its picture chosen by
  its axis and kind.

## Consequences

- Every player sees the same roads, and a road seen never moves as the fog lifts.
- A piece's far end can lie past the revealed ground, by at most half a piece; the page draws none of it there.
- Roads show only where the worked ground does, from zoom 7.5 in. Further out is for later, from the same records.
- Retuning the roads is a change to `world/roads.json` and one bake, made once for every tree.
- A bot's seat raised before the bots learn to keep off the roads may stand on one.

## Alternatives considered

- **Walked by the page**, as the paths are. It keeps to the fog by construction, but which places are joined would
  depend on what the fog had let through, and every page would walk the same long courses again.
- **A file of whole roads the page fetches.** It would show every road through the fog, and with them where every
  settlement stands.
- **A record of its own shape on the wire.** The fog's test would need to learn lines; cut into pieces that look like
  stands, it needs to learn nothing.
- **Bridges at any angle.** A picture for every angle, or one stretched and turned, which a painted bridge does not
  survive; four axes give eight directions from four pictures.

## Amendment, 2026-10-21: one bridge on eight axes, roads drawn as shapes, and a roadside

Adam, looking at the first roads: a bridge should be a sprite, simple and the same for all cultures, modelled in 3D and
painted by asseterizer, in eight directions; a road render that shows every road from further out; at least 95% of the
villages joined by a road to another village; no jagged edges; and a roadside of small stone walls with moss, tufts and
the like, fitting the biome. Asked which eight directions, eight axes and eight pictures; asked how far out, zoom 6, as
far as the records already come. So, in `docs/plans/houses-bridges-and-road-render.md`:

- **One stone bridge** for every culture and span, modelled once and drawn in the map's camera along **eight axes**: the
  lattice's two axes, its two diagonals and the four halfway between them, two along one axis for one along the other.
  The bake crosses on all eight, the kind byte names only the axis, and the page stretches a bridge along its deck to
  its span, never wider or taller.
- **Every village has a road to another village where one can be had**: a village the graph leaves with no other
  village in its network is joined to its nearest, out to a far limit; the bake reports the share, which is to be 95% or
  more, and why each of the rest is alone.
- **A road is drawn as a shape**, not as coloured diamonds: every piece a band with round ends, so bends and joins are
  smooth, from zoom 7.5 in as worn earth. The worked ground keeps its `road` kind only so that
  no tree grows on a road or its roadside.
- **A roadside**, by the biome under it, along both sides of every road from 7.5 in, laid out by the page from the
  pieces it holds, drawn between the roads and the trees.

## Amendment, 2026-10-22: a road is the real world

Adam, seeing the roads drawn from zoom 6: they should fade with everything else; a road is part of the real world, so
it fades in with the scenery sprites, the structure sprites and the rest. The thin line from zoom 6 is gone: a road is
drawn from 7.5 in, as worn earth, arriving and going there in time, and its roadside, its bridges and the worn ground
with it. Where a bridge stands, its picture is the road. See decision record 0096's amendment of the same day.

## Amendment, 2026-10-22: a road follows the grid

Adam, looking at a road running straight up the screen across the ground's lattice: roads should not run in long
straight lines diagonal to the grid, which undoes the isometric look; push them to zigzag along it, a few diagonals
allowed, with a turning radius so they go a little diagonal only as they turn. So a road's course is found over the
ground lattice's diamonds rather than the world's units: a step along one of its two axes, a step across its diagonal
only at the price `diagonal` (2.5 steps, above the two axis steps it saves), and every turn costing `turn` steps (4),
less along a road already there, so a road keeps to long straight runs and turns where the ground asks it to. A step's
line is checked over every world unit it passes, so a road still never touches water or a river but by a bridge, and a
bridge along an axis costs least. Its shape is no longer straightened into whatever line can be seen: its straight
runs stay as they are and each turn is rounded to `shape.turning` (2.5 units), or as near as the shorter run beside it
allows, left sharp where the rounding would cross water. Every point is put on the quarter of a unit it lies in, never
over the edge into the next.

Adam again, the same day: the roads were awfully straight. Keep the main direction along the grid but let a road go a
little back and forth diagonally, and mix the turns' radii, most as they were and some a little wider. So each straight
run of three units or more wriggles `shape.wriggle` (half a unit) either side of its line, back and forth every
`shape.wriggleEvery` (six units), coming in from nothing over its first and last unit and a half; and `shape.widerShare`
(three in ten) of the turns are rounded to `shape.widerTurning` (five units) rather than `shape.turning`. Which turns
and how each run wriggles are worked out from where they are, so a bake is the same every time. Every line a wriggle
draws is checked clear like a rounding's; a run whose wriggle is not clear stays straight.

And again: the wriggles were too uniform, as the roadside had been; never more wriggly than they were, but not so
consistent. So `shape.wriggle` is now the most a run wriggles: each stretch of two goings back and forth has a strength
of its own, eased into the next, a stretch in four or so straight and some at the most, and each run goes back and forth
every `shape.wriggleEvery` or up to half as slowly again, never quicker.

And again, drawing the way he meant over a road: not a wriggle back and forth, whose very word had narrowed the
thing, but a wriggle here and there, a reroute here and there, a shifting here and there, a sideways parry here and
there, while following the grid. So a run no longer wriggles; it **strays**. Along it, every `shape.strayEvery` (six
units) or so, a roll of the place decides what it does: shift across and keep on beside its line until the next shift
(four in ten), jog out and back (two in ten), wriggle a moment (two in ten), or nothing; never more than `shape.stray`
(1.2 units) off its line, and brought back onto it over the last two units at either end. Where a stray is not clear it
is tried at half as far, and then not at all. The settings `shape.wriggle` and `shape.wriggleEvery` are gone.
