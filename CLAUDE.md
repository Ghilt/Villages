# Villages - working notes for Claude

Villages is an exploratory, persistent, multiplayer experience: each player plays a fictional noble house on a map of
the real world. Gameplay is discovered by experiment. The architecture keeps change cheap and is designed for tens of
thousands of concurrent players in one shared world.

## The one hard rule: nothing is committed that Adam has not verified, and only Adam sends work to main

Adam thinks about two things: whether a change looks right in the running program, and when work goes to
main. Everything about commits is the agent's, and he does not want to be asked about it.

- **"continue" with no notes is the word.** When a hand-over comes back with just "continue" ("cont" for
  short, and "good, continue" and "looks good, continue" too), commit what he verified and go on. With notes, nothing is
  committed: fix them and hand over again. A question, or "looks good" alone, is not the word. Saying it
  once is the whole of it: do not ask again or restate the change set.
- **Inside a long run he picked**, the `continue-for-some-time` skill, the agent commits each step itself
  once its checks are green, and Adam verifies at the checkpoints the run named before it began. That is
  the only time a commit lands before he has looked at it.
- **How the work is cut into commits is the agent's**, done by best practice and never put to Adam: one
  coherent change per commit, Conventional Commits with these scopes: `domain`, `application`, `occurrent`,
  `rabbit`, `projections`, `gateway`, `protocol`, `web`, `client-core`, `docs`, `infra`, `build`, and the
  `Co-Authored-By` trailer on every message. Steps that pile up before a "continue" still land as one
  commit each.
- **Main is Adam's.** Never rebase onto main or move main without his word in that turn ("bring it to
  main", or "main" alone), and never push or tag without it. "main" at a verify stop also means he has
  verified: commit what is waiting, bring it all to main, and offer the next steps.
- No amends of a commit he has seen, force pushes, hard resets, or history rewrites without explicit
  approval.
- `.claude/settings.json` is where the harness half of this lives. It denies force pushes, hard resets and
  `git clean` outright, prompts on `git push` and `git tag`, which are rare and hard to undo, and allows
  `git commit` and `git rebase`, so that Adam's word in the conversation is the only gate on them. Adam made
  those entries by hand, because an agent may not edit its own permission rules. This file states the rule
  in words so it survives tooling changes.

## Working agreement

This is a loop, and Adam holds both ends of it: he verifies what lands, and he chooses what comes next.

1. **Agree the step.** State it in one short paragraph, what and why and which files, before touching code.
2. **Build it small.** One coherent step per commit: a module skeleton, a document, one test with its
   implementation. If it grows past a few hundred lines, it was two steps.
3. **Hand it over: the `hand-over` skill.** Verify it, regenerate whatever it made stale, leave the program
   running on the change, and present it ending with the verify checklist. Then stop: do not commit. This is
   not optional and it is never an option on the menu.
4. **Documents travel with it.** A change to a decision, an event or a term updates its document in the same
   commit: a decision record, the event catalogue, the glossary, the architecture.
5. **On "continue", commit and go on.** With notes, fix them and hand over again. Then say in a line what landed.
   Bringing the work to main is the implicit last step of every plan: when "continue" comes after its last
   step, say that it was the last and bring the work to main, with the `to-main` skill.
6. **Offer the next steps and stop again**, when nothing agreed comes next. Two to four concrete options, each
   a sentence or two on what it would produce and what it would cost, with a recommendation and the reason for
   it. Say plainly what is blocked and on what. Always leave room for an answer that is none of them, because
   the point of the options is to give Adam the wheel, not to make him pick from a menu. When he says
   "continue for some time", the options are longer runs instead: the `continue-for-some-time` skill.

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

Never choose the next increment alone, and never chain increments together to save a round trip, except
inside a long run Adam picked, whose steps were named before it began. The roadmap is a menu, not a queue: its order is a suggestion, and Adam reorders it freely. When an option is not on the roadmap
but is clearly better, offer it anyway and say why.

## Skills: the moments of the loop, one file each

A procedure that belongs to one moment of a session is a skill in `.claude/skills/<name>/SKILL.md`, read when
that moment comes, and Adam can call any of them by typing `/<name>`. What must hold all the time stays in this
file. When Adam corrects how a moment is done, the correction goes into its skill, in the same step.

- `hand-over` - the end of every step: verify, regenerate, leave the program running, present, checklist last.
- `to-main` - Adam says "main", or a plan's last step is done: ask about the architecture diagram if something
  significant was added, rebase, check, fast-forward main.
- `regenerate-world` - a step changed the master or anything the world is built from: rebuild what it made stale.
- `continue-for-some-time` - Adam is leaving for a while: offer three longer runs, then work one through,
  committing as it goes and stopping only where it said it would.
- `nine-slice` - make a border for `world/ui/borders/` out of a frame picture Adam hands over.

## Adam paints the master. Everything else derived from it is the agent's to regenerate

The division of labour is this: Adam edits `world/master/terrain.png`, and picks the numbers that are matters of
taste. Everything that a tool can rebuild from those, an agent rebuilds, without being asked and without offering
it as a choice. He should never be handed a change whose evidence he has to generate himself.

So when a step changes the master, the palette, the render colours, a style file, or any code the paint, the
tiles or the maps go through, that same step regenerates everything it made stale, says what moved with a number
and a picture, and re-tunes or says plainly why not: the `regenerate-world` skill. Stale output is worse than
missing output, because it looks like evidence.

## Every session works in its own git worktree

An agent does not work in `E:\Code\Villages` itself. Each session gets a worktree under
`.claude/worktrees/<name>/`, which is a full checkout of the tree on its own branch, `claude/<name>`, so
several sessions edit the same files at once without seeing each other's half-finished work. Adam's own
checkout, the one he paints the master in, stays the main one.

What follows from that, and bites in practice:

- **A worktree is named for its branch.** `.claude/worktrees/<name>/` has `claude/<name>` checked out and
  nothing else, so the folder, the branch, the Worktrees section of the debug panel and the ports, which
  are worked out from the folder's name, all name the same piece of work. The app makes the two together.
  They part when a new session is started in a folder an earlier one left behind: the session is given a
  new branch and the folder keeps its old name. That is how `blissful-bouman-ea3009`, a gateway fix of
  2026-09-26, came to hold `claude/techstack-3d-rendering-0a717a`, and `fog-of-war-mechanic-3c9f45` came to
  hold `claude/desktop-ui-bay-animations-f32616`. So a session checks that `git branch --show-current`
  names its folder before it touches anything. If it does not, the session says so and moves while there
  is nothing in the old folder to lose: `git switch --detach` there frees the branch,
  `git worktree add .claude/worktrees/<name> claude/<name>` makes the folder it should have, and
  `EnterWorktree` with that path takes the session into it. The new folder then needs its packages, its
  tiles and `--launch` like any fresh tree, and serves on ports of its own. The folder left behind sits on
  a detached head until Adam removes it or asks a session to.

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
- **MongoDB and RabbitMQ in Docker are every tree's at once.** A tree keeps to its own database and its own
  virtual host, `villages-<tree>`, and resets only its own world, with the debug panel's wipe. Never
  stop, restart or `down -v` the stack, and never bring it up on a changed `infra/docker-compose.yml`:
  each of those stops or forgets every session's world, and they are Adam's. A change to that file is a
  step of its own and says so. See decision record 0091.
- **`.sessions/` is the main repository's, not the worktree's** - it sits beside the shared `.git`, which
  is what makes it the one place every session can see. See decision record 0020.

## Say what you are working on, while you are working on it

Before touching code, write `.sessions/<date>-<slug>.md` saying what this session is doing and which parts of the
tree it is touching, and read the other files in that directory first. Keep the areas current as they change, and
delete the file when the work lands. More than one agent may be working at once, and the point is that a collision
is visible before it happens rather than discovered in a merge. `.sessions/README.md` has the shape and the
reasoning; the directory is gitignored on purpose. From a worktree, write the note through the shell: the app's
guard refuses its file tools outside the worktree to keep the main checkout safe, and a note in an ignored folder
cannot harm it. Adam's word of 2026-10-07.

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
is fine. Docker Desktop, on WSL2, runs MongoDB and RabbitMQ from `infra/`; the game server does not
use them yet, so the event store and the broker are still in memory behind their ports, and nothing
else needs Docker but the tests that say so in their names.

All the commands below are run **from the repository root**, `E:\Code\Villages`. The `--prefix frontend`
part is what points npm at the frontend workspace, so running them from inside `frontend/` looks for
`frontend/frontend` and fails. From inside `frontend/` drop the prefix: `npm run world:import`.

Commands are added here as the increments land:

- Everything, from a cold machine: `.\debug-quick-start.ps1` from the repository root, or
  `debug-quick-start.cmd` on a double click from Explorer. It checks the tools, installs the packages
  again when `package-lock.json` has changed since they were installed (stopping this checkout's dev
  server first, because Windows will not replace a running program), generates whatever part
  of the world is missing and cuts again whatever a save of the master has made stale - the coast, the tiles,
  the rivers' flow, the sprite map, the ground map and the origin map with its names, in the order the panel's
  `cut it` runs them, and nothing when the master was not saved since - and the styles again when
  `world/painterly.json` or `world/render.json` was, the sprite map when `world/biomes.json` was, and the names
  when `world/names/1790.json` or `world/names/about.json` was. It never writes through a link: tiles a worktree links from the main
  checkout are that checkout's to cut, and it says so. It cuts the sprites and the interface pictures again (seconds when nothing is new), starts the game
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
  run, `world:origin` where on Earth each part of it came from and `world:names` the names carried through that, `world:ground` the ground map the game server reads, `world:height` the whole world's height the relief is shaded from, `world:scenery` paints stills of the sprite map, `world:paint` paints the painterly stills and writes the
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

- Infra: `docker compose -f infra/docker-compose.yml up -d`, once Docker Desktop is running. One MongoDB
  replica set and one RabbitMQ for the whole machine, shared by every tree, each tree keeping to a
  database and a virtual host named after it. `up -d` finds it already up when it is, so any session may
  run it; `down`, which stops it, and `down -v`, which forgets it, are Adam's alone. See
  `docs/RUNNING.md` and decision record 0091.

The one below does not exist yet. It arrives with the increment named.

- Everything: `scripts/check.ps1` or `scripts/check.sh` (0.14)

The dev server is also registered in `.claude/launch.json` under the name `web`, so the preview tooling can start
it directly while working; a hand-over uses the quick-start instead, as the `hand-over` skill says. Restart
it rather than trusting hot reload after a file has been rewritten wholesale: Vite reports a missing export that is
plainly there. TypeScript is pinned below 7 on purpose; see `docs/adr/0015`.

Setting `VITE_MAP_STYLE_URL` swaps our world for someone else's map, which is how to compare against the real
Earth.
