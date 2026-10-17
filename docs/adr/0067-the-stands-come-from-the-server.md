# 0067. The stands come from the server

- Status: accepted
- Date: 2026-09-27
- Builds on 0061, which said the fog of war holds the scenery back too, and on 0054, whose sprite map it sends
- Amended 2026-10-17 by 0101: a stands frame says which layer of the sprite map it carries, the scenery's or the
  ruined towns', and the gateway sends every layer of every held tile

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
  go when its `stands.json`, written last, has been written since, so furnishing again is seen without a restart.
- **The files where only the server reads them.** The generator writes a master's stands into
  `world/stands/<master>/<layer>/`, `<x>/<y>.bin` a tile and a `stands.json` written last, beside the rest of
  the world, outside the folder the page is served from and outside the frontend workspace, which is all the
  dev server's `/@fs/` will read; the biome raster and `map.json` stay where they
  were, because they say what kind of country a region is and the terrain under the haze says that already.
  The game server reads the stands there, and so do the scenery stills, which say to furnish again rather than
  draw a world with no woods in it. The dev server answers nothing under a master's `sprites/<layer>/stands/`,
  however the path is spelt, so stands an older generator left in the public folder are never served either.
- **The page keeps what it was sent, for exactly as long as the gateway thinks it was.** A tile is held while a
  cell the page follows is over it and let go when none is, by `standTilesUnder` at both ends, which
  `contracts/fixtures/stand-tiles.json` holds to the same tiles. Held longer, coming back would draw from what
  the gateway said before the fog last moved; let go sooner, the gateway would never send it again and the
  ground over it would wait for ever. A scatter cell waits for every tile it reads, as it waits for its terrain,
  and is told when each comes.
- **A tile sent again differently cuts its cells again, and nothing blinks.** Every cell cut from the old records
  is stale: one coming into view waits for its new points rather than showing the old and changing a moment
  later, and one already on the screen keeps its old points until the new are cut and then takes them, in one
  frame, at the fade it was at. On revealed ground they are the same points, because every stand that could
  change them was sent the first time.

Wire version 13, for the frame and the field.

## Consequences

**The stands of unknown ground no longer reach a page's scenery.** From the second step, 2026-09-28, the page
grows its trees from what the socket brings and from nothing else: with the fog on and a vision given, it held
44 stands in the four tiles about a seat where the sprite map has 536, and on revealed ground every tree stood
where it did with all of them, which was checked point for point, 346 of 346 inside the vision. From the
third, 2026-09-29, the files are out of the public folder, and nothing but the gateway can hand a page a
stand: for the default master the generator writes the same 3,900 tiles as before, byte for byte, only
somewhere else.

**A checkout furnished before the third step has its woods back only when it is furnished again.** Its sprite
map still has a manifest and no stands where they are read now, so the Debug map section says it is not
furnished and offers the button; the quick-start furnishes the default master itself when its `stands.json`
is missing. Furnishing also clears the stands the old generator left in the public folder. Half a minute a
master.

**No game server, no scenery.** A page with no gateway to talk to is sent no stands, so its scatter cells wait,
and the Scenery section says how many are waiting on the game server's stands. With the fog on and no house
nothing grew anyway; it is the fog lifted without a server that loses its trees.

**Trees at the edge of a long pan arrive when it ends**, with the houses, because the gateway follows the cells
the camera settles on. A tile reaches a long way past what is shown and a held cell's ring past that, so this
is only seen when one drag crosses into a tile no held cell was over.

**The server now reads the world's files.** Its adapter looks where the generator writes the stands,
`world/stands/`, which ties a running server to a checkout the way the portraits folder does: a development
coupling, named as one. `villages.stands` points it elsewhere, which is how a worktree without a sprite map
of its own can borrow another's.

**A build copies the public folder as it is.** Only the dev server refuses the old stand paths, so a folder
still holding them would ship them; the world is cut and furnished before a deployment, which there is not
yet, and furnishing clears them.

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
- **Keep every tile ever sent.** No rule at the page's end, and a tile the gateway had let go of would be drawn
  from what it said before the fog last moved, while the page held more of the world the longer it was open.
- **A server that knows its master.** One property instead of a field on `hello`, and Adam's Debug map
  switches masters in the page, so the server would send the wrong world's stands the moment he did.
