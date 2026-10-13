---
name: plan
description: Write a plan - a piece of work cut into steps, each one commit, each with the verification requests Adam will be asked at its hand-over, drafted now - and write its steps into the status file so the button bar can count them. Use whenever work will take more than one step, when Adam asks for a plan or "plan it", before writing anything in docs/plans/, and when a long run is picked; Adam can also type /plan.
---

# Plan

## At a glance

How a piece of work is cut into steps before any of it is built, so Adam knows from the start what he will be
asked to look at and when, and every session can say where it stands in one line.

- **Step** - one commit, one coherent change, its documents with it, handed over before it lands.
- **Verification request** - one thing Adam is asked to check before a step is committed; a plan drafts them
  for every step, so a step with nothing to see says so up front.
- **Status file** - `.claude/status.json` in the worktree: the plan's steps, how far each has got, and the
  requests waiting. The button bar draws it as `13(10) / 15`: committed, on main, of all.
- **Names and invariants first** - a plan agrees its event names and designs the rules that must always hold
  before anything is built.

A plan is agreed before anything is built, and Adam holds both ends of it: he approves it, and he can reorder,
cut or replace any step of it at any stop. It is a menu he has chosen from, not a contract.

## 1. Cut it into steps

- **One commit a step**, one coherent change, small enough to read: a module skeleton, a document, one test
  with its implementation. A step past a few hundred lines was two.
- **Documents travel with their step**, as `CLAUDE.md` says: a decision, an event or a term changes its
  document in the step that changes it.
- **Something to see, early.** A plan whose first five steps change nothing on the screen asks Adam to take
  five steps on trust. Order it so the first step that shows comes as soon as it can, and so that each run of
  invisible steps ends in one that shows them.
- **Bringing it to main is the implicit last step** of every plan, with the `to-main` skill. It is not
  counted in the steps.

## 2. Draft the verification requests of every step

A **verification request** is one thing Adam is asked to check before a step is committed, written so he can
answer it by its number. The hand-over asks them; the plan drafts them, so he can see before the work starts
what each step will put in front of him, and object to a step that would leave him nothing to judge.

- **One to three for each step**, the rules of the `hand-over` skill: 👀 on every one he checks by looking at
  the running program, saying where, and those first.
- **A step with nothing to see says so**: *the checks*, or *read decision record 0096*. Never a 👀 invented to
  fill the column.
- **Good places for them** are where a change first shows, where a matter of taste is settled (a colour, a
  size, a word), and where a wrong turn would be expensive to walk back. A plan that has several of those in
  one step has a step that is too big.

They are drafts. The hand-over writes the real ones from what the step turned out to be.

## 3. Names and invariants

When the plan adds events, it proposes every event's name with a line on what it means, and Adam approves or
renames them now, before anything is written. When it adds rules, it names each rule that must always hold
and the history that holds it, and says which hold at the instant of a decision and which are put right a
moment later by a listener. `CLAUDE.md` says why; the sixth question of `docs/BUILDING-A-MECHANIC.md` is the
method.

## 4. Where it is written

- **A plan that designs something** - a mechanic, a system, a pipeline - is a document,
  `docs/plans/<name>.md`, opening with its purpose line and ending with its steps as a table:
  `| # | Step | Verification requests |`. Its decisions leave it for decision records as they are made.
- **A plan of a few steps agreed in the conversation** is written nowhere but the status file and the
  session's `.sessions/` note. It is still a plan, with steps and drafted requests.

Either way, present it to Adam and stop. It starts on his word.

## 5. The status file

When Adam agrees the plan, write its steps into `.claude/status.json` at the worktree root. The file is the
session's own, ignored by git like `.claude/launch.json`, and replaced whole by the next plan. The button bar
reads it after every turn and draws it as `committed(on main) / all`; pressing that opens the requests waiting,
with a copy mark and a mark that puts them in the prompt box with room under each for an answer.

```json
{
  "plan": "The status mod and verification requests",
  "doc": "docs/plans/status-mod.md",
  "steps": [
    { "title": "The process documents", "state": "committed" },
    { "title": "The status button and its pane", "state": "planned" }
  ],
  "verification": {
    "step": 2,
    "at": "http://localhost:5548 · worktree <folder>, branch <branch>",
    "requests": ["👀 In the button bar, ...", "The checks: ..."]
  }
}
```

- `doc` only when the plan is a document. `steps` in the plan's order, each `planned`, `committed` or `main`.
- `verification` is the latest hand-over's: which step is waiting, the where-to-look line, and its requests
  as written, 👀 and all. `null` when nothing is waiting on Adam.
- **Who writes what**: this skill writes the steps; the `hand-over` skill writes `verification`; "continue"
  marks the step `committed` and sets `verification` to `null`; the `to-main` skill marks every committed step
  `main`; a long run marks each step as it commits it. A session with no plan still writes `verification` at a
  hand-over, with `steps` empty.

Write it with the file tools, whole, and keep it true: a count that is behind is worse than none, because it
looks like evidence.

## Change this skill

Adam owns this file: how a plan is cut, where it is written, and where its verification requests go. When he
corrects a plan, the correction goes here, in the same step.
