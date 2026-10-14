# Villages' additions to loop:plan

What is true of Villages only. The shared skill's steps stand; this adds to them. Before a plan adds or changes a mechanic,
read `docs/MECHANICS.md` and then `docs/BUILDING-A-MECHANIC.md`.

## Event names are agreed first

When a plan adds events, propose every name with a line on what it means, and Adam approves or renames them up front, in
the planning, before anything is built and before the documents are written. A name in the event store outlives every
other decision about it, and a bad one found late costs a wipe (Adam's word of 2026-10-08, after `conditionHung`). Every
event type is listed in `docs/EVENTS.md`.

## Invariants are designed

A plan names the rules that must always hold and the history that holds each, and says which hold at the instant of a
decision and which are only put right a moment after by a listener. Good invariant design is a goal of its own: a rule
nobody holds is a hope. The sixth question of `docs/BUILDING-A-MECHANIC.md` is the method.

## Where a plan is written

- A plan that designs something is `docs/plans/<name>.md`, opening with its purpose line and ending with its steps as a
  table, `| # | Step | Verification requests |`. Its decisions leave it for decision records in `docs/adr/` as they are made.
- A plan of a few steps agreed in the conversation is written to the status file and to this session's `.sessions/` note.

## Documents that travel with a step

A change to a decision, an event or a term updates its document in the same commit: a decision record, `docs/EVENTS.md`,
`docs/GLOSSARY.md`, `docs/ARCHITECTURE.md`. Every document has one purpose, stated in its opening line, and a claim goes in
the document that owns it.

## Steps that show the player something

Whatever the player is shown is built from the component library in `frontend/apps/web/src/ui/`. A component the library
lacks is added first, in its own commit, and shown at `/admin/inspect-ui-components` in every variant and state. A step that
adds or changes one points its verification requests at that page. When Adam asks for a button, ask once whether it is a
mark or words before drawing it: that is Adam's call.
