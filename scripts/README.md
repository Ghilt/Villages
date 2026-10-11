# Adam's tools

> **What belongs here:** terminal tools Adam runs by hand to change the files the game reads - the masters,
> and in time anything else in `world/` - and to look after the machine it runs on: the repository's one check.
> **What does not:** anything the program runs, builds or serves, which
> lives in `frontend/` and `backend/`; and the program's own world pipeline, the `world:*` commands, which is
> `docs/RUNNING.md`. See decision record 0082.

## Running one

Open this folder in a terminal and run a tool with Node. Given nothing, every tool says what it does and how
to run it:

```
cd E:\Code\Villages\scripts
node mend-rivers.ts
```

Node 24 is all most of them take. The ones that read or write WebP need sharp, which Node cannot do without:
run `npm install` in this folder once, and a tool that needs it and does not find it says so. Nothing here
imports the program, so a tool works on any checkout, whatever state the frontend is in.

## The tools

| Tool             | What it does                                                                                                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mend-rivers.ts` | Joins a master's broken rivers to the sea, painting as few land pixels to river as it can, and writes a mended copy and an audit picture beside it. `docs/AUTHORING-THE-WORLD.md` says more                                                                                                                                    |
| `nine-slice.ts`  | Makes a border for the game, `<name>.webp` and its file of cuts, from a picture of a frame, with a recipe to make it again. Finds the cuts itself, with or without lines between the tiles. Needs sharp. `docs/AUTHORING-THE-ART.md` says more                                                                                 |
| `check.ts`       | Every check in the repository, one part after another - the backend's, the frontend's and this folder's - each part's whole output in `.logs/check-<part>.log` and one line a part said. `check.ps1` and `check.sh` run it. The one tool here that does its work given nothing, because checking everything is the whole of it |

## Adding one

- **One file a tool**, at the top of this folder, named for what it does: `mend-rivers.ts`. What two tools
  share goes in `lib/`, and its tests in `test/`.
- **Given nothing, or `--help`, it prints its help and stops.** The help says what it does, every argument,
  what it writes and where, roughly how long it takes, and one example to copy.
- **It writes into the folder it is run in, or into `--out`**, never over what it read, and **it ends by
  saying what it wrote and where**: every file's whole path and what it is for. A tool knows no folder of
  the program's by heart; it is told where its input is and where to put what it makes.
- **Node and its own modules**: `node:fs`, `node:zlib`, `node:util`'s `parseArgs`. Reading and writing PNGs
  is `lib/png.ts`, and a master as one class a pixel is `lib/master.ts`, which reads the classes from
  `world/palette.json`. **WebP is sharp**, loaded by `lib/sharp.ts`, and sharp is the one package here: a
  tool that wants another has to argue for it first.
- **Add it to the table above**, and to the document that owns the files it changes.

## Checking

```
node check.ts --only scripts
```

That runs this folder's three checks, which `node check.ts` runs with the rest of the repository's. By hand:

```
node --test
..\frontend\node_modules\.bin\tsc -p .
```

The first runs every test in `test/` with Node's own runner. The second checks the types, borrowing the
compiler from the frontend's install because this folder has none of its own; Node itself only strips the
types and never checks them. Formatting follows the frontend's Prettier settings:
`..\frontend\node_modules\.bin\prettier --config ..\frontend\.prettierrc.json --check .`
