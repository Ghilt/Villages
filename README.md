# Villages

An exploratory, persistent, multiplayer experience. Each player plays a fictional noble house on a map of the real
world: found your seat, raise your banner, watch your treasury tick, and discover what your house stands for.

Technically: Kotlin + Spring Boot with event sourcing (Occurrent, MongoDB, RabbitMQ) behind a WebSocket gateway;
React + TypeScript with MapLibre GL and a PixiJS sprite overlay in the browser. One shared world, designed for tens of
thousands of concurrent players.

## Documents

- `CLAUDE.md` - how we work in this repository (conventions, layer rules, the commit gate)
- `docs/VISION.md` - what the experience is and is not
- `docs/SETTING.md` - the world, its two clocks, and what a house is inside it
- `docs/MECHANICS.md` - what the mechanics are, one entry per named mechanic
- `docs/BUILDING-A-MECHANIC.md` - how a described mechanic becomes commands, events and panel lines
- `docs/LOOK-AND-FEEL.md` - the shared visual language and the components more than one mechanic uses
- `docs/RESPONSIVE-DESIGN.md` - how the interface behaves on a phone as well as a desktop
- `docs/GLOSSARY.md` - the shared vocabulary used in code, events and UI
- `docs/ARCHITECTURE.md` - layers, modules, event flow, scale principles
- `docs/adr/` - architecture decision records
- `docs/experiments/` - hypothesis, result, decision for every experiment
- `docs/ROADMAP.md` - now / later / future ideas
- `docs/EVENTS.md` - catalogue of every domain event
- `docs/TESTING.md` - the test pyramid and how to run it
- `docs/RUNNING.md` - what each part of the running program does, and where to find it

## Five-minute start

One command, from the repository root:

```
.\debug-quick-start.ps1
```

It checks the tools, installs the packages again whenever `package-lock.json` has changed since they were
installed, generates whatever part of the world is missing or older than the hand-painted master, so a
repainted master is cut again by itself, starts the game server and the dev server,
waits until both answer, prints the address to open, and opens it. From Explorer,
`debug-quick-start.cmd` beside it does the same on a double click. Add `-Stop` to shut both down,
`-Logs` to print what they said, `-WebOnly` for the map without the game server. Node 24 is the only
thing it needs; without a JDK it starts the map alone and says so.

The commands it runs, if you would rather run them yourself:

```
npm install --prefix frontend
npm run world:import --prefix frontend
npm run world:tile --prefix frontend
npm run world:flow --prefix frontend
npm run dev --prefix frontend
cd backend && .\gradlew.bat :app:bootRun
```

Then open http://localhost:5173 and you are looking at the world: pan and zoom, and see the frame your
house will occupy. The map is ours, and it carries no text at all. It is painted by hand as an image,
`world/master/terrain.png`, one flat colour per terrain across thirty-two of them: edit that in any image
editor, run the world commands again, and the world changes. `docs/AUTHORING-THE-WORLD.md` explains
how. Setting `VITE_MAP_STYLE_URL` shows a real map of Earth instead, for comparison.

The **Debug map** panel at the top right picks which master is drawn - every PNG in `world/master/` is
offered, and one that has never been cut into tiles can be cut from there - and which renderer draws it.
The debug panel under it says what the program thinks is happening: the state of the world, and every
event as it arrives. Its "found a house here" button sends a real command, and its first lines say where
the world is kept: in MongoDB when Docker is running, where a restart of the game server forgets nothing,
and in memory when it is not, where a restart forgets the houses.

`npm run check --prefix frontend` runs the typecheck, the linter, the formatter and the unit tests.

MongoDB and RabbitMQ are in `infra/docker-compose.yml`, and Docker Desktop on WSL2 runs them. The
quick start brings them up when Docker is running and they are not, and by hand it is:

```
docker compose -f infra/docker-compose.yml up -d
```

Every checkout keeps its world in a database of its own in that one MongoDB, so several can run at once
without touching each other's houses. RabbitMQ is not used yet.
