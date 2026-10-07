# 0016. The origin map

- Status: open
- Started: 2026-10-06

## Hypothesis

**A tool can work out, from Adam's edited master and the plain Earth it was cut from and from nothing else,
where on Earth every piece of the edited master came from - and which land matches nowhere and is therefore
invented - well enough that a real name carried through it lands on the right ground.** Adam keeps editing the
way he does; nothing records his edits; the pixels he moved with Nearest Neighbour are the record.

It is wrong if land Adam moved shows as invented across whole regions, if land he invented shows as Earth's,
if Earth's own coastline carried through the map wanders off the painted coast, or if it takes longer to run
than re-cutting the tiles does.

## Setup

`npm run world:origin --prefix frontend`, which reads the master and `world/master/terrain-base.png` and works
out a placement for every square of 32 master pixels, about 40 km: where its middle came from on Earth, and the
turn, stretch and mirror that carry the rest. `docs/plans/real-world-names.md` has the reasoning; the code is
`frontend/packages/world/src/origin*.ts`.

1. Every square is tried where it is, because most land never moved.
2. A square that is found lends its placement to its neighbours, because land is moved in pieces.
3. A square nothing has reached looks up its small lakes: four of them make a shape a move, turn or stretch
   leaves alone, and plain Earth's million lakes are indexed by those shapes.
4. A placement is judged by how many pixels agree with Earth's, allowing a pixel either way, against how well
   the same placement does ten pixels off, which is what chance looks like for that ground.
5. What is still not found is **invented**. A piece that came from where a larger one did is a **copy**.

What it writes, beside the master's tiles: `origin/origin.bin` and `origin.json`, and `origin.png`, the map
drawn over the world square. The **Origin** renderer in the Debug map lays the picture on the world, and a
click on the map with it showing says in the log where that place came from.

As little as possible: no pins to correct it, no names, no use by the game.

## What we will look at

- Adam's eye on the Origin renderer: do the pieces he moved come out as one colour each, is the magenta
  where he invented land - India's incision - and nowhere else, and does the white line of Earth's coast lie on
  his painted coast?
- The numbers the tool prints: how much land is from Earth, invented and copied, and how long it took.
- A click on a place whose origin is known, in the log.

## Observations

**2026-10-06, the first run on `terrain3_mended_2026-10-03`.** Two minutes and a half. 96.1% of the land from
Earth, 3.8% invented, 0.1% copies. The pieces came out as pieces: Scandinavia, Britain, South America turned,
New Zealand, the whole of the south-east from India to the Chinese coast. But Australia's interior and the
Amazon came out blotched with invented land that is not invented. Looking at one blotch, in Borneo's rainforest
turned thirty degrees, the ground was plainly the right ground: exact agreement fails where a square is nearly
one class, because a turn half a pixel out misses every river a pixel wide, and the mending made some rivers two
pixels wide. Judged with a pixel's tolerance against a shifted placement, the same square went from 0.56 to 0.86.
So the judging changed to that.

**2026-10-06, the second run, judged with a pixel's tolerance.** A hundred seconds. 97.8% of the land from
Earth, 2.0% invented (881 squares of it with no pattern at all), 0.2% copies. 93,689 of the 117,510 squares
with a pattern were found where they were, growing from them found more, and only 2,485 squares needed their
lakes looking up; 114,414 were found before deciding. Australia came out as one piece, the Amazon all but
clean. What is left magenta is what Adam did: long bands across India, Bengal and south China with copied
ground in them, which is the incision he described opened up and filled; a block over east-central China
that turned out, looked at pixel by pixel against Earth carried through the map, to be painted over with
flat farmland and a patch of forest; and a seam across Patagonia where South America was cut and joined. Two
clicks in the log: a place at 11.07°N 106.48°E is `from Earth at 25.58°N 107.87°E, moved 14.6° (sure 1.00)`,
the south of China pushed fifteen degrees south; one in a band at 20.91°N 98.67°E is `invented land`. Earth's
coast carried through lies on the painted coast round the Danish straits, where both shores moved.

**2026-10-06, real names carried through it.** The hypothesis's own test: run the map backwards and carry
Natural Earth's named rivers, lakes and peaks into the world. 1,496 rivers, 1,998 lakes and 632 peaks arrived,
16 went with ground that was removed or copied. Clicked: the Thames where Britain went, `by the Thames`;
Vänern where Sweden went, two and a half degrees from its place, `at Vänern`; the Dnipro where it always was;
and `near Mont Blanc, 4,807 m`. The first carrying lost 82 names, Vänern among them: the squares' placements
are each found to within a pixel, so the patches of Earth they cover leave slivers between them that were
nobody's, and a shore point in one went nowhere. A pixel and a half of slack fixed it.

Seas test it from the other side, since no square of sea came from anywhere: each is named by the nearest
coast's placement carried out across the water. The Baltic between Sweden moved and the Baltic shore that
stayed is `the Baltic Sea`; the water east of Australia, moved twenty degrees, is `the Tasman Sea`.

## Result

Open: the numbers, the places looked at and the names carried say yes; Adam's eye on the whole world is the test.

## Decision

Open.

## Follow-ups

Open.
