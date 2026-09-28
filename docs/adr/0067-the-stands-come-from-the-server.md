# 0067. The stands come from the server

- Status: accepted
- Date: 2026-09-27
- Builds on 0061, which said the fog of war holds the scenery back too, and on 0054, whose sprite map it sends

## Context

Since step 5 of the fog of war no tree grows on unknown ground, but only because the page declines to draw it.
The stands the scenery is grown from are public files, one for every zoom 7 tile, and a page that stopped
declining would see every wood in the world. 0061 said that what a house cannot see is kept back by the
server rather than hidden by the browser, "ideally the trees too", and step 8 of `docs/plans/fog-of-war.md`
is that ideal.

Three things stood in the way. The server had never read the world's files, and never learnt which master a
page draws, because that is the browser's choice (0025). The wire was JSON text and nothing else. And the
fog could answer whether a point is covered, when a stand is a disc: what matters is whether it touches
revealed ground.

It is also more than a few hundred lines, so it lands in three commits: the gateway sends the stands, the
page draws from what it is sent, and the files leave the public folder.

## Decision

**The gateway sends each page the stands of every zoom 7 tile under the cells it holds, as far as they touch
ground its house has revealed.** A stand stands still, so revealed is enough, as it is for a house.

- **By tile, not by cell.** A tile is the sprite map's own chunk, 256 world units a side, and every held cell
  from zoom 6 in wants the tiles it lies in and any a margin of 16 world units reaches: the page draws scatter
  cells a ring beyond what it shows and each reads its stands a spacing and a wander past its own edge, which
  sixteen units past every held cell covers (`standTilesUnder`). Coarser cells want none, because the scenery
  is never drawn that far out. A tile is sent once while a held cell is over it, empty when nothing in it gets
  through, so the page knows it has all there is, and let go when no held cell is; coming back sends it again.
- **The records as they are.** The frame is `stands`, the tile's `x` and `y` and its records, eight bytes a
  stand exactly as the generator writes them, in base64: base64 in JSON costs a third more than raw bytes
  and asks nothing new of either end's socket. The page reads them with the `decodeStands` it already has,
  and the gateway reads a middle and a reach with `StandRecords`. `contracts/fixtures/stands.json` holds
  both ends to the same records.
- **Touching, with the scatter's margin.** A stand goes when revealed ground lies within its reach of its
  middle, and eight world units past that (`Fog.STAND_MARGIN`): the page spaces what a stand scatters from its
  neighbours a few units across and reads revealed ground off a field a unit or so to the texel, so a stand
  that close can change what grows on revealed ground. What grows there is then what grew before.
- **One question more of `Coverage`.** `reaches` asks whether anything covered lies within a distance of a
  point, by growing every circle by the distance. That can answer yes a little wide of the edge where the
  tension bridges a gap, and can never answer no to a disc that touches; at no distance it is `covers`, and
  holds to every shared vector.
- **Again when the fog moves.** A change to the house's sight, or Adam's switch, answers every held tile again,
  and only a tile whose stands changed is sent. With the fog lifted every stand goes; a house with no points
  has revealed nothing and is sent none. What is held back is simply not in the frame, and nothing counts it.
- **Which master is the page's word, checked.** `hello` carries the master the page draws. The gateway reads
  stands through a port, `Stands`, whose adapter picks the master among the folder's own entries by name
  and never makes a name into a path, as 0025 asks; a name it has none of is sent every tile empty, and a page
  that names none is sent no stands at all. The adapter keeps each tile once read and lets a master's tiles
  go when its `map.json`, written last, has been written since, so furnishing again is seen without a restart.

Wire version 13, for the frame and the field.

## Consequences

**The stands of unknown ground no longer have to reach a page.** In this first step they still do, because
the page still reads them from the public files; the log says under `stands` what the server sent, which is
how to see that it holds back. The next step draws the scenery from what the socket brings, and the one after
takes the files out of the public folder, after which nothing but the gateway can hand a page a stand.

**The server now reads the world's files.** Its adapter looks where the generator writes, the page's own
world folder, which ties a running server to a checkout the way the portraits folder does: a development
coupling, named as one. `villages.stands` points it elsewhere, which is how a worktree without a sprite map
of its own can borrow another's.

**It costs a little on the wire and nothing to speak of on the server.** A tile is 1.3 KB of records on
average and a view holds a handful, sent once. A stand deep inside revealed ground is let through at its first
circle; one far from it fails every circle's distance test at once; only those near the edge pay for the rim.

**This is the channel settlements and ruins will come through**, when they are a layer of the sprite map.

## Alternatives considered

- **Test only a stand's middle.** One point, and a stand whose middle is just off revealed ground but which
  reaches onto it would be held back, thinning the wood along every edge of what a house has seen.
- **Sample a stand's rim.** Nine points instead of one question, and a sliver between two samples is still
  missed.
- **Stands by held cell rather than by tile.** A tile is what the page reads and what the generator writes;
  cutting it to cells would send the same stand once for every cell it touches, and each cell's cut would
  need its own margin.
- **Binary frames.** A third smaller, and a change to the socket at both ends and to every test that reads
  frames as text, for tiles that are a kilobyte or two.
- **A server that knows its master.** One property instead of a field on `hello`, and Adam's Debug map
  switches masters in the page, so the server would send the wrong world's stands the moment he did.
