# 0019. What a link survives

- Status: closed
- Started: 2026-10-12
- Closed: 2026-10-12

## Hypothesis

A tree can borrow its world from the world cache through a directory junction, as a dozen trees already borrow
the main checkout's tiles, without anything that removes a tree's folders reaching through the junction into
the cache.

## Setup

Decision record 0095 has every tree borrow a world it did not make, so the question was what the three things
that remove a tree's folders do to one that is borrowed: the world tools' own `rm -r`, Node's `rmSync`, and
`git worktree remove --force`, which is how a worktree is deleted. Each was run in a scratch folder against a
folder holding one sentinel file, through a junction, then through a hard link to each file. Node 24.18 and Git
for Windows 2.41.0 on Windows 11. The tests are `frontend/packages/world/bin/lib/links.test.ts`, kept, so a Node or
a git that behaves otherwise is noticed.

## What we will look at

Whether the sentinel is still there afterwards.

## Observations

- **Node's `rmSync(..., { recursive: true, force: true })`** on a junction, and on a folder holding one, removed
  the junction and left the sentinel.
- **`git worktree remove --force`** on a tree holding a junction in an ignored folder **emptied the folder the
  junction pointed at**: the sentinel was gone. Made read-only first, it went too, because Git for Windows makes
  a file writable before it deletes it.
- **A directory symbolic link** could not be made at all: `EPERM`, because this machine is not in Developer Mode.
- **A hard link to each file** survived all three: removing a tree's names left the cache's file, with its link
  count one lower.
- **Hard links are cheap enough.** 21,888 files linked in 2.7 s, looked at in 0.6 s, and unlinked in 1.4 s on E:.
  A whole master's world is about 54,000 files, so about seven seconds to borrow it.
- **What was already on the disk**: fifteen worktrees junction the main checkout's tiles (and two its flow), two
  junction its whole `public/world`, and three its 4.9 GB `world/source`. Removing any of them with
  `git worktree remove --force` would delete what it points at in the main checkout.

## Result

Refuted. A junction does not survive the way a worktree is deleted, so it cannot be how a tree borrows anything
it does not own. A hard link does.

## Decision

Pivot, within decision record 0095: **a tree borrows by hard link, a file at a time.** A hard-linked file is
written in place by nothing: the tools refuse, and whatever replaces a borrowed file writes beside it and
renames over it. Read-only files are not a protection, because the attribute is the file's under every name and
the first tree to remove its names clears it. The junctions already on the disk are replaced the first time
`world:ready` runs in their tree, and the downloads are borrowed by hard link too.

## Follow-ups

- The trees that still hold a junction into the main checkout are safe to remove only once `world:ready` has run
  in them, or once the junction has been taken away by hand (`rmdir` on the junction, which removes only it).
