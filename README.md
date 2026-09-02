# Villages

An exploratory, persistent, multiplayer experience. Each player plays a fictional noble house on a map of the real
world: found your seat, raise your banner, watch your treasury tick, and discover what your house stands for.

Technically: Kotlin + Spring Boot with event sourcing (Occurrent, MongoDB, RabbitMQ) behind a WebSocket gateway;
React + TypeScript with MapLibre GL and a PixiJS sprite overlay in the browser. One shared world, designed for tens of
thousands of concurrent players.

## Documents

- `CLAUDE.md` - how we work in this repository (conventions, layer rules, the commit gate)
- `docs/VISION.md` - what the experience is and is not
- `docs/GLOSSARY.md` - the shared vocabulary used in code, events and UI
- `docs/ARCHITECTURE.md` - layers, modules, event flow, scale principles
- `docs/adr/` - architecture decision records
- `docs/experiments/` - hypothesis, result, decision for every experiment
- `docs/ROADMAP.md` - now / next / later
- `docs/EVENTS.md` - catalogue of every domain event
- `docs/TESTING.md` - the test pyramid and how to run it

## Five-minute start

Prerequisites: Docker Desktop, Eclipse Temurin 21 (JAVA_HOME), Node 24.

The start commands are added as the corresponding increments land; see `docs/ROADMAP.md`.
