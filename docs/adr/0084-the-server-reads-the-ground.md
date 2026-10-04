# 0084. The server reads the ground

- Status: accepted
- Date: 2026-10-04

## Context

Where the player is looking is an input to a **choice roll** (0083): a roll aimed at a river should be able to
offer the river's things. But the server knows nothing of terrain. The world is a painted image, the browser
draws it from tiles, and `Gazetteer.kt` says so in as many words. The stands the server sends (0067) are
opaque to it past their position and reach. It knows where houses and characters are, and what each house's
fog hides, and nothing else about the ground.

So either the browser says what is on its screen, or the server learns to read the map. Asked on 2026-10-04,
Adam's answer was the second: **the browser sends only a coordinate and a zoom**, and the server works out the
rest.

## Decision

**Each master gets a ground map, cut by a world tool and read by the server.** `world:ground` reads a master
and what the other tools work out from it, and writes a coarse grid over the Mercator square (0030) saying of
each cell what the ground is: its terrain class, whether a river runs through it, whether it is coast, and its
biome. It is output, per worktree and gitignored, beside the stands; the quick start makes it when it is
missing, and the regeneration rule that re-cuts the tiles and the sprite map after a change to the master
re-cuts it too.

**The server reads it through a port,** as it reads the stands: a `Ground` in `application`, a folder adapter
in `app`. Nothing in the domain knows it exists.

**What the player is looking at is a circle,** its centre the coordinate the browser sent and its radius what
an ordinary window shows at that zoom. Only ground the house has revealed counts (0061), so the fog bounds a
roll exactly as it bounds what is drawn: a circle with no revealed ground in it is the omen *Unknown*.

The grid's size and what makes a thing "present" in a circle are settled by measuring, in the step that
builds it.

## Consequences

- No omen is taken on trust from a page. A player can aim a roll only by looking, which they could do anyway.
- The server gains a second picture of the world, coarser than the browser's. Where the two disagree at a
  cell's edge, the server's is the one that counts, and it is the one nobody sees.
- Another generated file a fresh worktree has to make before it can serve a full roll. A server without it
  still rolls, with no map omens but the houses and characters it already knows.
- Everything later that needs to know what the ground is - scenery near a seat, where a character can walk,
  what a holding is made of - has somewhere to ask.

## Alternatives considered

- **The browser says what is on screen.** Cheapest, and it already draws all of it. Lost because every map
  omen would be the page's word; a cheater could aim at anything, and the server would be trusting a page
  for the first time.
- **The server reads the master itself, at full size.** Exact, and hundreds of megabytes held in memory to
  answer a question that a few thousand cells answer as well.
- **The stands' biome bytes.** The server already has them, and they say what grows, not where the rivers and
  coasts are; they cover only ground with scenery on it.
