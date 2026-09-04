# Roadmap

Three lists. "Now" holds only the current phase. Anything speculative stays in "Later" until it has a hypothesis in
the experiment journal.

## Now: Phase 0, bootstrap

An empty but complete skeleton, where every layer exists, every check runs, and every document has a first version.
The increment list lives in the startup plan under `docs/plans/`.

This list is a menu, not a queue. The order below is a suggestion; Adam picks the next step after each commit from
options offered then, and reordering costs nothing. See decision record 0016.

The order changed once already, for a reason worth keeping: the primary way we judge this project is by looking at
it, so the increments that put something on the screen came first, and they happen to be the ones that need nothing
installed. The backend increments follow, and keep their original numbers.

- [x] 0.1 Repository, working agreement, commit gate
- [x] 0.2 Core documents and templates
- [x] 0.3 Decision records for the founding decisions, and the first experiment
- [x] 0.10 Frontend workspaces, linting, typechecking, and the core to interface boundary
- [x] 0.11 The map renders with attribution
- [x] 0.12 The sprite overlay draws one jiggling sprite pinned to a place
- [ ] 0.13 End-to-end smoke test
- [ ] 0.4 Local infrastructure: MongoDB replica set and RabbitMQ in Compose
- [x] 0.5 Gradle wrapper, version catalog, module skeletons with their dependency edges
- [ ] 0.6 Architecture tests that fail on a layer violation
- [ ] 0.7 Occurrent smoke test on the in-memory event store
- [ ] 0.8 Testcontainers smoke test on MongoDB and RabbitMQ
- [ ] 0.9 The application boots and the gateway answers a hello
- [ ] 0.14 One check script for the whole repository

Blocked on the machine: Docker Desktop with the WSL2 backend, needed for 0.4, 0.8 and 0.9. Temurin 21 is not
a blocker after all: Gradle provisions the toolchain itself, so 0.5 to 0.7 build on the Temurin 17 that is
there. Installing 21 is still worth doing for IntelliJ.

## Also now: the world, authored by hand

A side mission that grew, because the map is the main screen and it has to be ours.

- [x] The warp: a pure transformation from Earth to our world, configured by one file
- [x] Fidelity: lakes, rivers and biomes, and a global wobble so the whole world differs from Earth
- [x] The master image: Earth's terrain as one editable colour per class, and the guide to editing it
- [x] The importer: read the edited master back, trace coastlines, and give the game its world
- [x] A higher-fidelity world: 32 terrain classes from land cover, lake and river data
- [x] Terrain drawn from tiles rather than traced, so the fidelity is affordable
- [x] The painterly treatment, settled offline in still images: what the world actually looks like
- [ ] The same treatment in the live map, as a WebGL layer, so it is drawn at any zoom
- [ ] Place names carried through from Earth, mutated

Decided along the way: the world is authored in an image editor rather than in a tool of our own, because
terrain that travels with a copied coastline is free in a raster and expensive in anything else. See
decision record 0018.

## Also now: the debug panel, which is how Adam checks the program

Adam verifies by looking at the running program, not by reading code, and the debug panel is where the
program says what it is doing. It grows with every increment that adds behaviour. See decision record 0023.

- [x] State of the map, the renderer and the paint, copyable in one click
- [ ] Domain events as they reach the browser: one line each in words, opening to the whole CloudEvent
- [ ] Commands sent and their acceptance or rejection, alongside the events they caused
- [ ] The connection: hello, subscriptions, resyncs, reconnects

## Next: Phase 1, the walking skeleton

Found a House. Open the app, see the map, found a house at a chosen spot with a generated banner, see the banner and
one rate-based ticker, and see other players' houses appear live and jiggle. Sixteen increments, listed in the plan.

The milestone: a second browser sees the first browser's house appear, with no page reload, and the event
that made it appear is readable in the debug panel of both.

## Later

Phase 2, aliveness and scale. A bot swarm to ten thousand connections on one machine. Aggregation of sprites at low
zoom, so that a large world never means a large sprite count. A custom stylised map style, checked in. Hardened
reconnection and clock correction.

Phase 3 and beyond, experiments. Each needs a hypothesis file before any code:

- House leanings: what identity is made of, and how the world reflects it.
- A second resource, and the first decision worth making about it.
- Holdings on the map beyond the seat.
- Neighbours: awareness of nearby houses, and the first thing two houses can do to each other.
- Accounts behind the identity port.
- The world-persistence milestone, after which the event store is never wiped and event changes need upcasters.
