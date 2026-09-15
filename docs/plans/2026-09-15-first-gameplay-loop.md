# The first gameplay loop: a choice on a parchment, a house founded from it

> Approved by Adam on 2026-09-15 and copied into the repository unchanged. It is a record of what we planned,
> not a living document: corrections go into decision records, the experiment journal or the roadmap.

Worktree `E:\Code\Villages\.claude\worktrees\gameplay-loop-iteration-one-d71e80`, branch
`claude/gameplay-loop-iteration-one-d71e80`, at `6d90d7d` (same as main). Plan date 2026-09-15.

## Context

Villages can found a house from a debug button and nothing else. Adam wants the first real gameplay loop:
the server **puts a choice to the player** (`PlayerGivenChoice` in his words), the browser shows it
**diegetically as a parchment lying over the map** with the options as three buttons, the player picks
one, and the server records **both the action taken and what it did** (`PlayerTookAction`, `HouseFounded`),
every event carrying an **event id and a correlation id** to good event-sourcing standards. The first
choice is **where to found the house**: three seats across the map, given the moment a new player
arrives. The founded house is a **castle sprite with a small area around it**, the sprite is **selectable**,
and a **panel on the left** shows what is selected. The debug panel gets a **restart** that starts a
player over. UI is deliberately rough for now.

Adam also asked for a **working paradigm**: persistent documents good enough that a future session can
turn a described mechanic into events without being told how. That is a document, `docs/MECHANICS.md`,
and three decision records, written first and refined by what the increments teach.

### Decisions Adam has already taken (asked 2026-09-14)

1. **Choices live on the house's own stream.** `HouseGivenChoice` and `HouseTookAction` are house events
   on `house:<uuid>`, beside `HouseFounded`. Taking a founding option yields `tookAction` and `founded`
   from one `decide`, appended atomically with one correlation id. No Player aggregate, no reaction. (The
   Player-aggregate alternative is recorded in ADR 0034 as considered and declined.)
2. **Two restart buttons:** *restart* forgets the player token and reloads as a new player (the old house
   stays in the world, because events are never deleted); *wipe the world* empties the in-memory store and
   every projection for everyone connected.

### Assumptions I am making (say so if any is wrong)

- **Each option is a different destiny**: a seat, a house name and a banner, generated server-side per
  option, so the decider stays generic and the parchment reads like a chronicle ("Ravenscar, in the
  northern forests, under sable a stag argent"). Naming the house yourself is a later choice of its own.
- The three seats come from a **hand-kept gazetteer in the server** (the server knows no terrain), picked
  deterministically per player from three distinct regions, and checked against all three masters with a
  script before landing. Shown as three marks on the map while the parchment is open.
- The debug **`found a house here`** button and **`seed`** stay as they are. A founding by any means
  settles a pending founding choice. Each seeded bot now also leaves one `givenChoice` event behind.
- The **castle is drawn in code** (Pixi `Graphics`, like today's shield), tinted by the field tincture,
  for every house. The **small area** is the house's first *influence zone*: a fence a fixed number of
  master pixels around the seat, derived in the browser from the seat, not stored.
- **Parchment**: bottom centre above the timeline, folds to a chip. **Inspector**: top left under the
  title. Both plain parchment cards in the existing tokens. Areas keep their own selection for now.

## Design

### The domain of choices (`backend/domain`)

```kotlin
@JvmInline value class ChoiceId(val value: UUID);  @JvmInline value class OptionId(val value: UUID)
data class Choice(val id: ChoiceId, val prompt: String, val options: List<Option>)   // 2..4 options,
  // distinct ids, non-blank prompt, else HouseError.InvalidChoice(reason)
data class Option(val id: OptionId, val label: String, val detail: String, val effect: Effect)
sealed interface Effect { data class FoundAt(val seat: Location, val name: HouseName, val banner: Banner) : Effect }

data class GiveChoice(houseId, player, choice, worldTime, recordedAt) : HouseCommand
data class TakeAction(houseId, player, choiceId, optionId, worldTime, recordedAt) : HouseCommand
data class HouseGivenChoice(houseId, player, choice, worldTime, recordedAt) : HouseEvent
data class HouseTookAction(houseId, player, choiceId, optionId, worldTime, recordedAt) : HouseEvent
```

State: `House.NotFounded` becomes `data class NotFounded(val pending: Choice? = null)` (touches
`HouseDecider.kt:18,23`, `HouseDeciderSpec.kt:54`); `House.Founded` gains `val pending: Choice? = null`.

Decider rules (each a `HouseDeciderSpec` case, given/when/then over events):
- `GiveChoice` with nothing pending → `[HouseGivenChoice]`, founded or not.
- `GiveChoice` while one is pending → `HouseError.ChoicePending`; with a `FoundAt` option to a
  `Founded` house → `HouseError.AlreadyFounded`.
- `TakeAction` with nothing pending → `NoChoicePending`; wrong choice id → `NoSuchChoice`; unknown option
  → `NoSuchOption`.
- `TakeAction` on a `FoundAt` option → `[HouseTookAction, HouseFounded(seat, name, banner from the effect,
  FOUNDING_SIGNIFICANCE, empty treasury at the founding rate)]`.
- `FoundHouse` while a founding choice is pending is allowed; `evolve(HouseFounded)` sets `pending = null`
  ("founded by other means settles the founding choice").
- `evolve`: `GivenChoice` → `pending = choice`; `TookAction` → `pending = null`.
- Property: folding twice yields the same state (TESTING.md rule).

Catalogue rows in `docs/EVENTS.md` (ordered by version then alphabetically):

| Type | Payload |
|---|---|
| `villages.house.founded.v1` | unchanged |
| `villages.house.givenChoice.v1` | `houseId`, `player`, `choice`, `worldTime`, `recordedAt` |
| `villages.house.tookAction.v1` | `houseId`, `player`, `choiceId`, `optionId`, `worldTime`, `recordedAt` |

Naming gains camelCase verb phrases: `EventCatalogueSpec.kt:18` and `EventTypeCatalogueSpec.kt:18`
regexes become `[a-zA-Z]+`; `catalogueNameOf` becomes `simpleName.removePrefix("House")
.replaceFirstChar { it.lowercase() }`. EVENTS.md "Naming" gets the sentence.

JSON: the sealed `Effect` needs a discriminator and the domain may carry no annotations, so
`HouseEvents.json` registers a **mix-in**: `JsonMapper.builder().addMixIn(Effect::class.java,
EffectJson::class.java)` where `EffectJson` (in `villages.occurrent`) carries `@JsonTypeInfo(use = NAME,
property = "kind")` + `@JsonSubTypes(FoundAt = "foundAt")`. Jackson 3.1.5 has `addMixIn` and honours the
`com.fasterxml.jackson.annotation` package `Frames.kt` already uses. A spec asserts the mix-in's names
equal `Effect::class.sealedSubclasses` (mirrors `EventTypeCatalogueSpec`). ADR 0034 extends ADR 0024's
encoding rules with "a sealed field carries `kind`".

Fixtures: `contracts/fixtures/events/villages.house.givenChoice.v1.json`, `…tookAction.v1.json`;
`HouseEventFormatSpec` gains a case iterating `HouseEventTypes.rows` so every catalogued type must have
a fixture that reads back (today only `founded` is pinned).

`HousesProjection.apply` (`HousesProjection.kt:47`) is an exhaustive `when`: the two new events `return`
before the row put, without bumping `applied`.

### Provenance on every event (`application`, `infrastructure-occurrent`, `protocol`, `gateway`)

- Event id: the CloudEvent `id`, a UUID Occurrent mints (already; now documented and asserted).
- Correlation id and causation id: CloudEvent **extensions** `correlationid`, `causationid`, stamped by
  the executor from the command's `Provenance`. The domain stays untouched.
- `Ports.kt`: `data class Provenance(val commandId: UUID, val correlationId: UUID)`;
  `HouseCommandExecutor.execute(command, provenance)`; `fun interface FreshIds { fun fresh(): UUID }`;
  `class WriteConflict(stream, expected) : RuntimeException`; `StoredEvent` gains `correlationId: String`,
  `causationId: String`.
- `OccurrentHouseCommandExecutor` (`HouseEvents.kt:49`) stops using the decider DSL and does an explicit
  read → fold → decide → write: `store.read(stream)` (version 0 for an absent stream),
  `converter.toDomainEvent` each, `HouseDecider.fold`, `HouseDecider.decide`; nothing written when the
  decision is empty; otherwise `CloudEventBuilder.v1(converter.toCloudEvent(e)).withExtension(...)
  .build()` for each and `store.write(stream, WriteCondition.streamVersionEq(version), events)` — **a
  `List<CloudEvent>`, not a `Stream`** (the only abstract overload in 0.33). Three attempts on
  `WriteConditionNotFulfilledException` (the DSL retried; we must not lose that), then `WriteConflict`.
  `HouseEvents.decider` and the DSL import go; `occurrent-decider` stays for `OccurrentSmokeSpec`
  (move to `testImplementation`).
- `CloudEvent.toStored` (`InMemoryWorld.kt:74`) reads the two extensions.
- Rule for who mints what: **the first message of a story is its own correlation** (`Provenance(id, id)`);
  a command from the browser has `causationId = commandId` (client-minted UUID) and `correlationId` =
  the story it continues, which **the server decides**: `takeAction` continues the pending choice's story
  (the gateway reads it from `ChoicesByPlayer`), anything else starts its own. Nothing about correlation
  crosses the wire from the client; a client cannot name a story that is not its own (ADR 0028 spirit).
- **`commandId` becomes a UUID** on the wire; the gateway rejects otherwise with `malformed`. Sweep in the
  same commit: `GatewaySpec.kt:113,291,515` and assertions `:266,:465,:497`; `AppBootsTest.kt:69,114`;
  fixtures `command.json`, `commandAccepted.json`, `commandRejected.json`; `EventsView.tsx:60`;
  `seed.ts:57` (`'seed'` would otherwise become twenty refusals).
- `EventFrame` gains `correlationId`, `causationId` (Kotlin, zod, `server/event.json` — whose `data` is
  stale, carrying `cell` and `at`; fix it to a real stored `HouseFounded`).
- Gateway maps `WriteConflict` → `commandRejected("conflict")` in its own `catch`.
- Debug panel: each event line shows the first four characters of its correlation id as a tag; the
  command note says `as <commandId>`; opening an event shows both ids, so causation is traceable to the
  command line above it. Commands are not stored (glossary), so the log line is the causation's record.

### Arrival and action (`application`, `projections`, `gateway`, `app`)

- `Gazetteer` (application): `data class Seat(name, region, where: Location, detail)`, about fifteen
  inland seats over at least five regions. Candidates to verify: Russian plain (55N 40E), steppe (47N
  66E), taiga (60N 95E), Mongolia (46N 104E), Sahara interior (24N 10E), Sahel (14N 4E), Congo basin
  (1S 23E), Tanzanian interior (6S 35E), Great Plains (41N 100W), Canadian shield (54N 95W), Amazon (5S
  62W), Chaco (24S 61W), Australian interior (24S 134E), Deccan (19N 77E), Bohemia (49.7N 15E,
  marginal), Anatolia (39N 34E, marginal). The warp moves things up to eight degrees, so a scratch script
  reads the z7 tiles of `terrain`, `terrain2`, `terrain3` at each seat and prints a seat × master table
  of terrain classes; anything on water is dropped. Invented, chronicle-toned names.
- `FoundingChoices.forPlayer(player): Choice` — pure, deterministic from the player's UUID bits with
  `java.util.Random` (its sequence is specified; `kotlin.random` is not across runtimes): three seats from
  three distinct regions, each option with its own `HouseName` and rule-of-tincture `Banner`; one prompt.
  Spec: same player → same choice; distinct regions; valid banners and names.
- `Arrival(executor, clock, world, ids: FreshIds).arrive(player): Choice?` — executes `GiveChoice` with
  `Provenance(id, id)` and returns the choice; `ChoicePending`/`AlreadyFounded` from the decider mean
  "nothing to give" → `null`. No read-model guards: the decider is the truth and this removes a stale-read
  race.
- `TakeActionService.take(houseId, player, choiceId, optionId, provenance)`.
- Port `ChoicesByPlayer { pendingOf(player): ChoiceRow?; watch((PlayerId, ChoiceRow?) -> Unit): AutoCloseable }`,
  `ChoiceRow(player, houseId, choice, correlationId, version)`. `ChoicesProjection(feed)` folds
  `GivenChoice` (put), `TookAction` (remove), `Founded` (remove), notifies watchers.
- **Appeared vs changed**: `Gateway.kt:149` says `version == 1L` means appeared; a house founded from a
  choice lands at version 3. `HousesByCell.watch` carries `HouseChange(row, appeared)` where `appeared` is
  whether the projection's put was new; `reduceHouses` needs nothing.
- Gateway (`Gateway.kt:216-245, 261-283`): constructor gains `arrival`, `takeAction`, `choices`. `hello`:
  after `YourHouse`, `arrival.arrive(who)` (guarded; a failure is an `ErrorFrame("arrival", …)`), then
  `YourChoice((given ?: choices.pendingOf(who)?.choice)?.toView())` — sent from what arrive returned, so
  the asynchronous projection cannot leave a `null` as the last word; the watch's duplicate is
  idempotent. `choices.watch { p, row -> sessions[p]?.out?.send(YourChoice(row?.toView())) }`, closed in
  `close()`. `command`: `TakeActionPayload(choiceId, optionId)` → parse UUIDs → `Provenance(commandId,
  choices.pendingOf(who)?.correlationId ?: commandId)` → `takeAction.take(...)`. `reasonCode()` gains
  `choicePending`, `noChoicePending`, `noSuchChoice`, `noSuchOption`, `invalidChoice`.
- Frames (Kotlin `Frames.kt`, zod `frames.ts`, fixtures): `takeAction` payload; `yourChoice { choice:
  ChoiceView? }` with `ChoiceView(id, prompt, options: List<OptionView>)`, `OptionView(id, label,
  detail, effect)`, `sealed EffectView { foundAt(seat: Point, name, banner: BannerSpec) }`. Fixtures
  `client/command-takeAction.json` (a second file of type `command`; both contract tests tolerate it) and
  `server/yourChoice.json`.
- `WorldConfig`: wires `FreshIds { UUID.randomUUID() }`, `Arrival`, `TakeActionService`,
  `ChoicesProjection`, and passes them to `Gateway`.
- `AppBootsTest` extended: hello → `yourChoice` with three options → `takeAction` → two event frames
  (`tookAction` v2, `founded` v3; `givenChoice` was v1) sharing one correlation id whose causation is the
  command id → `yourHouse` at the chosen seat, `houseAppeared` in the cell → `yourChoice` null.
- Tests the change forces: `TinyWorld` (`GatewaySpec.kt:48-81`) stores any `HouseEvent` with its type and
  the two new `StoredEvent` fields (its `as HouseFounded` cast at `:59` goes); `HandFed`
  (`HousesProjectionSpec.kt:40`); `RememberingExecutor` (`FoundHouseServiceSpec.kt:25`); GatewaySpec
  expectations that hello yields exactly `[Welcome, YourHouse]` (`:170-177`) or count events/versions
  (`:267,:272,:341,:343,:482,:518`) change deliberately, because a hello now gives a choice.

### Wipe the world (`application`, `occurrent`, `projections`, `gateway`, `protocol`, `web`)

- Port `fun interface WorldWipe { fun wipe(): Int }` (events removed). `InMemoryWorld.wipe()` deletes every
  stream (`EventStoreOperations.delete(Filter.all())` or `deleteEventStream` over `all()`; verify
  `InMemoryEventStore` implements `EventStoreOperations` at compile time). `HousesProjection.reset()`,
  `ChoicesProjection.reset()`. `WorldConfig` composes the three into one `WorldWipe`.
- Frames: client `wipeWorld {}`; server `worldWiped { message }`. Gateway: wipe, then every connection is
  finished the way `standDown` finishes one, told `worldWiped`; `sessions`, `holding`, `watching` cleared.
  The browser notes it and reloads; hello then gives a fresh founding choice at stream version 1, which
  is how the test proves the store is empty.
- ADR 0036 says plainly: ADR 0011's "every wipe is journalled" is about a wipe forced by an event change
  on a world that had players; this empties an in-memory development world that dies at every restart
  anyway, and its record is the debug log line.

### Frontend

- `net/gateway.ts`: `GatewayState.yourChoice: ChoiceView | null`, `acting: string | null` (command id in
  flight); `heard` handles `yourChoice` (note `choice`), `worldWiped` (note, reload), clears `acting` on
  accept/reject; `takeOption(choice, option)` sends `command` with `commandId = crypto.randomUUID()`;
  `restart()` forgets the token and reloads.
- `client-core/identity.ts`: `forgetPlayerToken(store)` sets the key to `''` (blank already means absent
  to `ensurePlayerToken`; no `remove` needed). Test.
- `choice/Parchment.tsx` + CSS: shown when `yourChoice !== null`; prompt; one button per option (label,
  detail); disabled while `acting` or not connected; fold/unfold to a chip ("a letter awaits"),
  remembered in `localStorage` `villages.parchment.folded`, unfolded when a new choice arrives; on accept
  `map.flyTo` the chosen seat at zoom 8.5.
- Candidate marks: `MapSprite.kind: 'house' | 'candidate'`; `App.tsx` adds one candidate sprite per
  `FoundAt` option of `yourChoice`; the renderer draws candidates as a small flag at every zoom.
- Castle: `PixiSpriteRenderer.buildTextures()` replaces the shield with a castle silhouette (keep, two
  towers, battlements), white, tinted per house as today; the dot below marker zoom stays.
- Selection: `SpriteRenderer` gains `hitTest(point): string | null` (`sprite.getBounds().containsPoint`
  over visible entries; `event.point` is in the same CSS-pixel frame as `toScreen`) and
  `setSelected(id)` (a gold ring under the sprite, slight scale). `SpriteOverlay` registers `map.on
  ('click')` **before** `AreaOverlay` (tree order) and calls `preventDefault()` on a hit;
  `AreaOverlay.tsx:342` returns early when `defaultPrevented`. Store `select/selection.ts`
  (`Selected = { kind: 'house'; id } | null`, `select`, `selectionNow`, `watchSelection`, notes).
- Influence zone: `packages/world/src/influence.ts` `influenceZoneAround(seat, grid, reach): Fence` —
  a ring around `toRasterPixel(seat)` converted with `latticeToLngLat`, through the existing `enclose` +
  `fenceAround`; test: seat pixel inside, size ≈ πr², symmetric. `influence/InfluenceOverlay.tsx`
  mirrors `AreaOverlay`'s source + fill + line layers for every house in view, fences memoised by house
  id, layers `minzoom` at the marker threshold, thicker line for the selected house.
- `inspect/Inspector.tsx` + CSS, top left: name, banner in words, seat, founded day (`describeDay`), live
  treasury (`amount + rate · elapsed`, skew ignored until the ticker increment), "yours" when it is,
  short id and version, and the influence zone's census via `areas/census.ts censusOf` (top three
  classes by name from `terrainPalette()`); close button; "out of view" when the house left the held cells.
- Debug panel: `report.ts` `MapState` gains `choice` and `selected`; `describeState` lines `choice:`
  ("none" / `"<prompt>", 3 options`) and `selected:`; `report.test.ts` updated. `EventsView`: correlation
  tag, `saidPlainly` de-camels (`givenChoice` → "given choice"), `restart` and `wipe the world` buttons
  in the panel bar (no confirm; the note line is the record).

## Increments

Each is one commit, presented and stopped for Adam's word (CLAUDE.md working agreement). The order is a
menu; Adam reorders. Before increment 1: write `.sessions/2026-09-15-first-gameplay-loop.md` in
`E:\Code\Villages\.sessions\` (touching: backend all modules but rabbit; frontend protocol, client-core,
world, apps/web; docs; contracts), read the other files there again (the `pixel-master-projections`
session is changing the served world's directory layout and `map/**`; `game-events-design` touches
`Ports.kt` `WorldClock` lines and claims ADR 0030 — my ADRs are 0034–0036 and my `Ports.kt` edits avoid
the clock block; both are merge-time notes).

**Worktree readiness, before anything runs:** `npm install --prefix frontend`; junction the main
checkout's tiles (`mkdir frontend\apps\web\public` then `cmd /c mklink /J frontend\apps\web\public\world
E:\Code\Villages\frontend\apps\web\public\world`); `node frontend/apps/web/vite/worktreePort.ts --launch`
(this tree serves on **5548**; the stale `.claude/launch.json` says 5173 and the main checkout's backend
path). **8080 is taken** by another process (PID 25360, not ours; do not stop it): run this tree's
backend with `:app:bootRun --args=--server.port=8081` and point Vite at it with
`frontend/apps/web/.env.local` → `VITE_GATEWAY_URL=ws://localhost:8081/ws` (gitignored). Recheck at
implementation time. First `./gradlew check` in a fresh tree compiles everything (minutes).

### 0. The plan and the paradigm (docs only)
- `docs/plans/2026-09-15-first-gameplay-loop.md`: this plan, approved, copied like the startup plan.
- `docs/MECHANICS.md` first version: *how a mechanic becomes events* — the questions to answer first
  (what happened, whose stream, what the player sees, what the player can do, what the world remembers);
  the shapes (a fact recorded; a decision put to the player: giver → `GivenChoice` → parchment →
  `takeAction` → `TookAction` + consequences from one decide; a rate that changes; later, a thing with a
  lifetime); naming (aggregate as subject, past tense, camelCase verb; commands imperative); what every
  event carries (two times, place + significance, provenance in the envelope); the checklist (class, type
  row, catalogue row, fixture, decider branch, projection branch, frame + zod + fixture, debug line,
  glossary) and the four tests that fail until it is complete; adding a new kind of choice = a new
  `Effect` subtype + decider branch + giver + the consequence events' rows, no UI work; definition of
  done (the panel shows it, the parchment renders it).
- ADRs proposed: **0034** a choice is put to a house on its own stream and an action takes one option
  (effects with `kind`, one decide yields action + consequences, founding by other means settles it, the
  gazetteer, each option a destiny; Player aggregate declined); **0035** every event carries its
  provenance (envelope extensions, who mints what, the explicit executor with retry, `WriteConflict`);
  **0036** starting over (forget identity; wipe the development world; relation to 0011).
- `docs/experiments/0004-the-first-choice.md`, open: "Offered three seats on a parchment with no other
  instruction, a new player founds a house within a minute and can say why they chose that seat."
- GLOSSARY: Choice, Option, Effect, Action, Arrival, Provenance, Event id, Correlation id, Causation id,
  Gazetteer, Parchment, Inspector, Restart, Wipe; Influence zone updated. ROADMAP: a "Now: the first
  gameplay loop" list of increments 1–9. CLAUDE.md: MECHANICS.md in the layout and "read it before adding
  gameplay". Nothing runs; the documents stand in.
- `docs: the first gameplay loop, planned, and how a mechanic becomes events`

### 1. Provenance on every event
- Backend as designed (Provenance, FreshIds, WriteConflict, explicit executor with retry, StoredEvent,
  EventFrame, gateway UUID check and conflict mapping), the commandId sweep, fixtures `command.json`
  (UUID) and `event.json` (ids + honest data), zod. Frontend: UUID command ids in `EventsView`/`seed.ts`,
  correlation tag on event lines, `as <id>` in command notes.
- Tests: `InMemoryWorldSpec` asserts `correlationid`/`causationid` survive the write and equal the
  provenance, and a conflict surfaces as `WriteConflict`; `GatewaySpec` rejects a non-UUID command id and
  maps conflict; contract specs both sides; `report.test.ts` untouched.
- Docs: ADR 0035 accepted; EVENTS.md "What an event carries" gains provenance; ADR 0024 gets a one-line
  "extended by 0035"; ARCHITECTURE "What was verified about Occurrent" says the DSL was replaced and why.
- Shows: press `found a house here`; the note line carries the command id; the event line carries the
  correlation tag; open it and `causationId` equals the command id above.
- `feat(occurrent): every event carries a correlation id and a causation id`

### 2. The domain of choices
- `Choice`, `Option`, `Effect.FoundAt`, ids, `GiveChoice`, `TakeAction`, `HouseGivenChoice`,
  `HouseTookAction`, `House.pending`, new `HouseError`s, decider + evolve; catalogue rows and the camelCase
  regex/name change in both catalogue specs; `HouseEventTypes` rows; `EffectJson` mix-in and its spec;
  two event fixtures and the "every catalogued type has a fixture" case; `HousesProjection.apply`
  branches; `TinyWorld`/`HandFed` type strings.
- Tests: `HouseDeciderSpec` cases above plus the fold property; `HouseEventFormatSpec` round trips.
- Docs: ADR 0034 accepted; EVENTS.md rows and naming sentence; GLOSSARY code names filled in.
- Shows: nothing in the program yet; the specs and the two fixtures stand in, and I say so.
- `feat(domain): a house can be given a choice, and take one option of it`

### 3. Restart: a player starts over
- `forgetPlayerToken` in client-core (+ test); `restart()` in `gateway.ts`; `restart` button in the debug
  bar; note `starting over as a new player`.
- Docs: ADR 0036 accepted (the wipe half lands in 6); CLAUDE.md "How to run" mentions the button.
- Shows: press `restart`; the `player:` line shows a new id, `house: none yet`, the note in the log.
- `feat(web): the debug panel starts a player over`

### 4. The loop, end to end on the wire
- Application: `Gazetteer`, `FoundingChoices`, `Arrival`, `TakeActionService`, `ChoicesByPlayer`,
  `HouseChange`; projections: `ChoicesProjection`, `appeared` on the houses watch; protocol both sides +
  fixtures (`takeAction`, `yourChoice`); gateway hello/command/watch/reasons; `WorldConfig`;
  `AppBootsTest` as designed. Frontend: `yourChoice` in state with a note, `choice:` debug line,
  `saidPlainly` de-camel. The seat check script's table goes in the presentation.
- Tests: `FoundingChoicesSpec`, `ArrivalSpec`, `TakeActionServiceSpec`, `ChoicesProjectionSpec`,
  `GatewaySpec` (hello gives a choice once; taking it founds; the wrong option is refused with its
  reason; a founded player is given nothing), `AppBootsTest`.
- Docs: ARCHITECTURE "How a change travels" gains the choice sequence; GLOSSARY Arrival.
- Shows: press `restart`; the event list shows `house given choice v1`, open it to three options; the
  `choice:` line reads the prompt and `3 options`.
- `feat(gateway): a new player is given three seats, and taking one founds the house`

### 5. The parchment
- `Parchment.tsx` + CSS, `takeOption`, `acting`, fold chip, candidate flags in `App.tsx` and the
  renderer, fly-to on accept.
- Tests: none component-level (no jsdom in the repo); the pure parts (`describeChoice` for the panel,
  fold persistence helper) get Vitest.
- Docs: ROADMAP 1.13 ticked; GLOSSARY Parchment code name; MECHANICS "what the player sees".
- Shows: `restart` → the parchment lies over the map with three seats, three flags on the map; pick one →
  `house took action v2`, `house founded v3` in the list with one correlation tag, the camera flies, the
  parchment is gone, `house:` names it.
- `feat(web): a choice is put to the player as a parchment, and the first founds the house`

### 6. Wipe the world
- Port, `InMemoryWorld.wipe()`, projection resets, frames `wipeWorld`/`worldWiped` + fixtures + zod,
  gateway finishing every session, `wipe the world` button, browser reload on `worldWiped`.
- Tests: `InMemoryWorldSpec` (a wiped store reads empty and a founding lands at v1 again), `GatewaySpec`
  (every session told and finished), `AppBootsTest` (found, wipe, hello again → no house, a fresh choice).
- Docs: ADR 0036's wipe half is now code; CLAUDE.md button; EVENTS.md/ADR 0011 cross-reference.
- Shows: two windows, `wipe the world` in one → both reload, both get a parchment, `houses:` reads zero.
- `feat(gateway): the debug panel can empty the development world`

### 7. The castle and its ground
- Castle texture; `influenceZoneAround` (+ test) in `@villages/world`; `InfluenceOverlay`.
- Docs: GLOSSARY Influence zone "now in the source"; SETTING.md influence zones sentence points at it.
- Shows: at zoom 8 and beyond every house is a castle with a fenced ring of ground; yours included.
- `feat(web): a house is a castle with a fence of ground about it`

### 8. Selecting a house, and the inspector
- `hitTest`/`setSelected`, click wiring and `defaultPrevented` in `AreaOverlay`, selection store,
  `Inspector.tsx` + CSS, `selected:` debug line, auto-select your house after founding.
- Tests: `report.test.ts` lines; a pure hit-test helper test if the maths leaves the renderer.
- Docs: ROADMAP 1.15 partly ticked (inspecting; the badge is not this); GLOSSARY Inspector.
- Shows: click the castle → it rings gold, the inspector on the left names it, its seat, treasury ticking,
  the census of its ground; click the map → cleared; `selected:` says so.
- `feat(web): a castle can be selected, and the inspector says what it is`

### 9. Close the iteration (docs)
- Experiment 0004 observations and result from Adam's play; MECHANICS.md corrected by what the eight
  increments taught; ROADMAP ticks; a follow-ups menu.
- `docs: what the first gameplay loop taught`

## Verification, end to end

- Backend: `cd backend` then `./gradlew check` (JDK fetched by the toolchain). Frontend:
  `npm run check --prefix frontend`. Both green before every presentation, output quoted.
- Running: `web` from `.claude/launch.json` (port 5548) and the backend on 8081 as above, left running at
  `http://localhost:5548/` on the `raw` renderer at zoom 8 over the chosen seat; the debug panel copied
  into the presentation (ADR 0023).
- The loop, in the browser after increment 5: `restart` → parchment with three options and three flags →
  pick → event list shows `given choice v1`, `took action v2`, `founded v3` with one correlation tag,
  each `causationId` matching a command id in the log → castle at the seat → second window sees
  `houseAppeared`. After 6: `wipe the world` empties both windows and both are offered seats again.
- Seats: the scratch script's seat × master table, all land, quoted in increment 4's presentation.

## Risks and what I will do about them

- **Occurrent API drift while rewriting the executor** — signatures verified by javap on 0.33.0 (write
  takes a list; `streamVersionEq`; `CloudEventBuilder.v1(CloudEvent).withExtension`); compile is the check.
- **`InMemoryEventStore` may not expose deletion** — fallback is per-stream `deleteEventStream`; if
  neither, the wipe swaps the store behind `InMemoryWorld` and re-subscribes the projections; say so.
- **A seat lands on water after a repaint** — the check script is rerun whenever the gazetteer or a
  master changes; ADR 0034 names seats-as-data (`world/seats.json`) as the next step if Adam wants to
  author them.
- **Sibling branches** touch `Ports.kt`, ADR numbering and the served world layout — noted for the merge.
- **Every GatewaySpec expectation about hello changes** — deliberately; a gateway that offers no choice
  is not this gateway.

## Follow-ups to offer after increment 9 (not in this iteration)

Seeds take one of their offered seats instead of founding directly (the seed then exercises the real
loop); the HUD reflects `yourHouse`; area selection joins the inspector; a backend port per worktree like
the web port; the ticker with clock skew (roadmap 1.14); seats as authored data; a chronicle view that
groups the log by correlation id.
