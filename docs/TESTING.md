# Testing

> **What belongs here:** how this repository is tested - the levels, what belongs at each, and how to run
> them. **What does not:** what is being tested, and the definition of done for a mechanic, which is in
> `BUILDING-A-MECHANIC.md`.

Every increment lands with the test that proves it. The tests are the reason we can keep changing the game.

## Levels

| Level | What it covers | Tools | In check |
|---|---|---|---|
| Architecture | Layer rules: what a module may depend on and import | ArchUnit on the backend; project references and restricted imports on the frontend | yes |
| Unit, pure | Deciders, value objects, cell maths, banner rules, reducers, ticker maths, protocol codecs | Kotest, Vitest | yes |
| Application | Use cases against the in-memory event store; the connection state machine against a fake socket | Kotest with the Occurrent in-memory store, Vitest | yes |
| Integration | Real infrastructure: an appended event reaches the broker with the right routing key, a projection updates | Testcontainers with MongoDB and RabbitMQ: `MongoWorldDockerSpec`, `CarryDockerSpec`, `BrokerDockerSpec`, `BridgeDockerSpec`, `BrokerLiveDockerSpec` | yes, needs Docker |
| Edge | The gateway protocol over a real WebSocket; interface components against a fake client | Spring WebSocket test client, React Testing Library | yes |
| Contract | The same JSON fixtures parse and round-trip in Kotlin and in TypeScript; every store ever recorded still reads and folds, through the upcasters (0100) | Kotest and Vitest over the shared fixtures; `StoredWorldSpec` over `contracts/fixtures/stores/` | yes |
| End to end | The whole stack in a browser: the map is painted, a house is founded, another window sees it, an action is taken with Take action, a restart of the game server forgets nothing | Playwright, in the machine's own Chrome | yes, needs this tree's world cut; the restart and RabbitMQ need Docker |
| Load | Thousands of simultaneous connections, each a simulated player playing the player's own loop | `backend/load-bots`: a bot over the JDK's WebSocket client, tested against the shared frame fixtures; the swarm itself is run by hand (`docs/plans/bot-swarm.md`) | the bot's tests, yes; a run, no |

## Rules

- The domain layer is tested with no infrastructure at all. If a domain test wants a container, the layering is wrong.
- Deciders are tested as given, when, then over events, never through mocks.
- The fold of a stream gets property tests: replaying twice yields the same state, and no ordering throws.
- Infrastructure adapters are tested against the real thing in a container, never against a mock of a driver.
- The event catalogue is parsed by a test, so code and documentation cannot drift apart.
- A test that reads a file outside its module - a shared fixture, a recording of the wire, the event catalogue,
  the portraits - is named in that module's build file with `testsRead`, from the repository root:
  `testsRead("contracts")`. Gradle runs a module's tests again only when something it knows they read has changed,
  so a file it was never told about can change under them while `check` reports the last run's green. `check` also
  fails when a test reads a `../../` path that its build file does not name.
- The backend's modules run their tests at the same time, each in a JVM of its own. So a test that needs a port takes
  a random one, a test that writes a file writes it into a temporary folder of its own, and a container, when there
  are containers, is started for the test rather than shared by name. Two modules that shared any of those would
  fail only now and then, and nothing but this rule stops them.
- No source file may pass 400 lines, and one already past it may only get shorter: `size-ceilings.txt` at the
  repository root lists each with its length, and `SizeCeilingsSpec` (the Kotlin files) and
  `frontend/tools/sizes.test.ts` (the rest) fail when a listed file grows, shrinks without its number coming down,
  or an unlisted one passes the limit. Tests count. So a change that needs room in a long file moves something out
  of it first. See decision record 0072.
- The page's conversation with the gateway is written down whole in `apps/web/src/net/gateway.test.ts`: what is
  sent, what the log says in what order, and the state, for every turn it takes - hello, following, a zoom step and
  its fallback, a refusal, a resync, commands, the house's own frames, a takeover and a close. It drives the page's
  gateway module over `fakeSocket()` from `@villages/client-core/testing`, which keeps every handler it is given
  as a browser's socket does, and it does not change when the code under it moves: a move that changes it has
  changed the conversation.
- MapLibre and Pixi are never instantiated in unit tests. Their maths is pure and tested directly; their pixels get
  one end-to-end smoke test.
- A test that needs Docker says so in its name, and is skipped with a clear message when Docker is absent.
  `MongoWorldDockerSpec` is the pattern: `(needs Docker)` at the end of each case's name, and each case
  `.config(enabledOrReasonIf = needsDocker)`. Each case, because Kotest 6 ignored the same condition set once
  as the spec's `defaultTestConfig` and ran them all, which was found by pretending Docker was not there.

## Running

Commands are filled in here as the increments land.

- Everything: `scripts/check.ps1` or `scripts/check.sh`, from 0.14: the backend, the frontend, `scripts/`'s own
  tests, types and format, and the end-to-end test, one after another rather than side by side, because two at once on a busy machine make
  tests time out that pass alone. One line a part, what failed by name, and each part's whole output in
  `.logs/check-<part>.log`; `--only <part>` runs one. `--record` keeps how long each part and each of its steps took,
  how many tests each ran and where their time went, as a line of `docs/experiments/performance/tests.jsonl`, charted
  on the performance page; recorded, the backend's tests run whether or not anything changed, after a compile timed
  apart. `--root <tree>` checks another tree. See decision record 0106.
- Backend: `cd backend` then `./gradlew check`, from 0.5. Modules that do not depend on each other build and test side
  by side (`backend/gradle.properties`), so their lines interleave in the output; `--no-parallel` runs them one at a
  time.
- Frontend: `cd frontend` then `npm run check`, from 0.10. Its typecheck is `tools/typecheck.ts`, every project's
  compiler at once, each incremental; the linter and the formatter keep caches; all three under
  `node_modules/.cache/`, so a check after a small change takes seconds where it took half a minute: 33 s of the three
  before, 11 s warm (2026-10-20). A cache is read by each file's content, so a file broken is found broken whatever
  was cached; `tools/typecheck.test.ts` fails for a tsconfig the typecheck does not list.
- End to end: `cd frontend` then `npm run e2e`, from 0.13; the check script's fourth part runs it too. It starts a dev
  server and a game server of its own, on this tree's ports a thousand up, the page pointed at its game server, and
  keeps its world in a MongoDB database of its own, `villages-e2e-<tree>`, emptied before and dropped after, carried
  by RabbitMQ in a virtual host of the same name, deleted after, and checks the panel says so; with no MongoDB up it
  runs in memory and says the restart was not tried, and with no RabbitMQ up, in-process and says that. It drives
  Chrome, the one on the machine, headless,
  and reads what Adam reads: the debug panel's log. A failure leaves a trace in `.logs/e2e/results`, opened with
  `npx playwright show-trace`, and the report is `.logs/e2e/report`. The game server's output is `.logs/e2e-game.log`.

## Definition of done for an increment

It compiles, the checks are green, the documents that describe it are updated in the same change, glossary terms are
used verbatim, and no layer rule is violated.
