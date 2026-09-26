# Villages - working notes for Claude

Villages is an exploratory, persistent, multiplayer experience: each player plays a fictional noble house on a map of
the real world. Gameplay is discovered by experiment. The architecture keeps change cheap and is designed for tens of
thousands of concurrent players in one shared world.

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
   proposed commit message. Do not commit. End it with the **verify checklist**, below.
7. **Commit on Adam's word, immediately,** then say what landed. One "commit" is the approval; asking for it
   again is the failure, not the caution.
8. **Offer the next steps and stop again.** Two to four concrete options, each a sentence or two on what it
   would produce and what it would cost, with a recommendation and the reason for it. Say plainly what is
   blocked and on what. Always leave room for a fifth answer that is none of them, because the point of the
   options is to give Adam the wheel, not to make him pick from a menu.

**A button is a mark or it is words, and which one is Adam's call.** When he asks for a button, ask
which before drawing it, and do not guess from what is beside it. The two are different things: a mark
has to be learnt once and then costs nothing, and a word costs nothing to learn and then has to keep
fitting - in a 44-pixel strip, in a column squeezed to 18rem, in a language nobody has thought about yet.
Guessing wrong is cheap to fix and it is still drawing it twice. The same question, once, is not.

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
- **Re-works the sprite map** if the master, `world/biomes.json` or the generator changed:
  `npm run world:sprites --prefix frontend`, half a minute a master, and it prints the density of every
  biome against experiment 0006's ceiling. Without one a master draws no scenery at all.
- **Re-renders the scenery stills** after that, `npm run world:scenery --prefix frontend`, half a
  minute, because a sprite map that changed and a still that did not is the stale-evidence trap in its
  purest form. Say which places moved and by how much: the counts are printed beside every picture.
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


## End every stop with a verify checklist

Whenever the loop comes back to Adam to look at something, **the last thing written is a checklist of at
most three things to check**, and nothing comes after it. Not the summary, not the commit message, not an
offer of next steps: those go above it, because the checklist is what he reads first and acts on.

**Three at most, whatever the size of the commit.** It is there to refresh a memory, not to enumerate a
diff. A checklist with one item a changed file is a checklist nobody reads, and a twenty-line change and a
two-hundred-line one get the same three items, picked for what would be embarrassing to have got wrong.

**Mark with an eye, 👀, every item he can check by looking at the running program**, and say in the item
where to look - which pane, which button, what should be there. An unmarked item is one he has to take on
trust, read in a document, or accept from a test. **The marked ones go first**, because looking is cheaper
than reading and it is the check that actually catches things; where there are three and one of them can
be seen, that one is the first line.

**A step with nothing to look at says so, and that is an answer rather than a failure.** The offline
renderer, a build rule, a domain rule with no caller yet: none of them can be seen, and three honest
unmarked items beat one marked item invented to fill the quota. Say in one line what stands in for it -
the test, the still, or the number.

**Immediately above it goes where to look**, and only that:

- **The running program**: the address with its port, this tree's own, and nothing else on the line.
- **Documents**: links to them, when what there is to verify is something to read rather than run.

One or the other, not a paragraph explaining either.

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
- **Each tree serves on its own pair of ports**, a hash of its directory name, so several can run at once
  and a tree's address never moves. The main checkout keeps 5173 and 8080; a worktree's game server sits
  three thousand above its dev server, so 5548 serves the page and 8548 serves the world, and the page
  connects to its own tree's world without being told to. A backend on somebody else's port was how a
  branch's events quietly ended up in another branch's store.
  `node frontend/apps/web/vite/worktreePort.ts` prints this tree's, `--game` the game one; `--launch` also writes
  `.claude/launch.json`, which is generated rather than committed because every field in it is
  per-checkout. `debug-quick-start.ps1` does both and prints the address. The **Worktrees** section of the
  debug panel says which trees exist, which are serving, and which one you are looking at, with each
  one's branch and port. See decision 0031.
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

Before adding or changing a mechanic, read `docs/MECHANICS.md`, which says what the mechanics are, one
entry per named mechanic, and then `docs/BUILDING-A-MECHANIC.md`, which says how a mechanic Adam describes
becomes commands, events, frames, projections and panel lines, so that he does not have to say it each
time.

## Every document has one purpose, and only what fits it goes in

Each persistent document opens with a line saying what belongs in it and what does not. That line is the
rule, not a decoration: material that does not fit moves to the document that owns it rather than being
added where it was convenient. A mechanic goes in `MECHANICS.md` and not in `SETTING.md`; the engine behind
it goes in `ARCHITECTURE.md` and not in either; what it looks like goes in `LOOK-AND-FEEL.md`; how it
behaves on a phone goes in `RESPONSIVE-DESIGN.md`; when it will be built goes in `ROADMAP.md`. A document that is about everything is read by nobody, and a claim in the
wrong place is a claim nobody maintains. If a thing genuinely fits nowhere, that is a new document with its
own purpose line, and saying so is part of presenting the step.

## Layout

```
CLAUDE.md  README.md  debug-quick-start.{ps1,cmd}  .claude/settings.json  scripts/check.{ps1,sh}
docs/       VISION SETTING MECHANICS LOOK-AND-FEEL RESPONSIVE-DESIGN GLOSSARY ARCHITECTURE ROADMAP
            TESTING EVENTS BUILDING-A-MECHANIC AUTHORING-THE-WORLD AUTHORING-THE-ART, adr/, experiments/,
            plans/
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
  fixtures in `contracts/fixtures/`. It also has a version, and the version has a recording: change a frame or a field
  and `PROTOCOL_VERSION` goes up at both ends and `contracts/protocol-v<n>.txt` is written beside the old ones, or two
  tests stay red. That is what makes a server older than the page say so at the handshake instead of later and worse.
  See decision record 0037.

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
  their tails, `-WebOnly` skips the game server, `-NoBrowser` leaves the browser alone. **A port held by
  anything that is not this checkout's current server is taken**: another tree's, or one started before
  the code it serves was written. Launching it from a checkout means "show me this checkout", and the
  ports are per-tree now so taking one back cannot take anyone else's world with it (0031, 0037). It ends
  with every Villages server on the machine listed, whichever tree started it and how long it has been up.
  Double-clicked, the window stays open and is the servers: `q` stops both, `l` tails the logs, closing it
  leaves them running. This is how
  Adam runs the program without an agent in the loop, so it stays true: a step that adds a server, a
  generated file or a prerequisite adds it there in the same commit.
- Frontend, once: `npm install --prefix frontend`
- The world: `npm run world:import --prefix frontend` traces the coast and the large lakes, and
  `npm run world:tile --prefix frontend` cuts the terrain into map tiles. Both read the hand-painted
  master in `world/master/` and take another as their first argument; each master's world is written to
  `public/world/masters/<name>/`, the default included. Terrain is drawn from tiles rather than outlines;
  see `docs/adr/0019`. What it is painted in is `world/palette.json`, what colour it is drawn in is
  `world/render.json`, and how it is painted is `world/painterly.json`.
- Which world is drawn: the **Debug map** part of the debug panel, down the right-hand side. Its terrain
  dropdown is every PNG in
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
- What it looks like: the renderer dropdown in that same panel. `Biome` is not a look and not even the
  terrain: it lays the sprite map's own biome raster on the world, flat and blocky, which is the only way
  to review a biome without the scenery standing on it in the way. `Raw` is the flat
  tiles as cut; the rest are painted in the browser, tile by tile, by the same functions that paint
  the stills. `Vivid` is the odd one: it draws the master's own colours out of `world/palette.json`
  rather than the quieter ones out of `world/render.json`, saturation pushed, with the whole medium
  turned off. It is the view to check a master against the file it was painted in, and it is two
  numbers in `world/painterly.json` rather than a look. Only the terrain is precomputed: a tile knows its own zoom, so the treatment is drawn at the
  size it should be at whatever you are looking at. Painting happens in a pool of workers, and the tiles
  around the view are painted during the pauses so that moving the map finds them done. See
  `docs/adr/0021` and `0022`.
- What the program thinks is happening: the debug panel, one space docked down the right-hand side
  holding everything that helps during development, which minimises to a badge and remembers that.
  **It takes room from the game rather than floating over it.** What is left is the **stage**, the box
  the player's interface is laid out in and the only thing a player would ever see; two grips resize it,
  and the toggle in the very top right confines it to a phone, which is how to check that a mechanic
  reads at both shapes without a second monitor. See `docs/adr/0039` and `docs/RESPONSIVE-DESIGN.md`.
  It is the log and the buttons; the block of state above them went on 2026-09-16
  because Adam never read it, and what it used to say every four hundred milliseconds is now said once,
  when it changes, as a line of the log. Its copy button puts the log on the clipboard, which is the
  shortest way to tell a session what the program is doing. So a change that wants to be seen there says
  so with `note(area, message)` rather than by adding a row. **Everything in it is in a folding section,
  and a step that puts something there says which section - and asks when that is not obvious from what
  Adam said, rather than picking one.** Today they are Worktrees, Debug map, Scenery, Camera, Areas, World, Resources, Characters and Log. The events themselves are not in the
  panel: they are at **`/admin/inspect-events`**, a page of their own that watches the world without
  playing in it, one line an event opening to the whole thing as the store holds it. The `found a house here` button in it sends a
  real command and is how to make an event happen on purpose. The `restart` button beside `copy` forgets
  this browser's player and reloads, so the opening can be tried again from nothing; the house the old
  player founded stays in the world, because events are never deleted. `wipe` beside it empties the world
  for everyone connected to it, and every window reloads and arrives anew. See `docs/adr/0036`.
  Anything worth saying
  goes through `note(area, message)` in `apps/web/src/debug/log.ts`, and worth saying is the bar: moving
  the camera about writes nothing, and the cells a move brought back are counted and said in one line
  only when they carried something. `window.villagesPainterly()` gives the paint counters from a console.
- The player's own levers: the bar along the bottom of the house card, in the corner. The eye is the
  first place in it and five stand empty. Open, the player's own seat stays drawn however far back the
  camera goes and the ground about it is drawn below the zoom where everyone else's begins; theirs and
  nobody else's, so the world still thins out with distance. It costs nothing on the wire, because a
  player's own house already reaches them wherever they are looking. See `docs/adr/0038`.
- The fog of war: `fog of war: on` in the Debug map section, on at every page load, and pressing it turns
  the fog off for that window. A house sees from **vision points** - its seat, and each key figure standing
  on the map, a circle of 34 km around each - and the server works them out and sends them as `yourSight`;
  the log says what gives vision under `sight`. `give vision here`, under the switch, gives the house a circle
  where the camera is looking until its `take it away` is pressed; both are real commands. The fog covers the
  world and not the signs: every icon, the offered seats and whatever stands in vision are drawn over it. Unknown ground is under a dark haze, revealed ground is washed
  grey, vision is clear. With no house the whole world is hazed. The server holds back what the fog hides:
  a player is sent the houses on revealed ground and the people in vision, and their own wherever they are,
  and `fog of war: off` lifts that too, for that window. The edge has surface tension: circles closer than
  about 56 km are seen across and notches are rounded off, drawn and held back alike, `Vision.SURFACE_TENSION`.
  See `docs/adr/0061`, `0062`, `0063`, `0064` and `docs/plans/fog-of-war.md`.
- Looking at a whole world at once: `see everything`, in the debug panel's World bar beside `seed 20`.
  A house is founded at significance 20, so it reaches a page only from zoom 8 in, and pulling back past
  about z7.5 empties the map because the gateway stopped sending rather than because anything is hidden.
  This sets significance aside for this connection and takes the renderer's distance floor off with it.
  Adam's switch, not a player's.
- Areas, in the same panel: `draw an area` arms the next drag on the map, and dragging paints one. The
  ends join themselves and escape stops. Click an area to select it, which makes its line pulse and lists
  how many master pixels of each terrain it encloses; `shade`, `recount` and `delete` are beside it. The
  boundary runs between painted pixels rather than through them, so at z10 on the `raw` renderer it lines
  up with the squares the terrain is drawn as. Areas live only in the browser and a reload forgets them.
  See `docs/adr/0032` and experiment `0002`.
- Key figures, in the same panel: the **Characters** section. `add a key figure` rolls a newcomer and
  the house takes them in, nine at most, and it is the only way a character comes into the world. Each
  figure has `up` and `down` for every stat, `ten years older`, `ten years younger`, `another portrait`,
  `put them here` (where the camera is looking; drawn from about camera zoom 8.5 in), `take off the
  map` and `kill`, every one a real command: the asking and the answer are lines of the log under
  `characters`, and what changed is a third; a move is a fourth, under `cells`, naming who arrived. The stat levers stay pressable at one and at twenty, so a
  refusal is seen rather than guessed. The events are at `/admin/inspect-events`. See `docs/adr/0055`.
- What grows where: `world/biomes.json`, hand-edited, one entry a kind and one a biome. What reads it is
  `npm run world:sprites --prefix frontend`, which works out a biome for every sixteen world units and
  where the scenery clumps, and writes a **sprite map** beside the cut tiles - about five megabytes and
  half a minute a master. It takes a master's name as its first argument (`-- terrain2`). **A master
  with no sprite map draws no scenery**, which is the rule rather than a fault. The Scenery section of
  the debug panel says what the sprite map asked for and what the browser did with it. The **Debug map**
  section has a `furnish it again` button beside `cut it`, and `cut it` furnishes too - a repaint makes
  both stale. The panel also watches `world/biomes.json`'s own mtime, because tuning a look makes every
  sprite map stale without touching a master. See `docs/adr/0054` and
  `docs/plans/biome-sprite-map.md`.
- A picture of the scenery, without a browser: `npm run world:scenery --prefix frontend` paints five
  places at the zoom the scenery is actually in and stamps every point the sprite map asks for onto
  them, into `world/painterly/<place>-scenery.png`, half a minute for all of them. It prints each one's
  marks, its density against the ceiling, and its biome and kind mix. **They are marks, not
  silhouettes**: the shapes are drawn in Pixi and this is the generator's answer, not the map's. `-- --at
  lng,lat` looks anywhere, `-- --view alps` at one of them, `-- --zoom 10.4` closer, `-- --style flat`
  without the paint, `-- --spacing 0` without the spacing that keeps trees off each other (two, three to
  see more of it). This is what a change to `world/biomes.json` is argued from.
- Sprites: `world/sprites/` is Adam's folder, committed as the master is: `scenery/<kind>` for every
  kind in `world/biomes.json` and `marks/<name>` for every mark. Any PNG, WebP or JPEG, any size, on a
  flat background or a transparent one. **Saving over a placeholder replaces it**, and with the dev server
  running the picture is on the map about a second later with no reload, because the server cuts the
  folder again whenever a picture in it is saved and tells the page. By hand that is
  `npm run world:art --prefix frontend`, two seconds: it keys, trims, stands and shrinks every picture into
  one atlas in `public/art/`, prints a line a sprite, and writes a contact sheet of them at the sizes they
  are drawn to `world/painterly/art-sheet.png`. `-- --placeholders` draws a placeholder for every sprite
  that has none and never draws over a file that is there. **No art, no scenery**, and the dev server cuts
  it on start in a tree that has none. Only the scenery is drawn from the folder so far; the marks are
  placeholders waiting on a decision about house colours. See `docs/AUTHORING-THE-ART.md` and `docs/adr/0059`.
- Portraits: `world/portraits/` is Adam's folder, committed as the master is. Upright PNGs, three by
  four and at least 768 wide, each named for whom it suits, `woman-01.png` or `man-01.png`; the name
  without `.png` is the key a character keeps for life. **Saving over a placeholder replaces it and
  saving a new name adds one**, with no list to edit. `npm run world:portraits --prefix frontend` draws
  the cut-paper placeholders, two seconds, and **never overwrites a file that is there**: delete one to
  have its placeholder back. A test holds the folder to these rules. The dev server serves the folder
  at `/portraits/` with no cache, so a picture saved over another is the one drawn on the next reload,
  and the Characters section's `another portrait` picks one from whatever is there. See
  `docs/plans/characters-and-key-figures.md`.
- The styles live in `world/painterly.json`. A group in one may carry a `handOver`, which is where its
  treatment gives way to the scenery standing on the same ground: whole far out, mostly gone by the zoom
  the trees are all in, keeping a third of itself so a wood is not bare between them. It is the far end
  of 0051's handoff, named as unfinished in 0006 and 0052 and done in 0054.
  `npm run world:paint --prefix frontend` paints every view in
  every style into `world/painterly/`, flat once and then once per style, and writes the runtime copy the
  app reads. `-- --view alps`, `-- --style woodblock` for one of them; `-- --config-only` writes just the
  runtime copy, in a second, which is all the app needs after a style edit.
- Frontend, look at it: `npm run dev --prefix frontend`, then open the address it prints. That is
  http://localhost:5173 in the main checkout and a port of its own in each worktree; see decision 0031.
- Frontend, checks: `npm run check --prefix frontend` (typecheck, lint, format, unit tests)
- Backend, running: the `backend` entry in `.claude/launch.json`, which carries this tree's port; by hand it is
  `cd backend` then `./gradlew :app:bootRun --args=--server.port=<this tree's game port>`. The gateway is a
  WebSocket at `ws://localhost:<that port>/ws`, 8080 in the main checkout; the web app connects to its own
  tree's on load, or to `VITE_GATEWAY_URL` when that is set. Everything is in memory until MongoDB exists, so
  nothing survives a restart, on purpose.
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
