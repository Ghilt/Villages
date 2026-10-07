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
- **"Looks good, continue" is the word too**, and so is "good, continue": Adam's standing answer of
  2026-10-01. Either means commit the change set he has just reviewed, then go on to the next step. Anything
  else without "commit" - "looks good" alone, a question - is not approval.
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

**A component is seen at `/admin/inspect-ui-components` before it is used.** Whatever the player is shown
is built from the component library in `frontend/apps/web/src/ui/`: a pane is a **container** named by a
**recipe** - a border, a fill, its embellishments - and never a stylesheet of its own. A component the
library lacks is added to it first, in its own commit, and shown on that page in every variant and state;
only then is it used. A step that adds or changes one points its verify checklist at that page, and says
which pictures in `world/ui/` it reads, the size to paint each at, and which are still placeholders. The
placeholders are the agent's to make, copied from the moodboard; Adam replaces them when he chooses and
nothing waits on him. See `docs/UI-COMPONENTS.md` and decision record 0068.

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
- **Re-works the rivers' flow** if the master or the flow tool changed: `npm run world:flow --prefix frontend`,
  under a minute a master. Without it a master's rivers stand still; `cut it` in the panel does it too.
- **Re-works the origin map** if the master changed: `npm run world:origin --prefix frontend`, two minutes a
  master. It says where on Earth each part of the master came from and which land is invented, and the Origin
  renderer draws it; then it carries Earth's named towns of 1790, rivers, lakes, peaks, seas and lands into the
  world, the towns from the review in `world/names/1790.json`, beside the tiles for the page and beside the
  ground map for the game server. It prints
  how much of the land is from Earth, invented and copied, and how many names went nowhere: the numbers to report.
- **Re-works the sprite map** if the master, `world/biomes.json` or the generator changed:
  `npm run world:sprites --prefix frontend`, half a minute a master, and it prints the density of every
  biome against experiment 0006's ceiling. Without one a master draws no scenery at all.
- **Re-reads the ground** if the master or the ground tool changed: `npm run world:ground --prefix frontend`,
  seconds a master. The game server reads it to work out what a player is looking at when they roll; a stale
  one offers a river that is not there any more.
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

**Number the items, 1 to 3, so Adam can answer one by its number.** A question put to him is an item like
any other, and "2" is only an answer when there is a 2 to point at. Write them as a numbered list - `1.`,
`2.`, `3.` - with the eye inside the item, never as unnumbered checkboxes.

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
- **`world/painterly/`, `world/stands/`, the cut tiles under `frontend/apps/web/public/world/`, and
  `.logs/` are output and per-worktree.** They are gitignored, they do not travel with a branch, and a
  worktree that has never cut them cannot serve a map. Junctioning the main checkout's tiles into the
  worktree is the cheap way to get a map up without a five-minute recut. So is `frontend/node_modules`: a
  fresh tree needs `npm install --prefix frontend` once before anything in it runs, and again after any
  merge that changes `frontend/package-lock.json`. Junction each master's `tiles` rather than the whole
  `public/world`, though: a sprite map furnished through that junction is written into the main checkout's.
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
time. Before making or changing anything the player is shown, read `docs/UI-COMPONENTS.md` and open the
page it names.

## Every document has one purpose, and only what fits it goes in

Each persistent document opens with a line saying what belongs in it and what does not. That line is the
rule, not a decoration: material that does not fit moves to the document that owns it rather than being
added where it was convenient. A mechanic goes in `MECHANICS.md` and not in `SETTING.md`; the engine behind
it goes in `ARCHITECTURE.md` and not in either; what it looks like goes in `LOOK-AND-FEEL.md`; how it
behaves on a phone goes in `RESPONSIVE-DESIGN.md`; when it will be built goes in `ROADMAP.md`; what its
levers do in the running program, and where they are, goes in `RUNNING.md`. A document that is about
everything is read by nobody, and a claim in the
wrong place is a claim nobody maintains. If a thing genuinely fits nowhere, that is a new document with its
own purpose line, and saying so is part of presenting the step.

## Layout

```
CLAUDE.md  README.md  debug-quick-start.{ps1,cmd}  .claude/settings.json  scripts/check.{ps1,sh}
size-ceilings.txt   every source file over 400 lines, which may only get shorter (decision 0072)
docs/       VISION SETTING MECHANICS LOOK-AND-FEEL RESPONSIVE-DESIGN GLOSSARY ARCHITECTURE ROADMAP
            TESTING EVENTS BUILDING-A-MECHANIC UI-COMPONENTS AUTHORING-THE-WORLD AUTHORING-THE-ART
            RUNNING, adr/, experiments/, plans/
scripts/    Adam's terminal tools, node <tool>.ts; nothing of the program imported, only sharp installed (0082)
contracts/  fixtures/*.json shared by the Kotlin and TypeScript protocol tests
infra/      docker-compose.yml (MongoDB replica set, RabbitMQ)
backend/    Gradle multi-module: domain, application, protocol, infrastructure-occurrent, infrastructure-rabbit,
            projections, gateway, app, arch-tests, load-bots
frontend/   npm workspaces: packages/protocol, packages/client-core, apps/web; tools/ the repository's own checks
```

## Layer rules

Enforced by Gradle module edges plus ArchUnit on the backend, and by npm workspace dependencies, a DOM-free tsconfig
and ESLint restricted imports on the frontend.

- Backend: `domain` <- `application` <- {`infrastructure-occurrent`, `infrastructure-rabbit`, `projections`,
  `gateway`} <- `app`. `domain` depends on nothing but the Kotlin stdlib. `application` depends only on `domain` and
  owns the ports. Only `app` has `@SpringBootApplication`.
- Frontend: `packages/protocol` <- `packages/client-core` <- `apps/web`. `client-core` never imports React, the DOM,
  MapLibre or Pixi; the socket is an injected interface. The page takes from the world package only
  `@villages/world`; `/build` and `/testing` are for its tools and the tests, and ESLint holds that.
- Inside `apps/web`, the component library in `src/ui/` imports nothing from the rest of the app, only React, its
  fonts and the world package, so every component can be shown with nothing running; `src/ui/boundary.test.ts`
  holds it.
- The rest of `apps/web` stands in rows, and a folder imports only the rows above it: `src/layers.test.ts` names
  the rows and the few sideways imports allowed, and excuses none. A new folder gets a row; an import the rows
  refuse is a sign the code is in the wrong folder, and what one surface needs from another is handed down
  from the root. See decision 0073.
- `scripts/` imports nothing from `frontend/` or `backend/`: Node 24, its own modules, and sharp for the
  tools that read or write WebP, installed in `scripts/` by its own `npm install`. It reads the repository's data files, `world/palette.json` and the masters, as data. A tool Adam
  runs by hand goes there, not into a workspace of the program. See decision 0082.
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
  `debug-quick-start.cmd` on a double click from Explorer. It checks the tools, installs the packages
  again when `package-lock.json` has changed since they were installed (stopping this checkout's dev
  server first, because Windows will not replace a running program), generates whatever part
  of the world is missing, works the origin map out again when the master was saved since and carries the
  names again when `world/names/1790.json` was, cuts the sprites and the interface pictures again (seconds when nothing is new), starts the game
  server and the dev server hidden with their output in
  `.logs/`, waits until both ports answer, and prints the address. `-Stop` stops both, `-Logs` prints
  their tails, `-WebOnly` skips the game server, `-NoBrowser` leaves the browser alone. **A port held by
  anything that is not this checkout's current server is taken**: another tree's, or one started before
  the code it serves was written. Launching it from a checkout means "show me this checkout", and the
  ports are per-tree now so taking one back cannot take anyone else's world with it (0031, 0037). It ends
  with every Villages server on the machine listed, whichever tree started it and how long it has been up.
  Double-clicked, the window closes once both answer and the servers run on without it; it stays open
  only when something failed, so the reason can be read. This is how
  Adam runs the program without an agent in the loop, so it stays true: a step that adds a server, a
  generated file or a prerequisite adds it there in the same commit.
- Frontend, once, and again whenever `frontend/package-lock.json` changes: `npm install --prefix frontend`.
  The quick-start does it itself when the lock is newer than `frontend/node_modules/.package-lock.json`,
  which npm writes last on every install. See the 2026-09-26 amendment to decision record 0037.
- The world: `npm run world:import --prefix frontend` traces the coast and the large lakes, and
  `npm run world:tile --prefix frontend` cuts the terrain into map tiles. Both read the hand-painted
  master in `world/master/` and take another as their first argument; each master's world is written to
  `public/world/masters/<name>/`, the default included. Terrain is drawn from tiles rather than outlines;
  see `docs/adr/0019`. What it is painted in is `world/palette.json`, what colour it is drawn in is
  `world/render.json`, and how it is painted is `world/painterly.json`.
- The world's other tools, each `npm run <name> --prefix frontend` and each described in `docs/RUNNING.md`
  beside the folder it reads: `world:sprites` works out a master's sprite map, `world:flow` which way its rivers
  run, `world:origin` where on Earth each part of it came from and `world:names` the names carried through that, `world:ground` the ground map the game server reads, `world:scenery` paints stills of the sprite map, `world:paint` paints the painterly stills and writes the
  runtime copy of the styles (`-- --config-only` for that alone), `world:art` cuts the sprites, `world:ui` the
  interface pictures, and `world:portraits` and `world:scenes` draw placeholders, never over a file that is
  there.
- Adam's own tools are in `scripts/`, apart from the program: terminal tools that change the files it reads,
  each `node <tool>.ts` from that folder, which prints its help when given nothing. `scripts/README.md` lists
  them and says how one is added; `mend-rivers` joins a master's broken rivers, and `nine-slice` makes a
  border from a picture of a frame. See decision 0082.
- What the running program does, part by part, is `docs/RUNNING.md`: the debug panel and every section of
  it, the player's own levers, the fog, the event page and the component library, and Adam's folders of
  pictures with the tools that cut them. A step that changes what a part of it does changes its entry there
  in the same commit. Three rules about the panel stay here. **Everything in it is in a folding section, and
  a step that puts something there says which section** - and asks when that is not obvious from what Adam
  said, rather than picking one. **A change that wants to be seen there says so with `note(area, message)`**,
  in `apps/web/src/log/log.ts`, rather than by adding a row, and worth saying is the bar. And its levers
  stand in for the world and never for the player: see `docs/BUILDING-A-MECHANIC.md`.
- The 4.4 GB the world is built from lives in `world/source/`, not committed:
  `npm run world:fetch-all --prefix frontend` fills it from nothing, and `-- --list` says what each source
  is for. The generator is `world/master/experiment/tools/build.mjs`; two minutes for the whole world.
- The older thirteen-class path, `world:fetch` and `world:master`, is stale and says so when run. It
  refuses to overwrite a hand-painted master and writes alongside; the merge script replays hand edits. `world:build` warps Earth into raw material for
  a different starting point.
- Frontend, look at it: `npm run dev --prefix frontend`, then open the address it prints. That is
  http://localhost:5173 in the main checkout and a port of its own in each worktree; see decision 0031.
- Frontend, checks: `npm run check --prefix frontend` (typecheck, lint, format, unit tests)
- Backend, running: the `backend` entry in `.claude/launch.json`, which carries this tree's port; by hand it is
  `cd backend` then `./gradlew :app:bootRun --args=--server.port=<this tree's game port>`. The gateway is a
  WebSocket at `ws://localhost:<that port>/ws`, 8080 in the main checkout; the web app connects to its own
  tree's on load, or to `VITE_GATEWAY_URL` when that is set. Everything is in memory until MongoDB exists, so
  nothing survives a restart, on purpose. `--villages.instruments=false` closes Adam's instruments: every lever
  of the debug panel and the event page, seeing everything, the fog's switch and the wipe are refused
  `instrumentsClosed`, and the player's own commands go on. See decision record 0076.
- Backend, checks: `cd backend` then `./gradlew check`. Gradle fetches the JDK 21 the toolchain asks for, so
  `JAVA_HOME` may stay on the Temurin 17 that is installed; the first run downloads it. Every module's
  `build.gradle.kts` declares only its allowed dependency edges and, with `testsRead`, the files outside
  it that its tests read, and `check` fails when one is missing; `buildSrc` holds the one convention they
  share. Versions live in `backend/gradle/libs.versions.toml`. Modules that do not depend on each other
  build and test side by side (`backend/gradle.properties`), so their output interleaves; `--no-parallel`
  runs them one at a time.

The two below do not exist yet. They arrive with the increments named, and `infra/` and `scripts/` in the
layout above are where they will go rather than where they are.

- Infra: `docker compose -f infra/docker-compose.yml up -d` (increment 0.4)
- Everything: `scripts/check.ps1` or `scripts/check.sh` (0.14)

The dev server is also registered in `.claude/launch.json` under the name `web`, so the preview tooling can start
it directly. Restart it rather than trusting hot reload after a file has been rewritten wholesale: Vite reports a
missing export that is plainly there. TypeScript is pinned below 7 on purpose; see `docs/adr/0015`.

Setting `VITE_MAP_STYLE_URL` swaps our world for someone else's map, which is how to compare against the real
Earth.
