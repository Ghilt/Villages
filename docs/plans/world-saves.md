# World saves

**What belongs here:** how a development world comes to be saved under a name, loaded again in any tree, and played
as any of its players - the steps, the rules they hold, and the order they are built in. **What does not:** why it is
shaped this way, which becomes decision record 0101 as it is built; the words, which are `GLOSSARY.md`; where the
buttons are and what they do, which is `RUNNING.md`.

Agreed with Adam on 2026-10-17, in place of a "kept world" that is never wiped: **saves are a debug feature, and
nothing in the event store records them.**

## How it is used

A new session starts on a fresh world. To try something on a world that has got somewhere, Adam opens the debug
panel's World section and loads a save from a dropdown. Having got somewhere worth keeping, he presses save and
names it, `completed-many-quests`. And he can jump between the players of whatever world is loaded.

## What a save is

**Every stored event of the world**, each with its stream and its place in it, as the store holds it, written to
one file under the name given: `.saves/<name>.jsonl` beside the shared `.git`, so every tree sees every save, the
way it sees `.sessions/`. The file says who saved it and when. Nothing else is saved, because nothing else is the
world: every read model, and every reaction's memory, is folded from the events.

**A load is a start on the saved history.** The followers stop, the store's events are replaced by the save's,
and every follower starts again and folds it from the beginning, exactly as when the server starts on a world
already kept. The read models come back as they were. The reactions find their work done and write nothing, as at
every start: what they would ask again is refused as already done, and the refusal is swallowed (`Reaction`).
So the events are put back as stored, never issued again as commands.

**The clock runs on.** World time is the real clock's, a month a real day, so a save loaded a week after it was
made wakes seven months on, as a server stopped for a week would: pledges past their day are released, and stocks
have gone on at their rates. A save that resumes at the moment it was made would need a clock of its own; not now.

## The rules it holds

- **A save is the world whole, or nothing.** No command runs while it is read: it is taken under the wipe's lock,
  so it never holds half of a story that was being written. Held at the instant of the save.
- **A load never writes an event of its own.** The events put back are the save's, ids and all, and the reactions
  that see them act only where the history leaves work undone, which a whole save does not. Held at the instant of
  the load, by the same refusals that hold it at every start.
- **A save this code cannot read is refused whole**, naming the first event it cannot read, and the world is left
  as it was. Held at the instant of the load.

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | **Save the world.** A save button in the World section opens a dialog for a name; the server writes every event to `.saves/<name>.jsonl` beside the shared `.git`, with who saved it and when. Frames `saveWorld` and `savesListed`; protocol 54. Decision record 0101, a glossary line, `RUNNING.md`. | 👀 In the World section, save as `first-test`: the log says how many events were saved, and the file is in `E:/Code/Villages/.saves/`. A name already taken, or not a name, is refused and says why. |
| 2 | **Load a save.** A dropdown in the World section lists every save, its name, when, and how many events; picking one replaces this tree's world with it, every window reloads, and this browser becomes the player who saved it. A save this code cannot read is marked and refused. Frames `listSaves` and `loadSave`. | 👀 Change something, then load `first-test`: the map, the house and its people are as they were, and the events log shows no event the load wrote. 👀 In a fresh tree, the same save loads. |
| 3 | **Switch players.** A dropdown in the World section lists every player with a house in this world, by house name; picking one makes this browser that player and reloads. Frames `listPlayers` and `playersListed`. | 👀 Seed 20, switch to one of them: the house status is that house's. Switch back. |
