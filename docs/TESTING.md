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
| Integration | Real infrastructure: an appended event reaches the broker with the right routing key, a projection updates | Testcontainers with MongoDB and RabbitMQ | yes, needs Docker |
| Edge | The gateway protocol over a real WebSocket; interface components against a fake client | Spring WebSocket test client, React Testing Library | yes |
| Contract | The same JSON fixtures parse and round-trip in Kotlin and in TypeScript | Kotest and Vitest over the shared fixtures | yes |
| End to end | The whole stack in a browser: the map renders, a house is founded, another browser sees it | Playwright | on request |
| Load | Thousands of simultaneous connections | the bot swarm | manual |

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
- MapLibre and Pixi are never instantiated in unit tests. Their maths is pure and tested directly; their pixels get
  one end-to-end smoke test.
- A test that needs Docker says so in its name, and is skipped with a clear message when Docker is absent.

## Running

Commands are filled in here as the increments land.

- Everything: `scripts/check.ps1` or `scripts/check.sh`, from increment 0.14
- Backend: `cd backend` then `./gradlew check`, from 0.5
- Frontend: `cd frontend` then `npm run check`, from 0.10
- End to end: `cd frontend` then `npm run e2e`, from 0.13

## Definition of done for an increment

It compiles, the checks are green, the documents that describe it are updated in the same change, glossary terms are
used verbatim, and no layer rule is violated.
