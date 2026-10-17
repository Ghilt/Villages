# 0091. The inspect pages are cordoned off from the game, and may carry their own libraries

- Status: accepted
- Date: 2026-10-11

## Context

The pages beside the game - the events, the component library, and now the architecture page - are
instruments for looking into it, not part of it. Adam, on 2026-10-11, asked for the architecture page to be a
node diagram with arrows flowing down, said a library was fine for it, *"but make sure that these inspect pages
are clearly cordoned off from the game logic"*.

Until then the cordon was a habit rather than a rule. Three of the pages were fetched with `import()`, the
events page was imported outright into the game's entry, and nothing stopped a game folder from importing an
inspect page or a package only an inspect page should carry.

## Decision

**The inspect pages live in `apps/web/src/admin/` and are held apart from the game by three rules**, which
`src/admin/boundary.test.ts` checks by name:

1. **Nothing in the game imports an inspect page**, and the entry, `main.tsx`, reaches each one only with
   `import()`. Each page is then a chunk of its own that the game's bundle does not contain. The one thing the
   entry imports outright is `admin/inspectViews.ts`, the list of pages and their addresses, which it routes
   by. `/admin` is the index of them.
2. **A library the inspect pages need is imported only there.** The first two are `@xyflow/react` 12.12.0,
   which draws cards and the arrows between them and lets the diagram be panned and zoomed, and
   `@dagrejs/dagre` 3.1.1, which lays a graph out in ranks top to bottom. Both are pinned exactly.
3. **What an inspect page takes from the game is named, folder by folder**: `net/` for the events page's
   socket, `ui/` for the component library it shows, and `figures/` for the portraits it shows. Anything else
   is a sign the page is doing the game's work.

The architecture page's data is in `admin/architecture/` beside it, and `world.test.ts` holds that data to the
repository: a `world:` script with no place on the page, a reader that moved, or a file nothing makes fails.

## Consequences

- A player's page carries none of it: a build was checked, and React Flow is only in the architecture page's
  chunk.
- An inspect page may grow heavy without the game paying for it, and may use a library the game would not.
- A new inspect page is added to `inspectViews.ts`, routed in `main.tsx` with `import()`, and listed in
  `docs/RUNNING.md`. A new reach into the game is a line in the boundary test's list, which is where it is
  argued.

## Amendment, 2026-10-17: the renders page draws with the game's own layers

The renders page, `/admin/inspect-renders`, asked for by Adam on 2026-10-17, is a square of every kind of land and of
every critter drawn as the map draws them, to verify a look on without hunting the map for it. A copy of the land,
the trees and the critters would be a second renderer that could disagree with the first, which is the one thing
such a page must not do; so it takes the sprite canvas's own layers from `sprites/`, the geometry they are placed by
from `geometry/`, and which master is drawn from `map/masters.ts`, and hands them a world of its own. Those three
folders are added to the boundary test's list. It is still an instrument: it changes nothing, and nothing in the
game imports it.
