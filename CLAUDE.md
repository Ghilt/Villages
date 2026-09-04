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
- No amends, force pushes, hard resets, or history rewrites without explicit approval.
- `.claude/settings.json` makes the harness prompt on these commands regardless of permission mode. This file states
  the rule in words so it survives tooling changes.

## Working agreement

This is a loop, and Adam holds both ends of it: he approves what lands, and he chooses what comes next.

1. **Agree the step.** State it in one short paragraph, what and why and which files, before touching code.
2. **Build it small.** One coherent step per commit: a module skeleton, a document, one test with its
   implementation. If it grows past a few hundred lines, it was two steps.
3. **Verify it.** Run the checks, and for anything visible, look at it in a browser and say what you saw. Report
   what failed, including the things you had to fix on the way.
4. **Documents travel with it.** A change to a decision, an event or a term updates its document in the same
   commit: a decision record, the event catalogue, the glossary, the architecture.
5. **Present it for review and stop.** A summary, the file list, the check output, the documents touched, and a
   proposed commit message. Do not commit.
6. **Commit only on Adam's word,** then say what landed.
7. **Offer the next steps and stop again.** Two to four concrete options, each a sentence or two on what it
   would produce and what it would cost, with a recommendation and the reason for it. Say plainly what is
   blocked and on what. Always leave room for a fifth answer that is none of them, because the point of the
   options is to give Adam the wheel, not to make him pick from a menu.

Never choose the next increment alone, and never chain increments together to save a round trip. The roadmap is a
menu, not a queue: its order is a suggestion, and Adam reorders it freely. When an option is not on the roadmap
but is clearly better, offer it anyway and say why.

## Say what you are working on, while you are working on it

Before touching code, write `.sessions/<date>-<slug>.md` saying what this session is doing and which parts of the
tree it is touching, and read the other files in that directory first. Keep the areas current as they change, and
delete the file when the work lands. More than one agent may be working at once, and the point is that a collision
is visible before it happens rather than discovered in a merge. `.sessions/README.md` has the shape and the
reasoning; the directory is gitignored on purpose.

Definition of done for a step: it compiles, the checks are green, the documents that describe it are updated,
glossary terms are used verbatim, and no layer rule is violated.

Read `docs/ROADMAP.md` under "Now" at the start of a session, and the last few commits, to see where things
stand.

## Layout

```
CLAUDE.md  README.md  .claude/settings.json  scripts/check.{ps1,sh}
docs/       VISION GLOSSARY ARCHITECTURE ROADMAP TESTING EVENTS, adr/, experiments/, plans/
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

Prerequisites: Docker Desktop (WSL2), Eclipse Temurin 21 on `JAVA_HOME`, Node 24.

All the commands below are run **from the repository root**, `E:\Code\Villages`. The `--prefix frontend`
part is what points npm at the frontend workspace, so running them from inside `frontend/` looks for
`frontend/frontend` and fails. From inside `frontend/` drop the prefix: `npm run world:import`.

Commands are added here as the increments land:

- Frontend, once: `npm install --prefix frontend`
- The world: `npm run world:import --prefix frontend` traces the coast and the large lakes, and
  `npm run world:tile --prefix frontend` cuts the terrain into map tiles. Both read the hand-painted
  master in `world/master/`. That is the loop: edit the image, import, tile, reload. Terrain is drawn from
  tiles rather than outlines; see `docs/adr/0019`. What it is painted in is `world/palette.json`, what
  colour it is drawn in is `world/render.json`, and how it is painted is `world/painterly.json`.
- The 4.4 GB the world is built from lives in `world/source/`, not committed:
  `npm run world:fetch-all --prefix frontend` fills it from nothing, and `-- --list` says what each source
  is for. The generator is `world/master/experiment/tools/build.mjs`; two minutes for the whole world.
- The older thirteen-class path, `world:fetch` and `world:master`, is stale and says so when run. It
  refuses to overwrite a hand-painted master and writes alongside; the merge script replays hand edits. `world:build` warps Earth into raw material for
  a different starting point.
- What it looks like: the picker at the top right of the running app switches renderer. `Raw` is the flat
  tiles as cut; the other three are painted in the browser, tile by tile, by the same functions that paint
  the stills. Only the terrain is precomputed: a tile knows its own zoom, so the treatment is drawn at the
  size it should be at whatever you are looking at. Painting happens in a pool of workers, and the tiles
  around the view are painted during the pauses so that moving the map finds them done. See
  `docs/adr/0021` and `0022`.
- What the program thinks is happening: the debug panel, under the renderer picker, minimises to a chip
  and remembers which. It shows the renderer, the zoom against the zoom of tiles being asked for, how far
  the terrain is being stretched past the depth it was cut at, how much ground a pixel covers, and how
  many painted tiles were ready before the map asked. Its copy button puts the state and the log on the
  clipboard, which is the shortest way to tell a session what the program is doing. Anything worth saying
  goes through `note(area, message)` in `apps/web/src/debug/log.ts`. `window.villagesPainterly()` gives
  the paint counters from a console.
- The styles live in `world/painterly.json`. `npm run world:paint --prefix frontend` paints every view in
  every style into `world/painterly/`, flat once and then once per style, and writes the runtime copy the
  app reads. `-- --view alps`, `-- --style woodblock` for one of them; `-- --config-only` writes just the
  runtime copy, in a second, which is all the app needs after a style edit.
- Frontend, look at it: `npm run dev --prefix frontend`, then open http://localhost:5173
- Frontend, checks: `npm run check --prefix frontend` (typecheck, lint, format, unit tests)
The three below do not exist yet. They arrive with the increments named, and `infra/`, `backend/` and
`scripts/` in the layout above are where they will go rather than where they are.

- Infra: `docker compose -f infra/docker-compose.yml up -d` (increment 0.4)
- Backend: `cd backend` then `./gradlew check`, and `./gradlew :app:bootRun` (0.5 onwards)
- Everything: `scripts/check.ps1` or `scripts/check.sh` (0.14)

The dev server is also registered in `.claude/launch.json` under the name `web`, so the preview tooling can start
it directly. Restart it rather than trusting hot reload after a file has been rewritten wholesale: Vite reports a
missing export that is plainly there. TypeScript is pinned below 7 on purpose; see `docs/adr/0015`.

Setting `VITE_MAP_STYLE_URL` swaps our world for someone else's map, which is how to compare against the real
Earth.
