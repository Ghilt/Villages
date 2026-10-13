---
name: to-main
description: Bring a worktree's work to main - ask about the architecture diagram when something significant was added, rebase onto main (never merge), check again, fast-forward main from the main checkout. Use when Adam says "main", "bring it to main" or "get this to main", and when "continue" comes after the last step of a plan, whose implicit last step this is.
---

# To main

## At a glance

Main moves on Adam's word and only then, and when the word comes the agent does the whole of it.

- **The word** - "main", "bring it to main", or "continue" after a plan's last step.
- **Rebase, never merge** - onto main from the worktree, then the checks again, because the tree that was
  tested is not the tree that lands.
- **Fast-forward from the main checkout** - `merge --ff-only`, never handing Adam the steps.
- **The diagram** - asked about once, in one line, only when something significant was added to it.
- **The status file** - every committed step marked `main`.

Main is Adam's: it moves on his word and only then. When the word comes, the agent does the whole of it
itself and never hands him the steps.

## 1. Commit what is waiting

"main" at a verify stop means he has verified it: commit what is waiting first, one commit per coherent
change, by the rules in `CLAUDE.md`.

## 2. Ask about the diagram, when something significant was added

`/admin/inspect-architecture` draws how the world is set up and what the running game is made of. If the work
being brought to main added something significant to that picture, ask Adam, once and in one line, whether
to update the diagram before it goes, and wait for the answer. Significant means a new part of it:

- a new running piece - a server, a store, a database, a queue, a connection between them;
- a new tool that bakes the world, a new kind of file it writes, or a new part of the game that reads one;
- a part of it that changed what it is responsible for.

`world.test.ts` already fails when a `world:` script, a reader or a baked file has no place on the page, so
those come up on their own; this question is for what the check cannot see. A fix, a pane, a mechanic inside
the server or a document is not significant: do not ask. If he says yes, update
`frontend/apps/web/src/admin/architecture/` as its own commit, show it, and go on.

## 3. Rebase onto main, never merge

From the worktree: `git rebase main`. Resolve any conflict, then run the checks again, because the tree that
was tested is not the tree that lands. **Never merge main into the branch**: "we only rebase in this
project". A merge made by mistake is undone by `git rebase main`, which drops it and replays the branch's own
commits; check `git diff <merge> HEAD` is empty so the tested tree still stands. Other sessions land on main
often, so rebase again right before the next step if any time has passed.

## 4. Fast-forward main from the main checkout

Check the main checkout is clean: `git -C E:/Code/Villages status --short --untracked-files=no` (Adam's
untracked test masters do not matter), and that it has `main` checked out. Then:

    git -C E:/Code/Villages merge --ff-only <this branch>

If it refuses, main moved: rebase again and repeat. A session that cannot reach the main checkout - isolated
in a worktree, or refused by the harness - asks Adam once, plainly, rather than giving him the commands.

## 5. Say what landed, and offer what next

One line per commit that landed on main. Mark every `committed` step of the status file `main`, as the
`plan` skill describes it. Delete this session's `.sessions/` note: the work has landed. Then offer the next
steps, as the loop in `CLAUDE.md` says, and end with the verification requests, when any are waiting.

## Change this skill

Adam owns this file: what counts as significant enough to ask about, and how work reaches main.
