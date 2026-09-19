# 0025. The browser picks which master it draws, and the dev server cuts it

- Status: accepted
- Date: 2026-09-04

## Context

The world is a hand-painted image (decision 0018) and terrain is drawn from tiles cut out of it
(decision 0019). Adam paints in Photoshop, and by the time he has a candidate he wants to look at, there
are several: `terrain.png`, `terrain2.png`, and a handful of experiments in the same folder.

Looking at one meant editing over `terrain.png`, running two npm commands from a terminal, and reloading.
That is three problems at once. Comparing two masters means overwriting one of them. Nothing says which
master is on the screen. And the loop from a save to a look leaves the browser, which is where decision
0023 says the verification happens.

The obvious fix - let the browser load a different image - is not available. A master is 32768 by 16384
pixels: a billion of them, over two gigabytes decoded. No page can turn one into map tiles. The tiles
have to be cut by Node, and the only Node process within reach of the browser is the dev server.

## Decision

Every master in `world/master` is a world the browser can ask for, and the dev server cuts it.

- **One directory per master.** A master's world is written to `public/world/masters/<name>/`, the
  default included. `world:import` and `world:tile` with no arguments write `masters/terrain/`, and each
  takes a master as its first argument. There is no special case for the default: loading `terrain` and
  loading `terrain2` are the same operation.
- **What counts as a master is one rule in one place**, `packages/world/src/masters.ts`, because three
  things ask: the importer, the tiler, and the dev server listing them for the browser. Any PNG in the
  folder is a master except the palette strip and the previews the importer writes.
- **The dev server has one errand**, in `apps/web/vite/worldApi.ts`: list the masters, and cut one. It is
  registered only when serving. Cutting runs the same two commands a terminal would, and every line they
  print goes down the response as it happens, so the debug log tells the story while it runs. That
  matters because the cut takes minutes, and a spinner that says nothing for minutes cannot be told from
  a hang.
- **A name that arrives from a browser is checked against the folder**, not merely sanitised, because it
  becomes a path. Only a master that is really there can be asked for.
- **Switching master reloads the page.** The map style, the traced outlines and every painter are given
  the world root as a value at startup, from one decision made in `main.tsx`. A reload is the only way to
  be sure that nothing is still holding the previous master: not the vector source, not the store of
  painted tiles, not a decoded flat tile inside a worker.
- **The panel says whether what is on the screen is current.** It shows each master's size, when it was
  last cut, and whether the image has been saved since - which it re-checks whenever the window is given
  focus, because that is exactly what coming back from an image editor looks like.

  *Amended 2026-09-19:* "the panel" here is the Debug map panel, which is no longer a card of its own.
  It is part of the one debug panel down the right-hand side, and everything above is true of it there.
  See decision record 0039.

## Consequences

The loop from a Photoshop save to looking at it is one dropdown, and comparing two masters no longer
means overwriting one. The size shown next to each name catches the likeliest mistake, which is a master
saved at the wrong dimensions.

Disk grows by a whole tile set per master cut, about sixty-five megabytes. All of it is generated,
gitignored and reproducible, and a master that is never picked costs nothing.

`public/world/` changed shape, so anything holding the old paths is wrong: the two references in the app,
and the checks in `debug-quick-start.ps1`. One re-run of the two commands, or one press of the button,
rebuilds it.

The dev server can now start a five-minute Node process holding eight gigabytes of heap. One at a time,
and it refuses a second while one is running. It is a development tool on a development machine, and it
is not registered in a build.

There is no listing in a built app, because there is no dev server there to read a directory. The panel
falls back to naming the master it is drawing and saying so, and the world is cut before a build.

## Alternatives considered

- **Cut every master up front, by a command.** Instant switching, and a few minutes per master every
  time. It keeps the terminal in the loop, which is the thing being removed.
- **Grey out the uncut ones and cut from a terminal.** Less machinery, no dev-server endpoint, and Adam
  alt-tabs after every save. Offered and turned down.
- **Load the master image in the browser.** Not possible at this size, as above.
- **Switch in place, without a reload.** `setStyle` plus a message to every painter plus clearing two
  caches. More code, more ways to be left drawing half of one world and half of another, and a reload
  costs a second.
- **A separate small server for world commands.** A second process to start and to keep alive, for
  something the dev server already has the right to do and Vite already has a plugin interface for.
