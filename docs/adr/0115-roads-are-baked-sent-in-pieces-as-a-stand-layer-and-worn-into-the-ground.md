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
  `roads` layer of the stands, sent by the gateway's test of the fog unchanged; the protocol's version goes up once for
  the layer's name.
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
