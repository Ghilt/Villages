# Villages' additions to loop:to-main

What is true of Villages only. The shared skill's steps and order stand; this adds to them.

## The overview that is asked about

It is `/admin/inspect-architecture`. `frontend/apps/web/src/admin/architecture/world.test.ts` already fails when a `world:`
script, a reader or a baked file has no place on the page, so those come up on their own; the question is for what that check
cannot see. If Adam says yes, update `frontend/apps/web/src/admin/architecture/` as its own commit, show it, and go on.

## Rebasing

"We only rebase in this project." Other sessions land on main often, so rebase again right before the next step if any
time has passed.

## The main checkout

The main checkout is `E:/Code/Villages`. Check it is clean with
`git -C E:/Code/Villages status --short --untracked-files=no` (Adam's untracked test masters do not matter) and that it has
`main` checked out, then:

    git -C E:/Code/Villages merge --ff-only <this branch>

A session that cannot reach the main checkout, isolated in a worktree or refused by the harness, asks Adam once, plainly,
rather than giving the commands.

## After it lands

Delete this session's `.sessions/` note: the work has landed. Then offer the next steps as `CLAUDE.md` describes: two to four
concrete options, each a sentence or two on what it would produce and cost, with a recommendation and its reason.
