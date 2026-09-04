# 0020. A live document per session, saying what it is touching

- Status: accepted
- Date: 2026-09-04

## Context

Work on this project is no longer one agent at a time. A second session, in its own git worktree, built the
higher-fidelity world of decision 0018 while this one was working elsewhere, and the handover arrived as a
message from Adam carrying a commit to cherry-pick. That worked, and only because the two had touched
disjoint parts of the tree by luck: the other session added a folder and changed nothing existing.

Luck is not a plan. As the system grows, two sessions will want the same files, and a merge conflict found
afterwards is the most expensive way to learn about it.

## Decision

Every session writes a live document saying what it is doing and which parts of the tree it is touching,
before it touches them, and reads what other sessions have written first.

- One file per session, `.sessions/<date>-<slug>.md`. One writer each, so the documents themselves can
  never conflict.
- The directory is gitignored, apart from a README carrying the convention. A session's live state is
  about this machine at this moment; what lasts goes in a decision record, the journal or a commit.
- Deleted when the work lands. An empty directory means nothing is in flight.
- From a worktree the directory is the main repository's, found beside `git rev-parse --git-common-dir`.

## Consequences

A collision becomes visible before it happens, which is the only cheap time to notice one. It also leaves
a plain answer to "what is going on right now", which neither the git log nor a conversation transcript
gives: the log is what finished, and a transcript is not readable by anybody else.

It is advisory. Nothing enforces a claim and nothing prevents two sessions entering the same directory
anyway. The real protection remains what it was: small commits in one coherent area, and a human reading
the diff. This makes that discipline coordinable rather than replacing it.

The cost is a file to keep current, and a stale claim is worse than none, so the convention says to delete
it when done and to update the areas whenever they change.

## Alternatives considered

- One shared document that every session edits: exactly the merge conflict it would exist to prevent.
- Commit the claims so they travel between worktrees: puts coordination behind the commit gate of decision
  0009, so a claim could not be made until Adam approved it, which is far too late.
- Git branch names and worktree names as the only signal: says who is working, never on what, and says
  nothing at all about which files.
- Nothing, and rely on small commits: what we did, and it held only because the two sessions happened not
  to overlap.
