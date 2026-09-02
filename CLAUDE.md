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

Prerequisites: Docker Desktop (WSL2), Eclipse Temurin 21 on `JAVA_HOME`, Node 24. Commands are added here as the
increments land:

- Frontend, once: `npm install --prefix frontend`
- Frontend, look at it: `npm run dev --prefix frontend`, then open http://localhost:5173
- Frontend, checks: `npm run check --prefix frontend` (typecheck, lint, format, unit tests)
- Infra: `docker compose -f infra/docker-compose.yml up -d` (increment 0.4)
- Backend: `cd backend` then `./gradlew check`, and `./gradlew :app:bootRun` (0.5 onwards)
- Everything: `scripts/check.ps1` or `scripts/check.sh` (0.14)

The dev server is also registered in `.claude/launch.json` under the name `web`, so the preview tooling can start
it directly. TypeScript is pinned below 7 on purpose; see `docs/adr/0015`.
