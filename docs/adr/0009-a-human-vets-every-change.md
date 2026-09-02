# 0009. A human vets every change before it is committed

- Status: accepted, extended by 0016
- Date: 2026-09-01

## Context

This code base is written largely by an agent, in small steps, over many sessions. The git history is the only
durable record of what happened and why, and its value depends entirely on someone having actually looked at each
change.

## Decision

Claude never commits unless Adam has approved that specific change set in the same conversation. Work proceeds in
small increments, one coherent step each, and each ends with a summary, the file list, the test output and a request
to review. The permissions file makes the harness prompt on commit, push, rebase and tag, and denies force pushes,
hard resets and clean.

## Consequences

Review happens while a change is still small enough to read in full, and the history stays a story rather than a
series of dumps. It costs a round trip per increment, which is the intended trade. The rule is written in two places,
in the tooling and in words in the working notes, so it survives a change of tooling. Nothing prevents Adam from
committing by hand as well.

## Alternatives considered

- Adam commits everything by hand: identical review, more of his typing, and the messages lose the context the agent
  has.
- A branch and a pull request per change: better with more than one contributor, more ceremony than a solo local
  repository needs.
- Letting the agent commit freely and reviewing afterwards: loses the vetting, which was the requirement.
