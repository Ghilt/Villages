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

1. State the step (what, why, files) in one short paragraph before touching code.
2. Small steps: one coherent step per commit (a module skeleton, a document, one test-plus-implementation pair).
3. Run the relevant checks. `scripts/check.ps1` or `scripts/check.sh` runs everything.
4. Docs travel with code: a change to a decision, an event, or a term updates `docs/` in the same commit
   (ADR, `EVENTS.md`, `GLOSSARY.md`, `ARCHITECTURE.md`).
5. Definition of done: compiles, checks green, docs updated, glossary terms used verbatim, no layer-rule violation.
6. Read `docs/ROADMAP.md` ("Now") at the start of a session.

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

Prerequisites: Docker Desktop (WSL2), Eclipse Temurin 21 on `JAVA_HOME`, Node 24. Commands are added here as the
increments land:

- Infra: `docker compose -f infra/docker-compose.yml up -d` (increment 0.4)
- Backend: `cd backend; ./gradlew check` and `./gradlew :app:bootRun` (0.5 onwards)
- Frontend: `cd frontend; npm install; npm run check` and `npm run dev` (0.10 onwards)
- Everything: `scripts/check.ps1` or `scripts/check.sh` (0.14)
