---
name: continue-for-some-time
description: Adam is leaving the computer for a while and wants work to go on without him. Offer three longer runs, each several commits with a time frame and its verify stops named up front; then work the one he picks through, committing as it goes and taking the small decisions alone. Use when Adam says "continue for some time", "keep going for a while", "I'm away for an hour", or types /continue-for-some-time.
---

# Continue for some time

## At a glance

Adam is going away, so the work runs on without stopping at every step, on terms he picked before it began.

- **Three runs offered** - each several commits, with a time frame, its steps, the decisions it will take
  alone, where it stops for him, and what it will not touch. It starts on his pick.
- **Commits as it goes** - each step once its checks are green; the only time a commit lands before he has
  looked.
- **Stops where it said** - a named verify stop, a decision that is his, red checks, or out of time. Never
  main, a push, the master or another tree's server.
- **The status file** - the run's steps, each marked as it commits, so the button bar counts the run.

Normally the loop stops at every step for Adam to look. When he says "continue for some time" he is going
away, and stopping every half hour would leave the work standing still until he comes back. So the work
runs on: longer, several commits, decisions taken without him. In exchange he is told before it starts
exactly what it will do, how long it should take, and where it will stop and wait for him.

## 1. Offer three runs, and stop

Three alternatives, each a longer piece of work made of several steps. For each:

- **What it produces**, in plain words: what Adam will be able to see or do when it is done.
- **A time frame**: roughly how long it should take, and the latest it will stop whatever happens.
  Give the three different lengths where that makes sense - an hour, a few hours, the evening.
- **The steps**, one line each, each one a commit.
- **The decisions it will take alone**: say what kind of thing will be decided without him, so a choice
  he cares about is not hidden inside a run he picked for something else.
- **Where it stops for him**: the verify stops, named now, each with the verification requests it will
  put to him, drafted as the `plan` skill drafts them. A run with none says so.
- **What it will not touch.**

Then a recommendation and the reason for it, and room for an answer that is none of the three. Stop and
wait for his pick: the run starts on his word, not before.

## 2. Before starting

Write the run into this session's `.sessions/` note: the run picked, its steps, its stops, its time frame,
and the start time (`date`). That note is where Adam looks if he comes back early. Write its steps into the
status file too, as the `plan` skill describes it: a run is a plan, and the button bar counts it.

## 3. Work it through

- **One commit per step**, made as soon as the step's checks are green, by the rules in `CLAUDE.md`. Never
  commit red. Documents travel with each step as always. Mark the step `committed` in the status file.
- **Take the small decisions alone** and write each one down as it is taken, in a line: what was decided,
  what else it could have been, and why. They are reported at the end.
- **Stop early, and say why, when**:
  - a named verify stop is reached;
  - a decision is Adam's: a matter of taste, a number he picks, anything in the master, a design question
    about a mechanic that the documents do not answer, a button that could be a mark or words;
  - something cannot be undone cheaply;
  - the checks are red and stay red after a fair attempt to fix them;
  - the time frame has run out (`date` between steps).
  If one step is blocked and another step of the same run does not depend on it, do that one first, and
  stop only when nothing is left that can be done well.
- **Never**, in a run: bring anything to main, push, tag, rewrite history, edit the master, or stop a
  server that belongs to another tree.
- Keep the `.sessions/` note current: which step, what has landed.

## 4. When it stops

Hand over as always, with the `hand-over` skill, for the whole run at once. Above the usual parts:

- **What landed**, one line per commit.
- **The decisions taken alone**, numbered, so Adam can overturn one by its number.
- **Why it stopped**: finished, a named stop, his decision, blocked, or out of time; and what is left.

The verification requests are still three at most, picked across the whole run, and written into the
status file as the hand-over writes them. "continue" then goes on with
what is left of the run; notes are fixed first.

## Change this skill

Adam owns this file: how long a run may be, which decisions are his, where it must stop. When a run does
something he did not want, the correction goes here.
