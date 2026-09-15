# Villages - working notes for Claude

Villages is an exploratory, persistent, multiplayer experience: each player plays a fictional noble house on a map of
the real world. Gameplay is discovered by experiment. The architecture keeps change cheap and is designed for tens of
thousands of concurrent players in one shared world. The startup plan that produced this layout is in
`docs/plans/2026-09-01-startup-plan.md`.

## The one hard rule: a human vets every change before it is committed

- Never run `git commit`, `git push`, `git rebase` or `git tag` unless Adam has approved the specific change set in
  the current conversation turn (he reviews the working tree and says "commit").
- Before asking for approval, present: what changed and why, the list of files, the test output, and which documents
  were updated.
- One commit per increment. Conventional Commits with these scopes: `domain`, `application`, `occurrent`, `rabbit`,
  `projections`, `gateway`, `protocol`, `web`, `client-core`, `docs`, `infra`, `build`. End every commit message with
  the `Co-Authored-By` trailer.
- **His word is the whole of the approval, and it is given once.** When Adam says commit, commit: do not ask
  again, do not restate the change set for a second confirmation, and do not wait for anything else. Saying it
  twice is not a safeguard, it is a tax, and the safeguard is that nothing is committed until he has said it at
  all. The same goes for a rebase or a push he has asked for in that turn.
- No amends, force pushes, hard resets, or history rewrites without explicit approval.
- `.claude/settings.json` is where the harness half of this lives. It denies force pushes, hard resets and
  `git clean` outright, prompts on `git push` and `git tag`, which are rare and hard to undo, and allows
  `git commit` and `git rebase`, so that Adam's word in the conversation is the only gate on them. Adam made
  those entries by hand, because an agent may not edit its own permission rules. This file states the rule
  in words so it survives tooling changes.

## Working agreement

This is a loop, and Adam holds both ends of it: he approves what lands, and he chooses what comes next.

1. **Agree the step.** State it in one short paragraph, what and why and which files, before touching code.
2. **Build it small.** One coherent step per commit: a module skeleton, a document, one test with its
   implementation. If it grows past a few hundred lines, it was two steps.
3. **Verify it.** Run the checks, and for anything visible, look at it in a browser and say what you saw. Report
   what failed, including the things you had to fix on the way. Adam verifies through the debug panel, not
   through code, so whatever the step makes the program do must show there; see decision record 0023.
4. **Hand it over ready to look at, not ready to build.** Regenerate whatever the change made stale and leave
   the program running, before asking for review. See below: this is not optional and it is never an option
   on the menu.
5. **Documents travel with it.** A change to a decision, an event or a term updates its document in the same
   commit: a decision record, the event catalogue, the glossary, the architecture.
6. **Present it for review and stop.** A summary, the file list, the check output, the documents touched, and a
   proposed commit message. Do not commit.
7. **Commit on Adam's word, immediately,** then say what landed. One "commit" is the approval; asking for it
   again is the failure, not the caution.
8. **Offer the next steps and stop again.** Two to four concrete options, each a sentence or two on what it
   would produce and what it would cost, with a recommendation and the reason for it. Say plainly what is
   blocked and on what. Always leave room for a fifth answer that is none of them, because the point of the
   options is to give Adam the wheel, not to make him pick from a menu.

Never choose the next increment alone, and never chain increments together to save a round trip. The roadmap is a
menu, not a queue: its order is a suggestion, and Adam reorders it freely. When an option is not on the roadmap
but is clearly better, offer it anyway and say why.

## Adam paints the master. Everything else derived from it is the agent's to regenerate

The division of labour is this: Adam edits `world/master/terrain.png`, and picks the numbers that are matters of
taste. Everything that a tool can rebuild from those, an agent rebuilds, without being asked and without offering
it as a choice. He should never be handed a change whose evidence he has to generate himself.

So when a step changes the master, the palette, the render colours, the style file, or any code the paint or the
tiles go through, that same step **also**:

- **Re-cuts the tiles** if the master or the tiling changed: `npm run world:import --prefix frontend` then
  `npm run world:tile --prefix frontend`. About five minutes. The Debug map panel offers this per master too.
- **Re-paints every view in every style**: `npm run world:paint --prefix frontend`. About four minutes for all of
  them, and it also writes the runtime `paint.json` the app reads. After only a style edit,
  `-- --config-only` is a second and is all the app needs.
- **Says what moved.** Not "re-painted" but which views changed and by how much, and a before-and-after of the
  worst one. A number and a picture, because a look cannot be reviewed from a claim.
- **Re-tunes, or says plainly why not.** If the change altered what a style number means, the numbers are now
  wrong and saying so is not enough. Either propose new ones with the pictures to argue them, or state in one
  sentence that the judgement is Adam's eye and what to look for. Never leave a stale still and a tuning job on
  the menu as though it were an optional extra.

Stale output is worse than missing output, because it looks like evidence. A still painted by the previous rules
is not a preview of anything.

## Leave the program running, and say where to look

A step is not ready for review until Adam can see it. Reaching the end of the work is not the end of the step: the
last thing an agent does before presenting is put the running program in the state that shows the change, and say
in one line where to look and what should be there.

- **Start the dev server** through the `web` entry in `.claude/launch.json`, not from a shell.
- **Drive it to the place the change shows** — the right renderer, the right master, the right part of the world,
  the right zoom — rather than leaving it on whatever it opened with, and say so: the address, and what is on the
  screen at it.
- **Copy the debug panel** into the presentation when the change is one the panel reports, because that is the
  instrument Adam reads; see decision record 0023.
- **Start it in this tree, not somebody else's.** Every worktree serves on its own port now, so there is
  no excuse for reviewing a change in a tree that does not contain it. If a port is taken anyway, do not
  stop the server holding it: it belongs to another session. Say so.

Where a change genuinely cannot be seen in the running program — the offline renderer, a build rule, a document —
say that plainly and say what stands in for it instead, whether that is a test, a still, or a number.

**The browser pane stops animation frames when it is hidden**, and MapLibre waits on one for its style to
load and for every `flyTo`. A hidden pane therefore shows a map that never finishes loading and a camera
that reports itself moving while standing still, neither of which is a bug in the program. A screenshot
pumps one frame, so a handful of them in a row carries a flight to its end; the DOM, the debug panel and
the log can be read without any of that.

## Every session works in its own git worktree

An agent does not work in `E:\Code\Villages` itself. Each session gets a worktree under
`.claude/worktrees/<name>/`, which is a full checkout of the tree on its own branch, so several sessions
edit the same files at once without seeing each other's half-finished work. Adam's own checkout, the one
he paints the master in, stays the main one.

What follows from that, and bites in practice:

- **Run everything from the worktree root**, never from the main checkout, and never `cd` out of it.
- **`world/master/*.png` is per-worktree.** A master Adam saves in the main checkout is not in the
  worktree until the worktree is refreshed from it. Say which one was read when it matters.
- **`world/painterly/`, the cut tiles under `frontend/apps/web/public/world/`, and `.logs/` are output
  and per-worktree.** They are gitignored, they do not travel with a branch, and a worktree that has
  never cut them cannot serve a map. Junctioning the main checkout's tiles into the worktree is the cheap
  way to get a map up without a five-minute recut. So is `frontend/node_modules`: a fresh tree needs
  `npm install --prefix frontend` once before anything in it runs.
- **Each tree serves on its own port**, a hash of its directory name, so several can run at once and a
  tree's address never moves. The main checkout keeps 5173.
  `node frontend/apps/web/vite/worktreePort.ts` prints this tree's; `--launch` also writes
  `.claude/launch.json`, which is generated rather than committed because every field in it is
  per-checkout. `debug-quick-start.ps1` does both and prints the address. The tab strip across the top of
  the page says which trees exist, which are serving, and which one you are looking at. See decision 0031.
- **The stash stack is shared with every other worktree.** Never bare `git stash`; a WIP commit on the
  session's own branch is safer, because a pop can take another session's work.
- **`.sessions/` is the main repository's, not the worktree's** - it sits beside the shared `.git`, which
  is what makes it the one place every session can see. See decision record 0020.

## Say what you are working on, while you are working on it

Before touching code, write `.sessions/<date>-<slug>.md` saying what this session is doing and which parts of the
tree it is touching, and read the other files in that directory first. Keep the areas current as they change, and
delete the file when the work lands. More than one agent may be working at once, and the point is that a collision
is visible before it happens rather than discovered in a merge. `.sessions/README.md` has the shape and the
reasoning; the directory is gitignored on purpose.

Definition of done for a step: it compiles, the checks are green, the documents that describe it are updated,
glossary terms are used verbatim, no layer rule is violated, everything the change made stale has been
regenerated, the program is running on the thing that changed, and whatever it makes the program do can be seen
in the debug panel.

Read `docs/ROADMAP.md` under "Now" at the start of a session, and the last few commits, to see where things
stand.

Before adding or changing a mechanic, read `docs/MECHANICS.md`. It says how a mechanic Adam describes
becomes commands, events, frames, projections and panel lines, so that he does not have to say it each
time.

## Layout

```
CLAUDE.md  README.md  debug-quick-start.{ps1,cmd}  .claude/settings.json  scripts/check.{ps1,sh}
docs/       VISION GLOSSARY ARCHITECTURE ROADMAP TESTING EVENTS MECHANICS, adr/, experiments/, plans/
contracts/  fixtures/*.json shared by the Kotlin and TypeScript protocol tests
infra/      docker-compose.yml (MongoDB replica set, RabbitMQ)
backend/    Gradle multi-module: domain, application, protocol, infrastructure-occurrent, infrastructure-rabbit,
            projections, gateway, app, arch-tests, load-bots
frontend/   npm workspaces: packages/protocol, packages/client-core, apps/web
```

## Layer rules

Enforced by Gradle module edges plus ArchUnit on the backend, and by npm workspace dependencies, a DOM-free tsconfig
and ESLint restricted imports on the frontend.

- Backend: `domain` <- `application` <- {`infrastructure-occurrent`, `infrastructure-rabbit`, `projections`,
  `gateway`} <- `app`. `domain` depends on nothing but the Kotlin stdlib. `application` depends only on `domain` and
  owns the ports. Only `app` has `@SpringBootApplication`.
- Frontend: `packages/protocol` <- `packages/client-core` <- `apps/web`. `client-core` never imports React, the DOM,
  MapLibre or Pixi; the socket is an injected interface.
- The WebSocket protocol is a shared contract: Kotlin types and TypeScript (zod) schemas, both tested against the same
  fixtures in `contracts/fixtures/`.

## Event sourcing conventions

- One stream per house: `house:<uuid>`. CloudEvent type `villages.<aggregate>.<event>.v<n>`. Every event type is
  listed in `docs/EVENTS.md`; a test fails if code and catalogue disagree.
- Pre-alpha: the event store may be wiped on a breaking event change. Record every wipe in `docs/experiments/`.
  After the world-persistence milestone, only versioned types with upcasters.
- Resources are rate-based: the server declares `{amount, ratePerSecond, asOf}` and emits events only on change;
  clients interpolate. No tick events.
- Domain errors are a sealed exception hierarchy thrown from `decide`.

## How to run

Prerequisites: Node 24, and a JDK on the path for the server. Any recent one will do, because the
Gradle toolchain fetches the 21 it compiles with; the machine's `JAVA_HOME` is on Temurin 17 and that
is fine. Docker Desktop is needed by increment 0.4 and not before: the event store and the broker are
in memory behind their ports until then.

All the commands below are run **from the repository root**, `E:\Code\Villages`. The `--prefix frontend`
part is what points npm at the frontend workspace, so running them from inside `frontend/` looks for
`frontend/frontend` and fails. From inside `frontend/` drop the prefix: `npm run world:import`.

Commands are added here as the increments land:

- Everything, from a cold machine: `.\debug-quick-start.ps1` from the repository root, or
  `debug-quick-start.cmd` on a double click from Explorer. It checks the tools, generates whatever part
  of the world is missing, starts the game server and the dev server hidden with their output in
  `.logs/`, waits until both ports answer, and prints the address. `-Stop` stops both, `-Logs` prints
  their tails, `-WebOnly` skips the game server, `-NoBrowser` leaves the browser alone. This is how
  Adam runs the program without an agent in the loop, so it stays true: a step that adds a server, a
  generated file or a prerequisite adds it there in the same commit.
- Frontend, once: `npm install --prefix frontend`
- The world: `npm run world:import --prefix frontend` traces the coast and the large lakes, and
  `npm run world:tile --prefix frontend` cuts the terrain into map tiles. Both read the hand-painted
  master in `world/master/` and take another as their first argument; each master's world is written to
  `public/world/masters/<name>/`, the default included. Terrain is drawn from tiles rather than outlines;
  see `docs/adr/0019`. What it is painted in is `world/palette.json`, what colour it is drawn in is
  `world/render.json`, and how it is painted is `world/painterly.json`.
- Which world is drawn: the **Debug map** panel at the top right. Its terrain dropdown is every PNG in
  `world/master/`, with each one's size and when it was last cut, and it says when the image has been
  saved since - which it re-checks whenever the window is given focus. A master nobody has cut yet gets
  a button, and pressing it runs those same two commands from the dev server with their output going
  into the debug log: about five minutes, once per master. Switching reloads the page on purpose. So the
  loop is: paint, save, alt-tab, pick it. See `docs/adr/0025`.
- The 4.4 GB the world is built from lives in `world/source/`, not committed:
  `npm run world:fetch-all --prefix frontend` fills it from nothing, and `-- --list` says what each source
  is for. The generator is `world/master/experiment/tools/build.mjs`; two minutes for the whole world.
- The older thirteen-class path, `world:fetch` and `world:master`, is stale and says so when run. It
  refuses to overwrite a hand-painted master and writes alongside; the merge script replays hand edits. `world:build` warps Earth into raw material for
  a different starting point.
- What it looks like: the renderer dropdown in that same panel. `Raw` is the flat
  tiles as cut; the rest are painted in the browser, tile by tile, by the same functions that paint
  the stills. `Vivid` is the odd one: it draws the master's own colours out of `world/palette.json`
  rather than the quieter ones out of `world/render.json`, saturation pushed, with the whole medium
  turned off. It is the view to check a master against the file it was painted in, and it is two
  numbers in `world/painterly.json` rather than a look. Only the terrain is precomputed: a tile knows its own zoom, so the treatment is drawn at the
  size it should be at whatever you are looking at. Painting happens in a pool of workers, and the tiles
  around the view are painted during the pauses so that moving the map finds them done. See
  `docs/adr/0021` and `0022`.
- What the program thinks is happening: the debug panel, under the Debug map panel, minimises to a chip
  and remembers which. It shows the renderer, the zoom against the zoom of tiles being asked for, how far
  the terrain is being stretched past the depth it was cut at, how much ground a pixel covers, whether the
  sheet covers the view or how much of it lies on the desk and where the floor the camera may pull back to
  is, how many painted tiles were ready before the map asked, and every event the world stores as it
  arrives, one line each, opening to the whole thing. Its copy button puts the state and the log on the clipboard, which is
  the shortest way to tell a session what the program is doing. The events themselves are not in the
  panel: they are at **`/admin/inspect-events`**, a page of their own that watches the world without
  playing in it, one line an event opening to the whole thing as the store holds it. The `found a house here` button in it sends a
  real command and is how to make an event happen on purpose. The `restart` button beside `copy` forgets
  this browser's player and reloads, so the opening can be tried again from nothing; the house the old
  player founded stays in the world, because events are never deleted. `wipe` beside it empties the world
  for everyone connected to it, and every window reloads and arrives anew. See `docs/adr/0036`.
  Anything worth saying
  goes through `note(area, message)` in `apps/web/src/debug/log.ts`. `window.villagesPainterly()` gives
  the paint counters from a console.
- Areas, in the same panel: `draw an area` arms the next drag on the map, and dragging paints one. The
  ends join themselves and escape stops. Click an area to select it, which makes its line pulse and lists
  how many master pixels of each terrain it encloses; `shade`, `recount` and `delete` are beside it. The
  boundary runs between painted pixels rather than through them, so at z10 on the `raw` renderer it lines
  up with the squares the terrain is drawn as. Areas live only in the browser and a reload forgets them.
  See `docs/adr/0032` and experiment `0002`.
- The styles live in `world/painterly.json`. `npm run world:paint --prefix frontend` paints every view in
  every style into `world/painterly/`, flat once and then once per style, and writes the runtime copy the
  app reads. `-- --view alps`, `-- --style woodblock` for one of them; `-- --config-only` writes just the
  runtime copy, in a second, which is all the app needs after a style edit.
- Frontend, look at it: `npm run dev --prefix frontend`, then open the address it prints. That is
  http://localhost:5173 in the main checkout and a port of its own in each worktree; see decision 0031.
- Frontend, checks: `npm run check --prefix frontend` (typecheck, lint, format, unit tests)
- Backend, running: `cd backend` then `./gradlew :app:bootRun`, or the `backend` entry in `.claude/launch.json`. The
  gateway is a WebSocket at `ws://localhost:8080/ws`; the web app connects to it on load, or to
  `VITE_GATEWAY_URL`. Everything is in memory until MongoDB exists, so nothing survives a restart, on purpose.
- Backend, checks: `cd backend` then `./gradlew check`. Gradle fetches the JDK 21 the toolchain asks for, so
  `JAVA_HOME` may stay on the Temurin 17 that is installed; the first run downloads it. Every module's
  `build.gradle.kts` declares only its allowed dependency edges, and `buildSrc` holds the one convention
  they share. Versions live in `backend/gradle/libs.versions.toml`.

The two below do not exist yet. They arrive with the increments named, and `infra/` and `scripts/` in the
layout above are where they will go rather than where they are.

- Infra: `docker compose -f infra/docker-compose.yml up -d` (increment 0.4)
- Everything: `scripts/check.ps1` or `scripts/check.sh` (0.14)

The dev server is also registered in `.claude/launch.json` under the name `web`, so the preview tooling can start
it directly. Restart it rather than trusting hot reload after a file has been rewritten wholesale: Vite reports a
missing export that is plainly there. TypeScript is pinned below 7 on purpose; see `docs/adr/0015`.

Setting `VITE_MAP_STYLE_URL` swaps our world for someone else's map, which is how to compare against the real
Earth.
