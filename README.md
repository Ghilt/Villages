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

Node 24 is all you need for the part that exists today.

```
npm install --prefix frontend
npm run dev --prefix frontend
```

Then open http://localhost:5173 and you are looking at the world: pan and zoom the map, and see the frame your
house will occupy. The map style comes from OpenFreeMap and needs no key; point `VITE_MAP_STYLE_URL` somewhere else
to use another one.

`npm run check --prefix frontend` runs the typecheck, the linter, the formatter and the unit tests.

The server needs Docker Desktop and Eclipse Temurin 21 on `JAVA_HOME`, and arrives with the increments listed in
`docs/ROADMAP.md`.
