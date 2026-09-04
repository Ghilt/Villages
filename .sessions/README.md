# What is running right now

One file per live session, saying what it is doing and which parts of the tree it is touching. The point
is that two agents working at once can see each other, split the work along lines that do not collide, and
find out afterwards who touched what.

Everything in here except this README is **ignored by git**, deliberately, for two reasons. A shared file
that every session edited would itself be the merge conflict it exists to prevent, and a session's live
state is about this machine at this moment rather than about the project's history. What lasts belongs in
a decision record, the experiment journal or a commit message.

## The convention

**One file per session, named for what it is doing:** `.sessions/<date>-<short-slug>.md`, for example
`2026-09-04-world-source-data.md`. A session writes only its own file, so no two sessions ever write the
same one.

**Write it before touching code, not after.** A claim made after the fact protects nobody.

**Update it when the answer changes**, especially the areas being touched. Nobody minds a stale sentence
of prose; a stale claim on a directory causes a collision.

**Delete it when the work lands.** An empty directory means nothing is in flight. What happened is in the
git history; this is only for what has not happened yet.

**Read the directory at the start of a session**, and again before starting anything large. If another
file claims the area you were about to enter, pick different work or say so and ask.

From a git worktree the directory is still the main repository's: `git rev-parse --git-common-dir` gives
the shared `.git`, and this sits beside it.

## The shape

```markdown
# <what this session is doing, in a few words>

- Started: 2026-09-04 14:20
- Updated: 2026-09-04 15:05
- State: working | waiting on Adam | blocked

## Doing
A sentence or two. Why, not just what.

## Touching
- frontend/packages/world/bin/**
- frontend/package.json, and the world package's own

## Not touching
Anything under frontend/apps/web, or world/master.

## Worth knowing
Anything another session would trip over. A 4.4 GB directory appearing, a script renamed, a threshold
changed under them.
```

## What it does not do

Nothing enforces a claim, and nothing here prevents a conflict: it makes one visible before it happens.
The real protection is still small commits, one coherent area at a time, and a human reading the diff.
