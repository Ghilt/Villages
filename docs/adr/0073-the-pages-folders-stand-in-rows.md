# 0073. The page's folders stand in rows

- Status: accepted
- Date: 2026-10-02

## Context

The frontend's packages are layered and held to it: `protocol` <- `client-core` <- `apps/web`, by workspace
dependencies, a compiler configuration without the DOM, and restricted imports. Inside `apps/web` nothing
said anything. The review of 2026-10-02 drew the import graph of its folders and found thirteen of the
eighteen importing each other in one ring: the connection to the game server imported the dialogues', the
figures' and the fog's wording, the scenery's stands and the map's masters; the stage the panes are laid out
in imported the game's state; the debug folder was imported by twenty-nine files to write a line of the log.

A ring of folders is a ring of reasons a change spreads. Nothing in it can be moved, tested alone, or
understood without the rest, and every mechanic added since made the ring tighter, because the nearest file
to import was always in it.

## Decision

**The page's folders stand in rows, and a folder imports only the rows above it.** In its own row it may
import only what the rule names, and no two files may import each other, however far round. The rows, from
the top:

1. `ui`, `version`, `marks`, `log`, `geometry` - what everything leans on, and which leans on nothing in the
   page. The component library is the showcase's alone until the game takes it up; `geometry` is the ground's
   own measures, the projection, the tile and the master's width, which the map, the sprites, the fog and the
   areas all mean the same thing by.
2. `net`, `stage` - the connection to the game server, and the stage the panes are laid out in.
3. `map`, `fog`, `desk` - the ground, drawn.
4. `sprites`, `room` - what stands on the ground, and the room around the desk.
5. `house`, `figures`, `choice`, `dialogues`, `areas`, `inspect` - the game's own surfaces.
6. the root, `debug`, `admin` - what puts it all together, and the instruments beside it.

`src/layers.test.ts` reads every source and holds the page to the rows. The imports that break them today are
listed in it one by one, grouped by the step of the plan that ends each, and an entry that no longer happens
fails until it is taken off. So the list can only get shorter. Tests may import what they need.

## Consequences

- An import the rows refuse says the code is in the wrong folder. The answer is to move the code down, or to
  hand it in from above, never to add an exception: the list is for what was there on the day the rule began.
- The stage is below the features rather than above them, because the features lean on it - its size control,
  its icons, the room a pane is given - and it should know none of them. A pane is handed to the stage rather
  than the stage reaching for the game.
- `debug/` is at the top, so the game cannot lean on it. Its settings that the game needs, and the log, move out
  of it; that is also what lets the panel one day be left out of a build.
- The 32 exceptions on the first day are a measure of the work, and each step of the plan that ends some takes
  them off in the same commit.

## Alternatives considered

- **ESLint's `no-restricted-imports` per folder.** It can forbid, but not list today's exceptions one by one
  and fail when one goes away, so it would either fail on day one or excuse whole folders.
- **dependency-cruiser.** A good tool, and a new one to learn and keep; the rule fits in one test beside the
  component library's own boundary test, with the same way of reading imports.
- **No rule, and care.** That is what made the ring.

## Amendment, 2026-10-02: none left

The plan that ended the exceptions is done, and the list is empty. The last six were one surface reaching
into another - an overlay on the map into the windows to open one and to know which to ring, a dialogue's
line into them to open one, the areas into them to close one - and each is now handed down from the root
instead: the overlays are handed what the map marks and what a pick does, a pane what it shows beside
itself, and a window closes itself when its area goes. Navigation and the trail stayed in `inspect/` rather
than moving into the stage as the plan had it: the trail is a list of subjects, and the stage would have
had to learn what a subject is to hold one.
