# The world cache

**What belongs here:** how the world cache gets built - what a world step is filed under, where the shelf is,
how a tree borrows from it, what the quick start, the debug panel and the architecture page do with it, and the
order it all gets built in. **What does not:** why it is shaped this way, which is decision record 0095; what
each world tool makes, which is `RUNNING.md` and `AUTHORING-THE-WORLD.md`; the words, which are `GLOSSARY.md`.
When a part of it is decided, that part becomes a decision record and leaves.

---

## The problem, in one paragraph

A worktree started for a small change spends about seventeen minutes in the quick start before the game is up,
and about fifteen of them rebuild a world that another tree has already built from the same master. Everything
baked from the master - its outlines, tiles, rivers' flow, sprite map, ground, origin map, names, culture map
and height - is made per tree, because what a tree makes lives only in that tree and staleness is judged by
file dates, which git sets to the moment of checkout. Adam's ask, of 2026-10-12: those are resources every tree
can reuse, made once, and still rebuilt, without anybody asking, whenever the master or anything else they are
made from really changes.

## How a fresh tree starts today

From four fresh trees' logs and file times (docker-roadmap, building-system, debug-menu, laughing-elbakyan) and
the measured times in `admin/architecture/tools.ts`:

| What `debug-quick-start.ps1` does | In a fresh tree |
|---|---|
| ports, `launch.json`, the tools, the Docker stack | seconds |
| `npm install` in `frontend` | about 10 s |
| the world: ten tools one after another, each decoding the 2 GB master again | about 15 min |
| of which: height downloads 444 MB of ETOPO into the tree's own `world/source` | 6-7 min |
| of which: tile 2.5-3 min, origin 2-2.5 min, height's fitting 2.5 min, flow 45-80 s, import 30 s | |
| of which: names runs, writes nothing (a fresh tree has no Natural Earth), and runs again every start | |
| the sprites and the interface pictures, from empty caches | about 13 s |
| the game server: Gradle compiles `buildSrc` and eight modules from nothing | 1.5-1.7 min |
| the dev server | about 2 s |

And the dates miss real changes as well as inventing false ones: no step runs again for `palette.json`, tiles
not for `render.json`, origin not for `terrain-base.png`, and nothing for a change to a world tool's own code.
The debug panel's *cut it* runs a different list from the quick start's (no culture, no `paint.json`) and
writes through a linked folder into the main checkout's world.

## What a world step is

A **world step** is one tool's part of the world for one master: what it reads, what it writes, and the tool.
There are ten, in the order they run: import, tile, styles (`paint.json`), flow, sprites, ground, origin, names,
culture, height. `bin/lib/worldSteps.ts` is the table of them, and the one list everything else reads.

| Step | Reads | Writes: folders, borrowed by hard link | Writes: loose files, copied |
|---|---|---|---|
| import | master, palette | | `M/terrain.geojson`, `world/master/<m>-preview.png` |
| tile | master, palette, render | `M/tiles/` | |
| styles | palette, render, painterly | | `public/world/paint.json` |
| flow | master, palette | `M/flow/` | |
| sprites | master, palette, biomes | `M/sprites/biome/`, `world/stands/<m>/biome/` | |
| ground | master, palette | | `world/ground/<m>/ground.bin`, `ground.json` |
| origin | master, `terrain-base.png`, palette | `M/origin/` | |
| names | origin, Natural Earth, `names/1790.json`, `names/about.json` | | `M/names.json`, `M/regions.bin`, the same two in `world/ground/<m>/` |
| culture | origin, `cultures.json` | `M/culture/` | |
| height | origin, ETOPO, master, palette | `M/height/` | |

`M` is `frontend/apps/web/public/world/masters/<m>/`. The folders that hold more than one step's output stay
real in every tree: `public/world`, `M`, `M/sprites`, `world/stands/<m>` and `world/ground/<m>`.

## The fingerprint

A step's **fingerprint** is a hash of everything its output depends on:

- the bytes of the master and of every hand-written file it reads, hashed whole (a master is 25 MB, a fraction
  of a second) and remembered by path, size and date so a second asking costs nothing;
- the bytes of each downloaded source it reads, the same way;
- **absent**, for an optional input that is not there - Natural Earth, the review of 1790, ETOPO - because its
  absence changes the output; a run that wrote nothing is never filed;
- the tool's own code and every file it imports at run time, followed import by import (`import type` is
  skipped, because it is gone before the code runs), and the installed versions of the libraries it uses;
- the master's name and the tool's options, never an absolute path, or no two trees would ever agree;
- the fingerprints of the steps whose output it reads: names, culture and height read origin's.

`npm run world:ready -- --why` prints each step's fingerprint and, for a step that is not on the shelf, which
input differs from the entry the tree has now.

## The shelf

The **world cache** is one folder for the whole machine, in the shared git folder:
`E:\Code\Villages\.git\world-cache\`, found from any tree with `git rev-parse --git-common-dir`. Git never looks
inside its own folder, so no checkout's `git status` and no check ever sees it, from the first day (as git-lfs
keeps its store in `.git/lfs`).

- `<step>/<fingerprint>/` is an **entry**: exactly that step's output, `key.json` naming every input and its
  hash, and `said.txt`, what the tool printed as it made it.
- An entry is built in `<step>/<fingerprint>.making-<id>/`, by the tool itself told where to write
  (`--into <folder>`, under which it lays out what it would have written in the repository), so a tree goes on serving its old world while a long step runs. When the tool has exited
  without fault and every declared output is there, `key.json` is written, with the size and date of every file,
  and the folder is renamed to its fingerprint in one move.
- A folder without `key.json` is never borrowed.

## Borrowing

`npm run world:ready [master]` is the one runner, and the only thing that builds the world. For each step in
order it works out the fingerprint, and then:

- **on the shelf**: the tree's folders for that step are made again as real folders whose every file is a hard
  link to the entry's, about seven seconds for a whole master's 54,000 files and none of it copied; its loose
  files are copied, data before manifest (`ground.bin` before `ground.json`, `regions.bin` before `names.json`),
  each given the entry's date. The game server's readers reload on the manifest's date, so a reader that sees the
  new manifest finds the new data under it. What the tool printed when it was made is printed again. The tree
  writes down what it borrowed in `M/world-cache.json`, a step and fingerprint each, so the next start finds it
  borrowed already and does nothing.
- **not on the shelf**: the tool is run into a new entry, as above, and then borrowed.

`--only <step>` makes that step and every step made from it; `--force` builds even what is on the shelf, and
takes the old entry off it; `--why` says where each step stands and what moved, and makes nothing. The quick
start runs it for the default master and the debug panel's buttons run it for theirs. The `world:<step>`
scripts stay the tools themselves, run by hand for what only a hand run gives - the flow's stills, a tool's own
options - and make the tree's own world, which the next `world:ready` borrows over again.

The tool is run with a recorder loaded first (`bin/lib/recordReads.ts`) that writes down every file it opens to
read; an entry whose tool read a file of the repository that its fingerprint does not count is refused, and so
is one whose inputs changed while it ran.

**Never a junction.** A junction is a folder that is another folder, and `git worktree remove --force`, which
is how a tree is deleted, empties the folder it points at (experiment 0019). A hard link is a second name for one
file, and deleting a tree takes its names and leaves the file to every other.

**The downloads are borrowed the same way**: a tree is given a hard link to each file of the main checkout's
`world/source` it lacks, 4.9 GB and a few dozen files, so nothing is downloaded twice and every tree carries
names. `fetchWorld` downloads beside a file and renames over it, so a fetch in one tree never changes another's.

**Junctions a tree already has** are put right as it borrows: a junction of a whole `public/world`, or of a
master's `tiles` or `flow`, to the main checkout's - which seventeen trees have, made by hand before this - is
taken away, the link alone, and the tree borrows in its place; a whole linked `public/world` is made a real
folder whose other masters are borrowed from the main checkout's by hard link, as they were seen before.

## Invariants

- **An entry never changes once it is filed.** Held at the instant: tools write only into a `.making-` folder;
  every tool refuses to write over a borrowed world (its stamp is a hard link) or through a junction; whatever
  replaces a borrowed file writes beside it and renames over it; and one remover that never follows a link
  (`bin/lib/links.ts`) replaces the tools' own `rm -r`. Checked when an entry is borrowed: every file's size and
  date against those `key.json` was filed with, and an entry found changed is thrown away and made again rather
  than borrowed. Read-only files would not hold it, because the attribute is the file's under every name and the
  first tree to remove its names clears it.
- **An entry is whole.** Held at the instant: `key.json` is written last, after the tool's clean exit and a
  check that every declared output is there.
- **A fingerprint covers everything its output was made from.** Held at the instant of filing: the tool runs
  with a recorder of every file it opens loaded first, and the entry is refused if it opened a file its
  fingerprint does not name, or if an input changed while it ran. Held by tests as well: each step's inputs
  agree with the architecture page's `reads`, so the picture and the runner cannot disagree.
- **A tree serves one entry a step, or is said to be stale.** Put right a moment after: a save of the master
  leaves the old borrow in place until the next `world:ready`, and the debug panel says which steps are stale
  and which input changed, from fingerprints, never from dates.
- **Two runs at once stay correct.** Held at the instant of decision: a lock a tree, so the quick start and the
  panel never build in one tree together; a lock a step and fingerprint, so a second tree waits for the first's
  entry instead of building it again; and one for the machine around the tools that take 8 GB. The rename
  refusing to replace an entry that is there is the backstop.
- **Clearing the shelf never takes what a tree uses.** Held by `world:prune`: it keeps every entry a file of
  which has another name (a tree borrows it), every entry a live tree's `world-cache.json` names, anything
  locked, and anything borrowed in the last week.

## What it costs and what it saves

A master's whole set is about 390 MB on the shelf; tiles and height are most of it. A repaint, or a change to
code every step imports, files another whole set; a change to `render.json` files new tiles and styles, 66 MB.

Measured on 2026-10-12, a brand-new worktree on a filled shelf - no packages, no world, no compiled server - was
ready in **68 seconds**, where a fresh tree took about seventeen minutes: the tools and the Docker stack 24 s, the
packages 9 s, the world borrowed in 14 s (ten steps, 54,000 files hard-linked, and the downloads in half a
second), the pictures 13 s, the dev server 6 s, and the game server beside all of it in 10 s, every class from
Gradle's build cache. The first tree to make a master's world made all ten steps in 9 minutes 46 seconds, with
nothing to download; a tree whose world is current says so in under half a second. The shelf held 400 MB.

## Steps

One commit each; Adam chooses the order and approves each. Every step carries its documents and leaves the
program running on it at this tree's address. Steps 2 to 6 change nothing on the screen.

| # | Step | Seen in |
|---|---|---|
| 0 | This plan, decision record 0095, `ROADMAP.md`, `GLOSSARY.md` | the documents |
| 1 | `bin/lib/links.ts`: a junction known for one, the remover that never follows it, hard links a file at a time, a file placed in one move with its date; tests that prove what Node and git do here, experiment 0019 | the checks |
| 2 | Shared downloads: a tree is given a hard link to each file of the main checkout's `world/source` it lacks; `fetchWorld` downloads beside a file and renames over it | the quick start's lines, names in a fresh tree |
| 3 | The tools write where they are told: `--into <folder>` on the ten, `--no-names` on origin, each taking back what its tree borrowed before it writes, their `rm -r` replaced; flow's read of `render.json` moved into its stills, and the sprite map's fingerprint reading only the views of `painterly.json`, which only its printed report uses; with no options each does exactly what it does now | the checks |
| 4 | The fingerprint: `bin/lib/worldSteps.ts`, `bin/lib/worldKeys.ts`, with tests, and the cross-check against the architecture page's `tools.ts` | the checks |
| 5 | The shelf: `bin/lib/worldCache.ts` - look up, file, borrow, the locks - with tests over small stand-in tools in a scratch folder | the checks |
| 6 | `world:ready`: `bin/readyWorld.ts`, `--only`, `--force`, `--why`, the recorder of files opened; the `world:<step>` scripts stay the tools | this tree's world borrowed, timed |
| 7 | The debug panel judges by fingerprints: its buttons run `world:ready`, busy is the tree's lock, and each step is current or stale with the reason; decision 0025 amended | the Debug map section |
| 8 | The quick start runs `world:ready` in place of its world block, and starts the game server's compile first; `CLAUDE.md`, the regenerate-world skill; a new tree timed against the filled shelf | a fresh tree's quick start |
| 9 | The architecture page: the world cache drawn as a box round what the master's steps bake, and a strip, *Starting a tree*, with each step of the quick start and its time | `/admin/inspect-architecture` |
| 10 | Gradle keeps compiled classes for every tree, `org.gradle.caching`, with the test tasks left out of it | a fresh tree's compile |
| 11 | `world:prune`: lists what it would drop by default, `--drop` to act, by hand only | the shelf's size |

`debug-quick-start.ps1` (741) and `generateSpriteMap.ts` (494) are on the size ceilings, so the first shrinks in
step 8 and the second takes its option in step 3 without growing; `vite/worldApi.ts` is at 390 and stays under
400 in step 7.

## Not in this plan

- **The sprite and interface pictures' caches on the shelf.** Each of those tools deletes every entry its own
  run did not use, so two trees would delete each other's. About ten seconds, worth having once that clean-up
  goes by age.
- **Running the master's steps side by side.** Six of them read nothing but the master and the hand-written
  files, and each takes 8 GB; with the shelf it is a cost paid once a change, not once a tree.
- **The painterly and scenery stills** in `world/painterly/`, which are made by hand and stay per tree.
