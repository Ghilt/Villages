# 0095. The world is made once, filed by what it was made from, and every tree borrows it

- Status: accepted
- Date: 2026-10-12

## Context

Every session works in a worktree of its own (0020, 0031), and there are dozens of them. Each one that serves
needs the world: a master's outlines and tiles, its rivers' flow, its sprite map and stands, its ground map, its
origin map and the names carried through it, its culture map and its height. All of that is output, gitignored
and per tree, so a fresh tree makes it all again. The quick start spends about fifteen of a fresh tree's
seventeen minutes on it, six or seven of them downloading 444 MB of ETOPO into that tree's own `world/source`,
and almost every tree builds exactly what the tree before it built, from the same master and the same tools.

What decides whether a part of the world is stale is the date of its files against the date of what it was made
from. That is wrong both ways. Git dates a fresh checkout's master at the moment of checkout, so output copied
or linked from another tree always looks older than the master; the trees that junction the main checkout's
tiles by hand get a warning at every start instead. And the dates miss real changes: no step runs again when
`palette.json` changes, the tiles not when `render.json` does, the origin map not for `terrain-base.png`, and
nothing at all when a world tool's own code changes. The debug panel's *cut it* keeps a list of its own, two
steps short of the quick start's, and writes through a linked folder into the main checkout.

Adam's requirement, of 2026-10-12: the world baked from the master is a resource every tree reuses, and is not
made again to launch a tree for a small change; and it is made again, correctly, whenever what it is made from
changes.

## Decision

**Each world step's output is filed once, on a shelf the whole machine shares, under a fingerprint of everything
it was made from, and a tree borrows it by hard link.** The shape, the steps and the order they are built in are
`docs/plans/world-cache.md`.

- **What decides staleness is content, never dates.** A step's fingerprint hashes the bytes of the master and
  of every file it reads, the tool's own code and every file that code imports at run time, the versions of its
  libraries, the master's name and the tool's options, an explicit *absent* for an optional input that is
  missing, and the fingerprints of the steps it reads from. Two trees with the same inputs agree on it, and any
  change to an input moves it.
- **The shelf is `.git/world-cache/` in the main repository**, which every tree finds with
  `git rev-parse --git-common-dir`. Git never looks inside its own folder, so nothing about the shelf shows in
  any checkout's status or reaches any check, and it needs no line in `.gitignore` to wait for main.
- **An entry is made beside the shelf and renamed into it whole**, by the tool itself told where to write; it is
  never written again, and nothing writes or deletes through a link. A tree goes on serving its old world while
  a new entry is made.
- **A tree borrows by hard link, a file at a time, and never by junction.** The folders of tiles, flow, sprite
  map, stands, origin, culture and height are made again in the tree as real folders of hard links to the entry's
  files, about seven seconds for a master's 54,000; the loose files are copied, data before manifest with the
  entry's dates, because the game server reloads on a manifest's date. A junction is ruled out by experiment
  0019: `git worktree remove --force`, how a tree is deleted, empties what a junction points at, so a tree that
  borrowed by junction would take the shelf with it. A borrowed file is never written in place; whatever replaces
  one writes beside it and renames over it.
- **`npm run world:ready` is the way the world is built.** The quick start and the debug panel's buttons run it,
  over one list of steps (`bin/lib/worldSteps.ts`), so every way of making the world makes the same one. The
  `world:<step>` scripts stay the tools themselves, for a hand run's stills and options; what a hand run makes is
  the tree's own, and the next `world:ready` borrows over it again.
- **The downloads are shared the same way**: a tree is given a hard link to each file of the main checkout's
  `world/source` it lacks.
- **A fingerprint is held, not hoped for.** Each tool runs with a recorder of the files it opens, and an entry is
  refused if the tool opened a file its fingerprint does not name, or if an input changed while it ran.

## Consequences

- A fresh tree whose world is on the shelf has it in seconds: measured on 2026-10-12, a brand-new worktree was
  ready in 68 seconds, its world borrowed in 14 and its server's classes taken from Gradle's build cache, where
  a fresh tree took about seventeen minutes.
- The first tree to need a new master, or a world tool's new code, pays for it once, about nine minutes with
  nothing to download, and every tree after it has it for nothing. A branch that changes a tool every step
  imports files a whole new set, about 390 MB; `world:prune` drops entries no tree links to.
- The dates' false alarms and missed changes go together: a palette change re-cuts the tiles, a change to a
  tool re-runs it, and a fresh tree is never told its borrowed world is stale.
- A tree's world is now mostly second names of the shelf's files. Deleting a tree, by any means, takes its names
  and leaves the files; what Node and git do to a link is tested and recorded (experiment 0019) rather than
  assumed. A write made into a borrowed file in place would change every tree's, so the tools refuse to write over
  a borrowed world, and an entry is checked against the sizes and dates it was filed with whenever it is borrowed.
- The seventeen trees that junctioned the main checkout's world by hand, and the three that junctioned its
  downloads, are each one `git worktree remove` from deleting what they point at. `world:ready` takes the junction
  away, the link alone, the first time it runs in one.
- The shelf is shared state, so it has locks: one a tree, one a step and fingerprint so two trees never build
  the same entry together, and one for the machine around the tools that take 8 GB.
- The painterly and scenery stills, made by hand into `world/painterly/`, stay per tree.

## Alternatives considered

- **Link every tree to the main checkout's world**, as a dozen trees do by hand today. The main checkout's world
  is whatever Adam last cut there: today a partial cut of 2026-10-03, with no origin, culture, height, names or
  ground. A tree on a branch with another master, or another tool, borrows the wrong world without being told,
  and one that re-cuts writes into the main checkout's.
- **Copy rather than link.** Twenty-one thousand tiles twice over, and the height's as many again, is a minute of
  small files on Windows for every tree, for a world that never changes once made.
- **Borrow by junction**, one link a folder and instant. Refuted by experiment 0019: deleting the tree deletes
  what the junction points at. A directory symbolic link would not be, and Windows makes one only in Developer
  Mode, which this machine is not in.
- **Make the shelf read-only.** The attribute belongs to a file under every name it has, so the first tree that
  removes its borrowed names clears it for all of them; it would protect nothing for long.
- **Keep the dates and give a copied world its dates back.** It mends the false alarms and leaves the missed
  changes: a date says when, not what.
- **A fingerprint of the master alone.** Misses every palette, render, biome, culture and tool change, which is
  where the dates already go wrong.
- **The shelf beside `.git`, as `.sessions/` is.** It shows in the main checkout's status until its ignore line
  reaches main, and the size check, which lists untracked files, would walk it.
- **Make the world faster instead**, running the master's steps side by side. Six of them read only the master,
  and each wants 8 GB. Worth doing one day; with the shelf it is a cost paid once a change, not once a tree.
