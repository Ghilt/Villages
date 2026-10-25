# Villages' additions to loop:hand-over

What is true of Villages only. The shared skill's steps and order stand; this adds to them. Adam verifies through the
running program and the debug panel, not through code (decision record 0023), so whatever a step makes the program do
must show there.

## Verify

- The checks the step touches: `npm run check --prefix frontend` for the frontend, `cd backend` then `./gradlew check`
  for the backend, `npm run e2e --prefix frontend` for the end-to-end test. `node scripts/check.ts` runs them all, about
  five minutes.
- For anything visible, look at it in the browser pane and say what you saw.

## Regenerate

A step that changed the master or anything the world is built from runs the `regenerate-world` skill now: it is the
`regenerate` entry of the config. Stale output is worse than missing output, because it looks like evidence.

## Measure

What a step costs is measured at its hand-over, against the last point main kept, and said under "what moved"
(decision record 0106, `docs/RUNNING.md`). It is the `measure` entry of the config. Nothing measured at a hand-over is
kept: the logs and the `.json` in `.logs/perf/` are the evidence, and only a landing on main keeps a point.

- **A step that changes what is drawn** - a shader, a layer of the map, the paint, the style, the scenery or what the
  sprite canvas draws - runs `npm run perf:shaders --prefix frontend -- --compare`, about ten minutes, and says each place
  that moved and by how much, or that nothing did beyond the noise.
- **A step that changes the sprites, what the camera loads as it comes in, or anything the zoom runs** runs
  `npm run perf:zoom --prefix frontend -- --compare`, about three minutes.
- **A step that changes how the game starts** - what the page loads or runs before the loading screen lifts, a
  dependency, Vite's settings - runs `npm run perf:startup --prefix frontend -- --compare`, about three minutes.
- **A step that adds many tests or slow ones** says how long the check took against the last point in
  `docs/experiments/performance/tests.jsonl`; `node scripts/check.ts` prints each part's time.
- **A refusal is reported, not stepped round.** The tools refuse a graphics card more than a quarter busy: Adam is likely
  playing. Say so in the presentation and measure later, never with `--anyway` for a reading that will be compared.
- **What moved is the step's to explain.** A move the step meant is said with its reason; one it did not is a finding,
  and Adam hears of it before anything else in the presentation.

## Leave the program running

- **Start it with the quick start**, from the worktree root, its output to a file rather than a pipe (the servers hold a
  pipe open and the call never returns):

      powershell -File debug-quick-start.ps1 -NoBrowser > .logs/quick-start.txt 2>&1

  Not the `web` entry of `.claude/launch.json`: the desktop app stops a server it started that way once the session goes
  quiet, and Adam finds nothing at the address. The quick start's servers are detached and outlive the session, and it
  replaces a server older than the code it serves, so it is also the restart after a protocol change.
- **Start it in this tree.** Every worktree serves on its own ports; `node frontend/apps/web/vite/worktreePort.ts` prints
  this one's, `--game` the game server's. If a port is taken anyway, do not stop what holds it: it is another session's.
  Say so.
- **Drive it to where the change shows**: the right renderer, master, part of the world and zoom, the right pane open.
  Not whatever it opened with.
- **Copy the debug panel** into the presentation when the change is one the panel reports.
- **The browser pane stops animation frames when it is hidden**, and MapLibre waits on one for its style to load and for
  every `flyTo`. A hidden pane shows a map that never finishes loading and a camera that says it is moving while standing
  still; neither is a bug. A screenshot pumps one frame, so a handful in a row carries a flight to its end. The DOM, the
  panel and the log can be read without any of that.

## Present

- **Where to look**, the one line, in this form, because the folder and the branch can differ and the app does not always
  show which tree a session is in:

      http://localhost:5548 · worktree <folder under .claude/worktrees/>, branch <git branch --show-current>

- **The documents touched**: a decision, an event or a term updates its document in the same commit (the decision records
  in `docs/adr/`, `docs/EVENTS.md`, `docs/GLOSSARY.md`, `docs/ARCHITECTURE.md`). If a thing fits no document, say a new one
  is needed, with its own purpose line.

## Verification requests

- **Where** is what Adam sees at the address, in Adam's own browser, never "the browser pane": that is the agent's own
  tool, and in it the agent is another player. What the agent made as that player is on Adam's map only with the fog
  lifted, or once Adam makes it again with a lever; say which, and how.
- **A place on the map is a link that opens the game there**,
  `http://localhost:<port>/?at=<lat>,<lon>&zoom=<z>`, standing alone above the requests in the shared skill's compact
  form, so the requests need not say where. Never a geographic name Adam is assumed to know: "the Sahel line" meant
  nothing (2026-10-11).
- **A step that adds or changes a UI component** points its requests at `/admin/inspect-ui-components`
  (`docs/UI-COMPONENTS.md`), says which pictures in `world/ui/` it reads, the size to paint each at, and which are still
  placeholders.

## After "continue"

Commits follow `CLAUDE.md`: Conventional Commits with its scopes and the `Co-Authored-By` trailer. When it was the last
step of a plan, bring the work to main with `loop:to-main`.
