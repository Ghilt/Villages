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

One command, from the repository root:

```
.\debug-quick-start.ps1
```

It checks the tools, generates whatever part of the world is missing, starts the game server and the dev
server, waits until both answer, prints the address to open, and opens it. From Explorer,
`debug-quick-start.cmd` beside it does the same on a double click. Add `-Stop` to shut both down,
`-Logs` to print what they said, `-WebOnly` for the map without the game server. Node 24 is the only
thing it needs; without a JDK it starts the map alone and says so.

The commands it runs, if you would rather run them yourself:

```
npm install --prefix frontend
npm run world:import --prefix frontend
npm run world:tile --prefix frontend
npm run dev --prefix frontend
cd backend && .\gradlew.bat :app:bootRun
```

Then open http://localhost:5173 and you are looking at the world: pan and zoom, and see the frame your
house will occupy. The map is ours, and it carries no text at all. It is painted by hand as an image,
`world/master/terrain.png`, one flat colour per terrain across thirty-two of them: edit that in any image
editor, run the two world commands again, and the world changes. `docs/AUTHORING-THE-WORLD.md` explains
how. Setting `VITE_MAP_STYLE_URL` shows a real map of Earth instead, for comparison.

The **Debug map** panel at the top right picks which master is drawn - every PNG in `world/master/` is
offered, and one that has never been cut into tiles can be cut from there - and which renderer draws it.
The debug panel under it says what the program thinks is happening: the state of the world, and every
event as it arrives. Its "found a house here" button sends a real command. Nothing is stored yet, so a
restart of the game server forgets the houses; that is deliberate until MongoDB arrives with increment
0.4.

`npm run check --prefix frontend` runs the typecheck, the linter, the formatter and the unit tests.

Docker Desktop is not needed yet: the event store and the broker are in memory behind their ports until
the increments in `docs/ROADMAP.md` put the real ones there.
