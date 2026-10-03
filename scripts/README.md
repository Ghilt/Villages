# Adam's tools

> **What belongs here:** terminal tools Adam runs by hand to change the files the game reads - the masters,
> and in time anything else in `world/`. **What does not:** anything the program runs, builds or serves, which
> lives in `frontend/` and `backend/`; and the program's own world pipeline, the `world:*` commands, which is
> `docs/RUNNING.md`. See decision record 0082.

## Running one

Open this folder in a terminal and run a tool with Node. Given nothing, every tool says what it does and how
to run it:

```
cd E:\Code\Villages\scripts
node mend-rivers.ts
```

Node 24 is all it takes. Nothing here needs `npm install`, and nothing here imports the program, so a tool
works on any checkout, whatever state the frontend is in.

## The tools

| Tool             | What it does                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mend-rivers.ts` | Joins a master's broken rivers to the sea, painting as few land pixels to river as it can, and writes a mended copy and an audit picture beside it. `docs/AUTHORING-THE-WORLD.md` says more |

## Adding one

- **One file a tool**, at the top of this folder, named for what it does: `mend-rivers.ts`. What two tools
  share goes in `lib/`, and its tests in `test/`.
- **Given nothing, or `--help`, it prints its help and stops.** The help says what it does, every argument,
  what it writes and where, roughly how long it takes, and one example to copy.
- **It never writes over what it read.** It writes beside the input, or into `--out`, under a new name.
- **Node and its own modules only**: `node:fs`, `node:zlib`, `node:util`'s `parseArgs`. Reading and writing
  PNGs is `lib/png.ts`, and a master as one class a pixel is `lib/master.ts`, which reads the classes from
  `world/palette.json`.
- **Add it to the table above**, and to the document that owns the files it changes.

## Checking

```
node --test
..\frontend\node_modules\.bin\tsc -p .
```

The first runs every test in `test/` with Node's own runner. The second checks the types, borrowing the
compiler from the frontend's install because this folder has none of its own; Node itself only strips the
types and never checks them. Formatting follows the frontend's Prettier settings:
`..\frontend\node_modules\.bin\prettier --config ..\frontend\.prettierrc.json --check .`
