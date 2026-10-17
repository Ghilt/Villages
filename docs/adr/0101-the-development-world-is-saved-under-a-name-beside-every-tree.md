# 0101. The development world is saved under a name, beside every tree

- Status: accepted
- Date: 2026-10-17

## Context

Every session starts on a fresh world, in a tree of its own (0031, 0092). Trying something on a world that has got
somewhere - a house deep in its quests, a region full of houses - means playing it there again first, every time, in
every tree. The world-persistence milestone was going to be planned as a kept world that is never wiped, with an event
declaring it so. Adam disagreed: what he wants is a debug feature, a world saved under a name and loaded again in any
tree, and switching between its players, and nothing about it in the event store.

## Decision

**A save is every stored event of the world, as the store holds it, in a file named for it beside the shared `.git`.**

- The World section of the debug panel has `save`, which asks for a name in a dialog of the panel's own. The name is
  lower-case letters, digits and single hyphens, at most sixty; one already taken is refused, and nothing is written
  over. A refusal is an `error` of code `saveRefused`, its message saying why.
- `.saves/<name>.jsonl`: a first line saying what the save is - its name, when it was made, the player who made it,
  how many events it holds - and then every event, oldest first, each the CloudEvent as stored with its stream and
  its place in it among its extensions. Gitignored. Beside the shared `.git`, as `.sessions/` is, so that every tree
  sees every save; `villages.saves` names another folder.
- **Nothing is saved but the events**, because nothing else is the world: every read model and every reaction's memory
  is folded from them.
- **Taken in the moment a wipe takes** (`WipeGate`), so no command is half written while it is read, and a save never
  holds half of what was being written.
- **Nothing in the world records it.** A save is not something that happened in the world; it is Adam keeping a copy.
- One of the instruments: refused `instrumentsClosed` where they are closed (0076). Answered to the window that asked,
  with every save there is, `savesListed`.
- Loading one is a start on the saved history: the followers stop, the store is replaced by the save's events, and
  every follower folds it again, as when the server starts on a world already kept. The reactions find their work
  done, as at every start. The clock runs on: a save loaded a week later wakes seven months on. That is the next
  step of `docs/plans/world-saves.md`, and this record is amended when it lands.

## Consequences

- A world worth keeping can be kept, in seconds, and given to any tree. The stored events are already the whole
  world, so a save needs no snapshot of anything else and goes on being right as read models change.
- A save is a file of this code's events, so a change to an event's shape strands the saves made before it, as it
  strands a kept world. The upcasters of 0100 carry a save as they carry the store.
- The saves outlive the trees that made them, and nobody clears them but Adam.
- Saving holds every command for as long as reading the whole store takes: nothing for a development world, seconds
  for the swarm's.

## Alternatives considered

- **A kept world that is never wiped**, declared by an event. Adam's word: this is a debug feature, and needs no event.
- **A dump of the tree's MongoDB database.** Only where Docker runs, and no save at all of a world in memory.
- **Saves in MongoDB**, a database of their own. Shared too, but gone with the stack's volume, and not there without
  Docker; a file is there whichever store the tree runs on.
- **Saving the read models too.** They are folded from the events and would be stale the first time one changed.
