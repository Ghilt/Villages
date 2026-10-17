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

**A load is a start on the saved history.** The World section lists every save, every tree's, in a dropdown, and
`load` gives this tree's world the one picked:

- In the moment a wipe takes, every follower - every read model and every reaction - is paused, the store emptied and
  everything folded forgotten, the save's events written back on their own streams in the order they were first
  written, ids and all, and every follower resumed: it folds the whole history again from its beginning, as it does
  when the server starts on a world already kept (`Follower.pause`, `resume`).
- So the reactions find their work done, as at every start: what they would ask again is refused as already done and
  the refusal swallowed (`Reaction`). The two that hold back while the past replays and set things right once caught
  up, the standing effects and the quest objectives, hold back again for a load's replay (`Follower.replaying`).
- What a load can write is what a start writes: the catalogues the server runs on taken on, when they differ from the
  save's (0097), and whatever the clock has made due since the save was made. **The clock runs on**: a save loaded a
  week later wakes seven months on, as a server stopped for a week would, its pledges past their day released.
- Every session is ended with `worldWiped`, as by a wipe, and each window arrives anew on the saved world; the window
  that loaded it arrives as the player who made the save, so it is looking at that house again.
- A save this code cannot read is listed as such, with the first event it cannot read, and cannot be picked; asked for
  anyway, it is refused whole, `saveRefused`, and the world is left as it was. So is a save that is not there.

**And this browser can play as any player of the world.** A player is a token until accounts exist (0008), and the
player's id is the token, so the World section lists every player with a house, by the house's name (`listPlayers`,
answered by `playersListed`), and `switch` takes the picked player's token and reloads, arriving as them. The player
this browser is now is marked and cannot be picked. One of the instruments too: closed, nobody is listed, because a
token is all it takes to play as somebody.

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
- **A frame that switches the player on the server.** The token is the player; the browser holds it, so the browser
  changes it, and the server never learns a session was anybody else.
- **A dump of the tree's MongoDB database.** Only where Docker runs, and no save at all of a world in memory.
- **Saves in MongoDB**, a database of their own. Shared too, but gone with the stack's volume, and not there without
  Docker; a file is there whichever store the tree runs on.
- **Saving the read models too.** They are folded from the events and would be stale the first time one changed.
