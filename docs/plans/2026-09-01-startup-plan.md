# Villages — Greenfield Startup Plan

> Approved by Adam on 2026-09-01 and copied into the repository unchanged. It is a record of what we planned, not a
> living document: corrections go into decision records, the experiment journal or the roadmap.

Plan date: 2026-09-01. Repository: `E:\Code\Villages` (empty, not yet a git repo). Working title and root package: `villages`.

## Context

You want to build an exploratory, persistent, multiplayer "experience" (more than a game) in which each player plays a fictional noble house on a map of the real world. The gameplay will be discovered by experimenting, so the code base must make change cheap while still being able to grow to tens of thousands of concurrent players in one shared world. You have fixed the technical pillars: event sourcing with Occurrent, RabbitMQ as the message broker, a map-first UI (MapLibre + OpenFreeMap), strict separation of domain from infrastructure and of core client logic from UI, automatic tests at every level, a set of persistent documents that carry decisions and learnings, and a rule that a human vets every change before it is committed.

This plan turns the interrogation answers into: (1) the decisions and their rationale, (2) the target architecture and repository layout, (3) the documentation system and working agreement, (4) the test strategy, and (5) an ordered list of small, individually vetted increments for Phase 0 (bootstrap) and Phase 1 (the "Found a House" walking skeleton), with an outline for Phases 2 and 3.

## Decisions made during interrogation

| Area | Decision | Why |
|---|---|---|
| Backend | Kotlin + Spring Boot (current GA), Java 21, Gradle Kotlin DSL multi-module with version catalog and wrapper | Occurrent 0.33 needs Java 21, ships Spring integration and a Jackson 3 converter (matches Spring Boot 4). Sealed/data classes suit commands and events. |
| Event sourcing | Occurrent 0.33.0 (MongoDB event store, subscriptions, Decider module) | Pure `decide/evolve` functions map 1:1 to the domain layer; built-in RabbitMQ bridge. |
| Broker | RabbitMQ 4.3 | Fan-out of domain events to projections and gateways. |
| Realtime | Own Kotlin WebSocket gateway (not Web STOMP) | Auth, per-user filtering, batching and horizontal scaling stay under our control; RabbitMQ docs give no per-destination authorization story for browsers. |
| Frontend | React + TypeScript + Vite | Largest ecosystem while experimenting; map is wrapped imperatively in one component. |
| Map | MapLibre GL JS v6 + OpenFreeMap tiles, `positron` style first, custom stylised style later | Real geography, timeless stylised look. No API key. Style URL configurable because OpenFreeMap is best-effort. |
| Sprites | No game engine. PixiJS v8 overlay from day one, hand-written camera sync, behind a `SpriteRenderer` interface | MapLibre already is the renderer; an engine would fight it for the camera. Pixi gives sprites, spritesheets, tweens. Fallback: `maplibre-gl-layers` custom layer or deck.gl interleaved. |
| Time | Real-time continuous, rate-based resources | Server declares `{amount, ratePerSecond, asOf}`; client animates; server emits events only on change. No per-house tick storm. |
| Topology | One shared persistent world | Design for scale from day one: one stream per house, cell-partitioned fan-out, read models for the map. |
| First slice | "Found a House" | Exercises the full path: command → event store → RabbitMQ → gateway → Pixi. |
| Identity | Anonymous player token (UUID in localStorage) | No sign-up before there is something to play. Accounts later behind a port. |
| Commit gate | Claude prepares, you approve, Claude commits | Enforced by Claude Code permissions (git commit/push always ask) plus CLAUDE.md. |
| Step size | Small: one coherent step per vetted commit | Easier review, faster feedback. |
| Documents | Vision, Glossary, ADRs, Architecture, Experiments, Roadmap, Events catalogue, Testing guide | Decisions and learnings outlive the conversation. |
| Hosting/CI | Local git only, `main` branch, single `check` script | Add GitHub + Actions when CI or a second contributor matters. |
| Containers | Docker Desktop (WSL2 backend) | Docker Compose for local Mongo/Rabbit, Testcontainers for integration tests. |
| JDK | Temurin 21 installed + Gradle toolchain pinned to 21 | Loud failure on the wrong JDK; IntelliJ picks it up. |

## Answer to the game-engine question

No engine. MapLibre GL JS is already a GPU renderer with a camera, zoom, projection and symbol layers; the game loop is server-side and event-driven, and the client is a view over events. What you need is a thin sprite/animation layer, which PixiJS provides without owning the camera. Two facts from today's research shape the design: there is no maintained PixiJS-for-MapLibre library (the sync is roughly a hundred lines you own), and MapLibre's own layout properties (`icon-size`, `icon-offset`) cannot read per-feature state, so per-sprite jiggle in native layers would need per-frame GeoJSON diffs. Pixi sidesteps both. Keep Pixi behind a `SpriteRenderer` interface so `maplibre-gl-layers` (purpose-built custom layer, ~10k animated sprites) or deck.gl can replace it if the overlay hits limits.

## Environment prerequisites (your actions before Phase 0)

Found on the machine: git 2.41 (user Ghilt), Temurin JDK 17, Node 24.18, npm 11.16, kotlinc 1.8 (irrelevant, Gradle brings its own), no Docker, no global Gradle, no default branch configured.

1. Install Docker Desktop (WSL2 backend), then verify with `docker compose version`.
2. Install Temurin 21 and point JAVA_HOME at it: `winget install EclipseAdoptium.Temurin.21.JDK`, then verify `java -version` shows 21.
3. Nothing else: Gradle is bootstrapped through the wrapper (Phase 0 downloads one Gradle distribution once), Node/npm are current.

## Repository layout

```
Villages/
  CLAUDE.md                     # conventions, how to run/test, the commit-gate rule
  README.md                     # 5-minute start
  .claude/settings.json         # permissions: git commit / git push always ask
  .editorconfig  .gitignore  .gitattributes
  scripts/check.ps1  scripts/check.sh      # run every check (backend + frontend)
  docs/
    VISION.md  GLOSSARY.md  ARCHITECTURE.md  ROADMAP.md  TESTING.md  EVENTS.md
    adr/0000-template.md  adr/0001-...md ...
    experiments/0000-template.md  experiments/0001-found-a-house.md
  infra/
    docker-compose.yml          # mongo (single-node replica set) + rabbitmq:4.3-management
    mongo/init-replica.js
  backend/                      # Gradle root (settings.gradle.kts, gradle/libs.versions.toml)
    domain/  application/  infrastructure-occurrent/  infrastructure-rabbit/
    projections/  protocol/  gateway/  api/  app/  arch-tests/  load-bots/
  frontend/                     # npm workspaces
    packages/client-core/       # framework-free TS: state, protocol codec, ticker, cells, connection
    packages/protocol/          # shared message types (mirrors backend/protocol)
    apps/web/                   # React + MapLibre + Pixi overlay + HUD
```

(Exact module names and dependency edges are specified in the Architecture section below.)

## Architecture

### Layer rules (enforced, not aspirational)

- Backend dependency direction: `domain` ← `application` ← {`infrastructure-occurrent`, `infrastructure-rabbit`, `projections`, `gateway`, `api`} ← `app`. `domain` has zero third-party dependencies (no Spring, Occurrent, Mongo, Rabbit, CloudEvents, Jackson). `application` defines ports (interfaces) that infrastructure implements. Enforced twice: Gradle module dependencies (a module cannot import what it does not depend on) and ArchUnit 1.5 rules in `arch-tests` (forbidden packages in `domain`/`application`, no cycles).
- Frontend dependency direction: `client-core` ← `apps/web`. `client-core` has no React/DOM/MapLibre/Pixi imports; enforced by npm workspace boundaries plus an ESLint restricted-import rule.
- The WebSocket protocol is a shared contract: Kotlin types in `backend/protocol`, TypeScript types in `frontend/packages/protocol`, kept in sync by a contract test that round-trips checked-in JSON fixtures on both sides.
- Docs travel with code: a commit that changes a decision, an event, or the glossary updates the corresponding document in the same commit.

### Backend design

**Gradle modules** (`backend/`, project name `villages`, Kotlin 2.x, Spring Boot 4.x, Java 21 toolchain, Occurrent 0.33.0 via its BOM, Gradle 9 wrapper):

| Module | Responsibility | May depend on |
|---|---|---|
| `domain` | Pure Kotlin. `House` aggregate: commands, events, state, `HouseDecider` (`decide`/`evolve`), value types (`HouseId`, `PlayerId`, `HouseName`, `Location`, `Cell`, `Banner`, `Treasury`), sealed `HouseError`. Only kotlin-stdlib. | nothing |
| `application` | Use cases (`FoundHouse`), ports: `HouseCommandExecutor` (execute a command against a stream), `HousesByCellQuery` (read model), `Clock`, `PlayerTokens`. | `domain` |
| `protocol` | WebSocket frame types (Kotlin data classes) mirrored in TypeScript; reads the shared JSON fixtures in `contracts/fixtures/`. | nothing (Jackson Kotlin module for tests) |
| `infrastructure-occurrent` | CloudEvent type mapper + Jackson 3 converter, MongoDB event store wiring, `ApplicationService` + Decider adapter implementing `HouseCommandExecutor`, durable subscriptions with Mongo checkpoint storage. | `application`, `domain` |
| `infrastructure-rabbit` | Broker topology (`villages.events` topic exchange, routing keys), the event bridge (event store subscription → exchange), and the `DomainEventFeed` consumer used by the gateway. | `application`, `domain`, `infrastructure-occurrent` |
| `projections` | `houses_by_cell` read model (Mongo collection `houses`, indexes on `cell` and 2dsphere `seat`) built from a durable subscription; implements `HousesByCellQuery`. | `application`, `domain`, `infrastructure-occurrent` |
| `gateway` | Spring WebSocket endpoint, session registry, cell subscriptions, snapshot + delta fan-out, coalescing, command intake. | `application`, `protocol`, `infrastructure-rabbit` |
| `app` | Spring Boot bootstrap and profiles (`local`, `test`); the only module with `@SpringBootApplication`. Gateway is designed to get its own bootstrap later. | everything |
| `arch-tests` | ArchUnit 1.5 rules over all modules. | everything (test scope) |
| `load-bots` | Phase 2 bot swarm (WebSocket clients). Not in `check`. | `protocol` |

Occurrent artifacts (all `org.occurrent`, versions from the BOM; names verified from the BOM pom today): `occurrent-mongodb-spring-boot-starter`, `occurrent-eventstore-mongodb-spring-blocking`, `occurrent-subscription-mongodb-spring-blocking`, `occurrent-subscription-mongodb-spring-blocking-checkpoint-storage`, `occurrent-subscription-durable-blocking`, `occurrent-subscription-catchup-blocking`, `occurrent-application-service-blocking`, `occurrent-decider`, `occurrent-cloudevent-converter-jackson3`, `occurrent-broker-rabbitmq-spring-boot-starter`, `occurrent-broker-rabbitmq-blocking`, `occurrent-projection-dsl-blocking`; tests: `occurrent-eventstore-inmemory`, `occurrent-subscription-inmemory`, `occurrent-testing-mongodb`, `occurrent-testing-junit-jupiter-blocking`. The BOM's own artifactId is confirmed in increment 0.5.

**Domain sketch for the first slice** (types only):

```kotlin
@JvmInline value class HouseId(val value: UUID);  @JvmInline value class PlayerId(val value: UUID)
data class HouseName(val value: String)                    // 2..32 chars, trimmed
data class Location(val lat: Double, val lon: Double)
data class Cell(val quadkey: String) { companion object { const val ZOOM = 8; fun of(l: Location): Cell } }
data class Banner(val field: Tincture, val division: Division, val second: Tincture?, val charge: Charge, val chargeTincture: Tincture)
data class Treasury(val amount: Long, val ratePerSecond: Double, val asOf: Instant) { fun at(now: Instant): Long }

sealed interface HouseCommand { val houseId: HouseId }
data class FoundHouse(override val houseId: HouseId, val player: PlayerId, val name: HouseName,
                      val seat: Location, val banner: Banner, val at: Instant) : HouseCommand

sealed interface HouseEvent { val houseId: HouseId; val at: Instant }
data class HouseFounded(override val houseId: HouseId, val player: PlayerId, val name: HouseName, val seat: Location,
                        val cell: Cell, val banner: Banner, val treasury: Treasury, override val at: Instant) : HouseEvent

sealed interface House { data object NotFounded : House; data class Founded(/* ... */) : House }
object HouseDecider { val initial: House = House.NotFounded
                      fun decide(c: HouseCommand, s: House): List<HouseEvent>; fun evolve(s: House, e: HouseEvent): House }
sealed class HouseError : RuntimeException() { data object AlreadyFounded : HouseError(); /* ... */ }
```

- `Cell` is computed in the domain (pure quadkey math at zoom 8) so the event carries it; routing keys and the read model never recompute it.
- Domain errors are a sealed exception hierarchy thrown from `decide`. This keeps `decide` shaped exactly like Occurrent's `Decider` (returns `List<E>`), avoids the `occurrent-decider-arrow` dependency, and Kotest asserts with `shouldThrow<HouseError.AlreadyFounded>`. Recorded as an ADR; revisit if command validation grows.
- Banner rule: a charge of a metal (or, argent) on a colour field and vice versa (the heraldic tincture rule) is enforced in `Banner`'s constructor; that is the first "house identity" rule and a nice property test.
- Founding sets `Treasury(0, FOUNDING_RATE, at)`; nothing else changes it in slice one.

**Occurrent wiring**

- Stream id `house:<uuid>`. CloudEvent `type` = `villages.house.founded.v1`, `source` = `urn:villages`, `subject` = house id. A hand-written `CloudEventTypeMapper` maps each `HouseEvent` subclass to its type name; `EventTypeCatalogueTest` asserts every `HouseEvent::class.sealedSubclasses` entry is mapped and appears in `docs/EVENTS.md` (the catalogue is parsed in the test, so docs and code cannot drift).
- `GenericApplicationService(eventStore, converter)` plus the Decider Kotlin extension executes `FoundHouse`: load stream → `decide` → append with the stream-version write condition; Occurrent retries on version conflicts. Exact `execute` signature confirmed in increment 0.7 (the in-memory smoke test).
- Event bridge: a durable subscription (`house-events-bridge`, checkpoint in Mongo) publishes each CloudEvent to exchange `villages.events` with routing key `house.<event>.<cell>` (e.g. `house.founded.12030112`), CloudEvents JSON content type. First attempt uses `occurrent-broker-rabbitmq-spring-boot-starter`; if its routing-key derivation cannot include the cell, fall back to a twenty-line subscription that publishes with Spring AMQP's `RabbitTemplate`. Decided in increment 1.6 and recorded in the experiment file.
- `houses_by_cell` projection: durable subscription `houses-projection` from the event store (local history, natural catch-up) upserting `{_id, cell, name, seat (GeoJSON Point), banner, treasury, version}`; `version` = stream version, so snapshots and deltas can be ordered on the client.
- Pre-alpha schema policy as above; a `villages.house.founded.v2` needs an upcaster in the converter or a second branch in `evolve`.

**Gateway design**

- Plain WebSocket with JSON text frames (Spring `spring-boot-starter-websocket`, no STOMP): simplest client, protocol fully ours, shared with the frontend through `contracts/fixtures/`.
- Frames, client → server: `hello{playerToken, protocolVersion}`, `subscribeCells{cells[]}`, `unsubscribeCells{cells[]}`, `command{commandId, type, payload}`, `ping{t0}`. Server → client: `welcome{serverTime, playerId, ownHouse?}`, `snapshot{cell, houses[], asOfVersion}`, `batch{deltas[]}` where a delta is `houseAppeared|houseChanged{house, version}`, `commandAccepted{commandId}`, `commandRejected{commandId, reason}`, `resync{cells[]}`, `pong{t0, serverTime}`, `error{code, message}`.
- Session registry: `sessionId → {playerId, cells, outbound queue}` and an index `cell → sessions` (concurrent maps). Cap 64 cells per session; over the cap the server answers `error{tooManyCells}` and the client shows "zoom in" (Phase 2 adds aggregates).
- Feed: one broker consumer per gateway node on an exclusive auto-delete classic queue bound `house.#`; each event → cell → sessions → enqueue delta. No per-cell queues (tens of thousands of bindings churning with viewports would be the bottleneck).
- Coalescing: per session a 250 ms flush timer sends one `batch`. Bounded queue (500 deltas); on overflow the queue is dropped and the client gets `resync{cells}` and re-requests snapshots. Idle timeout via ping/pong.
- Subscribe: for each newly added cell, snapshot from `HousesByCellQuery`, then deltas. Client drops deltas whose `version` ≤ the snapshot's version for that house.
- Commands: `command` → `application` → `commandAccepted/Rejected`; the resulting house appears through the normal event path (no special casing of "own" events).
- Horizontal scaling later: no node-local state beyond live connections; a load balancer with no stickiness is enough.

**Local infra** (`infra/docker-compose.yml`): `mongo:8` started with `--replSet rs0 --bind_ip_all`, healthcheck that initiates the replica set on first run and reports `rs.status().ok`; `rabbitmq:4.3-management` on 5672/15672 with a healthcheck; named volumes; `.env` for credentials (never the `guest` user outside localhost).

### Frontend design

**Layout** (`frontend/`, npm workspaces):

| Package | Responsibility | May import |
|---|---|---|
| `packages/protocol` | zod schemas + TS types for every frame; contract test against `contracts/fixtures/*.json` | zod |
| `packages/client-core` | Framework-free game client: `state/` (store + reducers), `connection/` (socket state machine, backoff, resubscribe, command correlation), `cells/` (quadkey, bounds → cells with one-cell margin, diff, cap), `ticker/` (clock skew + `treasuryAt`), `commands/`. Exports `createGameClient({ socketFactory, now })`. | `protocol`, zod |
| `apps/web` | React 19 + Vite: `map/` (MapLibre wrapper), `sprites/` (`SpriteRenderer` + `PixiSpriteRenderer` + camera math), `banner/` (SVG heraldry), `hud/` (components), `store/` (React binding) | everything above, `maplibre-gl`, `pixi.js`, `react` |

Boundary enforcement, cheap and hard: `client-core`'s tsconfig has `"lib": ["ES2023"]` and no DOM types, so any DOM/WebSocket/canvas use fails to compile (the socket is an injected `SocketLike` interface); ESLint `no-restricted-imports` in `client-core` and `protocol` forbids `react`, `react-dom`, `maplibre-gl`, `pixi.js`; workspace `package.json` dependencies define what each package may import at all.

**client-core state sketch**

```ts
type Rate = { amount: number; ratePerSecond: number; asOf: number /* server ms */ };
type HouseView = { id: string; name: string; cell: string; seat: { lat: number; lon: number }; banner: BannerSpec; treasury: Rate; version: number };
type GameState = {
  connection: 'connecting' | 'open' | 'reconnecting' | 'closed';
  clock: { offsetMs: number; rttMs: number };            // serverNow = now() + offsetMs
  player: { token: string; id?: string };
  ownHouse?: HouseView;
  housesInView: Map<string, HouseView>;                 // upsert only if version is newer
  subscribedCells: Set<string>;
  pendingCommands: Map<string, { type: string; sentAt: number }>;
};
reduce(state: GameState, msg: ServerMessage): GameState;
treasuryAt(rate: Rate, serverNowMs: number): number;   // amount + rate * elapsed
cellsForBounds(bounds, zoom = 8, margin = 1): { cells: string[]; tooMany: boolean };
```

Clock skew: offset from `welcome.serverTime` refined by `ping/pong` (offset = serverTime − (t0 + t1)/2, keep the lowest-RTT sample). Reconnect: exponential backoff with jitter; on open send `hello` then `subscribeCells(current)`; `resync` re-requests the listed cells.

**Map + Pixi overlay**

- MapLibre v6 (ESM): style URL from `VITE_MAP_STYLE_URL`, default `https://tiles.openfreemap.org/styles/positron`; attribution control with "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; `minZoom 2`, `maxZoom 14`; rotation and pitch disabled and `renderWorldCopies: false` for slice one (keeps the overlay math affine; recorded as an ADR, revisited if we want a globe or tilt).
- Pixi v8 `Application` with `backgroundAlpha: 0`, `resizeTo` the map container, canvas absolutely positioned over the map with `pointer-events: none`.
- Camera sync, once per frame in Pixi's ticker: read `map.getCenter()` and `map.getZoom()`, compute `worldSize = 512 · 2^zoom` and the centre's normalised Mercator coordinates; for each visible sprite `x = (mx − cx) · worldSize + width/2` (same for y). Positions are relative to the centre so float32 never jitters at high zoom, and it costs two multiplies per sprite (10k sprites is nothing). Sprite pixel size is set by LOD, not by the container scale. Pure functions (`mercator(lat, lon)`, `screenPosition(...)`) live in `sprites/cameraMath.ts` and are unit-tested with known vectors; the same vectors test the Kotlin `Cell` math from `contracts/fixtures/cells.json`.
- LOD: zoom < 5 nothing (Phase 2 adds aggregates); 5–8 a 6 px dot in the field tincture; ≥ 8 the banner texture at 24–48 px; ≥ 10 a name label.
- Jiggle: in the same loop, `y += sin(t·ω + phase) · amplitude` and a small rotation, phase from a hash of the house id; ticker paused when `document.hidden`; sprites outside the viewport skipped.
- Hit testing: on map `click`/`mousemove`, pick the nearest sprite within its radius from the visible set; no Pixi event system needed.
- Interface that hides Pixi (so `maplibre-gl-layers` or deck.gl can replace it):

```ts
interface SpriteRenderer {
  mount(map: maplibregl.Map, container: HTMLElement): void;
  setHouses(houses: Iterable<HouseView>): void;   // renderer diffs against its sprites
  setSelected(id?: string): void;
  hitTest(point: { x: number; y: number }): string | undefined;
  destroy(): void;
}
```

**Banner**: `BannerSpec` (field tincture, division: plain | per pale | per fess | quarterly, optional second tincture, one charge from a starting set of three, charge tincture) → deterministic SVG string. Shown inline in the HUD; rasterised once per spec hash to a Pixi texture via an offscreen canvas.

**HUD**: `useGame(selector)` over `useSyncExternalStore` bound to the client-core store; components `ConnectionBadge`, `BannerCard`, `ResourceTicker` (requestAnimationFrame display of `treasuryAt`), `FoundHouseFlow` (button → "choose your seat" map mode → name + reroll banner → submit → pending → accepted), `HouseInspector` (selected house). UI dispatches through `client.send(command)`; no component talks to the socket.

**Frontend tests**: Vitest (node environment for `client-core` and `protocol`, jsdom for components), @testing-library/react, Playwright with `webServer` starting Vite; MapLibre and Pixi are never instantiated in unit tests (camera math and LOD decisions are pure and tested; the renderer gets a Playwright pixel smoke: the colour under the projected point of a known sprite). `npm run check` = `tsc -b`, `eslint .`, `vitest run`, contract test; `npm run e2e` runs Playwright against the running stack.

### Scale principles (go into ARCHITECTURE.md)

1. One event stream per house; no global aggregate. World-level views are projections.
2. Rate-based resources: events only on change; clients interpolate tickers.
3. Spatial partitioning by map cell (quadkey at a fixed zoom); live updates are routed and subscribed per cell.
4. Stateless gateway nodes: one broker consumer per node, in-memory cell → session fan-out, coalesced pushes (~250 ms per cell), snapshot from read model on subscribe then deltas.
5. Read models serve the map; the event store is never queried for rendering.
6. Prove it with a Kotlin bot swarm (`load-bots`): N WebSocket clients founding houses and panning; 10k connections on one dev machine is the Phase 2 milestone.

### Event schema evolution policy

- Event types are versioned by name: `villages.house.founded.v1`. A breaking change to a payload creates `.v2`; `evolve` handles both, or an upcaster in the CloudEvent converter maps v1 → v2.
- Pre-alpha exception (until the "world persistence" milestone in ROADMAP.md): the event store may be wiped on a breaking change. Every wipe is recorded in the experiment journal. Recorded as an ADR.

## Persistent documents

| Document | Purpose | Updated when | Format |
|---|---|---|---|
| `CLAUDE.md` | How to build, run, test; conventions; the commit-gate rule; pointers to the docs below | Any convention changes | Short, imperative |
| `docs/VISION.md` | The experience pillars, tone, what "playing a house" means, what it is not | When an experiment changes the vision | Prose, under 2 pages |
| `docs/GLOSSARY.md` | Ubiquitous language: House, Banner, Holding, Treasury, Cell, Player... one definition each; used verbatim in code, events and UI | Whenever a term is introduced or changed | Alphabetical table |
| `docs/ARCHITECTURE.md` | Layer rules, module map, event flow diagram, scale principles, schema-evolution policy | Structural changes | Diagrams as Mermaid + bullets |
| `docs/adr/NNNN-title.md` | One decision per file: context, decision, consequences, alternatives considered. Immutable once accepted; superseded by a new ADR | Every significant decision (the table above seeds ADR-0001..0012) | MADR-lite template |
| `docs/experiments/NNNN-title.md` | Hypothesis, setup, what we measured or observed, result, decision (keep / kill / pivot), follow-ups | Start of each experiment; closed when decided | Template |
| `docs/ROADMAP.md` | Now / Next / Later; milestones (walking skeleton, aliveness, 10k bots, world persistence) | Each planning conversation | Three lists |
| `docs/EVENTS.md` | Catalogue of every domain event: type name, version, stream, payload schema, meaning, producing command, consumers | Every new or changed event | Table per aggregate |
| `docs/TESTING.md` | The test pyramid, what belongs at each level, how to run each level, definition of done | When tooling or levels change | Table + commands |

Templates: ADR = Title / Status / Context / Decision / Consequences / Alternatives. Experiment = Hypothesis / Setup / Observations / Result / Decision / Follow-ups. Both live as `0000-template.md`.

## Working agreement (human vets every change)

Per increment:

1. Claude states the step (what, why, files) in one short paragraph before touching code.
2. Claude implements, runs the relevant checks, and presents: a summary, the list of changed files, the test output, and the docs it updated.
3. You review (the diff is in the working tree; IntelliJ or `git diff`). You say "commit" (or request changes).
4. Claude commits with a Conventional Commits message (`feat(domain): ...`, `docs(adr): ...`) and the `Co-Authored-By` trailer. One commit per increment; no amends or history rewrites without approval.

Enforcement in `.claude/settings.json` (project scope), so the harness prompts you every time regardless of session permission mode:

```json
{
  "permissions": {
    "ask": ["Bash(git commit:*)", "Bash(git push:*)", "Bash(git rebase:*)", "Bash(git tag:*)"],
    "deny": ["Bash(git push --force:*)", "Bash(git reset --hard:*)", "Bash(git clean:*)"]
  }
}
```

CLAUDE.md repeats the rule in words so it survives tooling changes, and also carries: the repo layout, how to start infra/backend/frontend, how to run each test level, the layer rules, the Conventional Commits scopes (`domain`, `application`, `occurrent`, `rabbit`, `projections`, `gateway`, `web`, `client-core`, `docs`, `infra`), the "docs travel with code" rule, and the pre-alpha event-store wipe policy.

Definition of done for an increment: compiles, all checks green via `scripts/check`, docs updated, glossary terms used consistently, no layer-rule violation.

## Test strategy

| Level | Backend | Frontend | Runs in `check` |
|---|---|---|---|
| Architecture | ArchUnit rules (`arch-tests`) | ESLint boundary rule + `tsc` project references | yes |
| Unit (pure) | Kotest 6.2: decider given/when/then, property tests for `evolve` | Vitest: reducers, ticker math, cell math, protocol codec | yes |
| Application | Occurrent in-memory event store through the application service | Connection state machine with a fake socket | yes |
| Integration | Testcontainers 2.0 (Mongo replica set, RabbitMQ): event written → CloudEvent on exchange → projection updated | Component tests with React Testing Library against a fake connection | yes (needs Docker) |
| Edge | Spring WebSocket test client: subscribe → snapshot → delta | Playwright smoke: map renders, found a house, sprite appears | backend yes; e2e optional flag |
| Contract | JSON fixtures round-trip in Kotlin and TS | same fixtures | yes |
| Load | `load-bots` swarm (Phase 2) | n/a | manual |

## Phases

### Phase 0 — Bootstrap

Goal: an empty-but-complete skeleton where every layer exists, every check runs, and every document has its first version. Each item is one vetted commit.

| # | Increment | Proof |
|---|---|---|
| 0.1 | `git init -b main`; `.gitignore` (Gradle, Node, IDE), `.editorconfig`, `.gitattributes` (LF), `README.md` stub, `CLAUDE.md` v1 (commit-gate rule, layout, how to run), `.claude/settings.json` with the ask/deny permissions | Claude's own `git commit` attempt triggers a permission prompt |
| 0.2 | Core docs: `VISION.md`, `GLOSSARY.md` (House, Player, Banner, Seat, Treasury, Cell, Command, Event, Projection), `ARCHITECTURE.md` (layer rules, module map, event flow, scale principles), `ROADMAP.md`, `TESTING.md`, `EVENTS.md` (empty catalogue with column format), both templates | Review only |
| 0.3 | ADR-0001..0012 for today's decisions (stack, event sourcing with Occurrent, RabbitMQ, own gateway, no game engine + Pixi overlay, rate-based time, one world + cells, anonymous identity, commit gate, docs system, schema-evolution policy, local git) plus `experiments/0001-found-a-house.md` with its hypothesis | Review only |
| 0.4 | `infra/docker-compose.yml`: MongoDB 8 as single-node replica set (`--replSet rs0` + init script), RabbitMQ 4.3 management, healthchecks, named volumes | `docker compose up -d` reports both healthy; Mongo `rs.status()` ok; RabbitMQ UI on 15672 |
| 0.5 | Gradle: download one Gradle 9 distribution to the scratchpad and generate the wrapper in `backend/`; `settings.gradle.kts` with all modules; `gradle/libs.versions.toml` (Kotlin 2.x, Spring Boot 4.x, Occurrent 0.33.0 BOM, Kotest 6.2.x, Testcontainers 2.0.x, ArchUnit 1.5.0); toolchain pinned to 21; each module has a `build.gradle.kts` declaring only its allowed dependency edges and one placeholder class | `./gradlew build` green on JDK 21; fails with the toolchain message on 17 |
| 0.6 | `arch-tests`: ArchUnit rules (domain depends on nothing but stdlib; application only on domain; no cycles; only `app` has `@SpringBootApplication`), proven by a temporary deliberate violation that fails, then removed | `./gradlew :arch-tests:test` |
| 0.7 | Occurrent smoke in `infrastructure-occurrent`: in-memory event store + `GenericApplicationService` + a throwaway decider round trip using the Jackson 3 converter under Spring Boot 4 (verifies the riskiest compatibility early; confirms the Decider `execute` signature) | Test green, no Docker needed |
| 0.8 | Testcontainers smoke: Mongo replica-set container + RabbitMQ container start; Occurrent Mongo event store writes and reads one event; `occurrent-testing-mongodb` wipes between tests | Test green with Docker running |
| 0.9 | `app` boots with the `local` profile against Compose; Actuator health; `gateway` exposes `/ws` and answers `hello` with `welcome{serverTime}` (no domain yet) | `curl /actuator/health`; WebSocket test client receives `welcome` |
| 0.10 | Frontend workspaces: root `package.json`, `packages/protocol`, `packages/client-core` (no DOM lib, restricted imports), `apps/web` (Vite + React + TS), ESLint flat config + Prettier, `npm run check` with one trivial test per package | Check green; a deliberate `import 'react'` in client-core fails tsc and lint |
| 0.11 | `MapView`: MapLibre v6 ESM, positron style from env, attribution, rotation/pitch off, full-viewport; empty HUD shell (banner slot, ticker slot) | Browser-pane screenshot shows the map and attribution |
| 0.12 | `SpriteRenderer` interface, `cameraMath.ts` with Vitest vectors, `PixiSpriteRenderer` drawing one jiggling test sprite pinned to a lng/lat that stays put while panning and zooming | Unit tests green; Playwright pixel smoke |
| 0.13 | Playwright wiring (`webServer` config), smoke "map canvas renders and attribution is visible", `npm run e2e` | E2E green locally |
| 0.14 | `scripts/check.ps1` and `scripts/check.sh` run backend and frontend checks; README "5-minute start" completed; ROADMAP "Now" moves to Phase 1 | Both scripts exit 0 from a clean clone |

### Phase 1 — Walking skeleton: "Found a House"

Goal: open the app, see the map, found a house at a chosen spot with a generated banner, see the banner and one rate-based ticker in the HUD, see other houses appear live and jiggle. Increments interleave backend and frontend so the slice becomes visible early; each is one vetted commit.

| # | Increment | Proof |
|---|---|---|
| 1.1 | `domain`: `Location`, `Cell` (quadkey z8), `HouseName`, `Tincture`/`Division`/`Charge`/`Banner` with the tincture rule, `Treasury.at(now)` | Kotest specs incl. property tests; `contracts/fixtures/cells.json` vectors; GLOSSARY updated |
| 1.2 | `domain`: `FoundHouse`, `HouseFounded`, `House` state, `HouseDecider`, `HouseError.AlreadyFounded` | `HouseDeciderSpec` given/when/then; EVENTS.md lists `villages.house.founded.v1` |
| 1.3 | `protocol` (Kotlin) + `packages/protocol` (zod): all frames; `contracts/fixtures/*.json`; contract tests on both sides | Both contract tests green from the same fixtures |
| 1.4 | `application`: `FoundHouse` use case, ports (`HouseCommandExecutor`, `HousesByCellQuery`, `Clock`, `PlayerTokens`), token → `PlayerId` | Fake-port tests |
| 1.5 | `infrastructure-occurrent`: type mapper, converter, `OccurrentHouseCommandExecutor` on in-memory and Mongo stores | `EventTypeCatalogueTest` (docs parsed), round-trip test, Testcontainers test |
| 1.6 | `infrastructure-rabbit`: topology + event bridge (Occurrent broker starter, or RabbitTemplate fallback), `DomainEventFeed` consumer | `EventBridgeTest`: appended event arrives with routing key `house.founded.<cell>`; decision noted in experiment 0001 |
| 1.7 | `projections`: `houses_by_cell` durable subscription, Mongo collection + indexes, snapshot query | `HousesByCellProjectionTest` |
| 1.8 | `gateway`: session registry, `subscribeCells`/`unsubscribeCells` with cap, snapshot on subscribe, delta fan-out from the feed, 250 ms coalescing, bounded queue + `resync` | `GatewaySubscriptionTest`, `SlowClientResyncTest` |
| 1.9 | `client-core`: `cells/`, `connection/` (hello, subscribe, reconnect, resubscribe, resync), `state/` reducers (snapshot replaces cell, deltas upsert by version) | Vitest with fake socket |
| 1.10 | `apps/web`: map `moveend` → cells → subscribe; render `housesInView` through `SpriteRenderer` with LOD; dev seed script founds N random houses through the gateway | Seeded houses appear and jiggle; panning loads more |
| 1.11 | `gateway`: `command` intake → application → `commandAccepted/Rejected`; backend end-to-end test | WebSocket client founds a house and receives its own `houseAppeared` |
| 1.12 | `apps/web`: banner SVG generator + texture cache; `BannerCard` | Snapshot tests of SVG for fixed specs; RTL test |
| 1.13 | `apps/web`: `FoundHouseFlow` (choose seat, name, reroll banner, submit, pending/accepted/rejected); own house highlighted | RTL tests with fake client; manual run |
| 1.14 | `client-core` `ticker/` (skew from welcome + ping/pong, `treasuryAt`) and `ResourceTicker` component | Vitest math tests; RTL test with fake clock |
| 1.15 | `HouseInspector` on click (hit test) and `ConnectionBadge`; reconnect behaviour verified by killing the backend | RTL tests; manual run |
| 1.16 | Playwright e2e: two browser contexts, the second sees the first's house appear; experiment 0001 closed with observations; ROADMAP moves to Phase 2 | `npm run e2e` green; docs updated |

### Phase 2 — Aliveness and scale proof

- Bot swarm to 10k connections on one machine; measure gateway fan-out and coalescing.
- Low-zoom aggregation of sprites (cluster or density) so 50k houses never means 50k sprites.
- Custom stylised map style (Maputnik) checked into the repo; self-host or alternative tile provider fallback tested.
- Reconnect, resubscribe, clock-skew correction hardened.

### Phase 3+ — Experiments (seeded in ROADMAP.md, each gets an experiment file)

- House identity: values or virtues that decisions nudge; the banner and titles reflect them.
- Second resource and the first spend decision; holdings on the map around the seat.
- Neighbours: seeing and greeting nearby houses; the first inter-house event.
- Accounts behind the identity port; world persistence milestone (schema-evolution policy switches to strict).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Occurrent API churn (0.30 → 0.33 in two months; OpenRewrite recipes are Java-only, Kotlin migrations are manual) | Pin via the Occurrent BOM; keep all Occurrent types inside `infrastructure-occurrent`; adapter tests catch breakage on upgrade. |
| Artifact names for Occurrent event store/starter modules were inconsistent across docs fetches | Resolve from the BOM pom during Phase 0 increment 1; record in ADR. |
| OpenFreeMap is best-effort with no SLA | Style URL from env; Phase 2 tests a fallback provider or self-hosted tiles. |
| Hand-written Pixi/Map camera sync (jitter at high zoom, two WebGL contexts) | `SpriteRenderer` interface; unit-tested projection math; fallback to `maplibre-gl-layers`. |
| Windows dev (Docker Desktop, line endings, scripts) | `.gitattributes` with LF; both `check.ps1` and `check.sh`; Testcontainers verified in increment 0. |
| Event schema churn while experimenting | Versioned event types + pre-alpha wipe policy recorded in an ADR and the journal. |
| Scope creep before the skeleton walks | Roadmap "Now" holds only the current phase; experiments must have a hypothesis. |

## Verification (end to end)

1. `scripts/check.ps1` (and `.sh`) exits 0: Gradle `check` (unit, integration with Testcontainers, ArchUnit, contract) and `npm run check` (typecheck, lint, unit, contract).
2. `docker compose up` in `infra/` then `./gradlew :app:bootRun` and `npm run dev`: open the app in the browser pane, found a house, see banner + ticker counting up, open a second browser tab with a fresh token, found a second house, see it appear live in the first tab.
3. Playwright smoke passes against the running stack.
4. Every increment landed as one approved commit; `git log` reads as the story of the phase; docs match code (ADR count matches decisions; EVENTS.md lists `villages.house.founded.v1`).

## Open items to resolve during Phase 0 (flagged as unverified today)

- Occurrent artifact IDs are now verified from the BOM pom (listed in the backend design). Still to confirm in 0.5: the BOM's own artifactId, and in 0.7: the Decider `execute` extension signature and whether the RabbitMQ broker starter lets the routing key include the cell.
- Occurrent's minimum MongoDB version (not stated; use MongoDB 8.x in Compose and Testcontainers).
- `maplibre-gl-layers` compatibility with MapLibre v6 (fallback only; no action unless needed).
- Spring Boot 4 + Jackson 3 with Occurrent's `jackson3` converter (verified in increment 1 by a compile + in-memory test).
