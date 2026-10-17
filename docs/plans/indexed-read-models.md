# Indexed read models

**What belongs here:** how the read models come to answer "what is in this cell", "held by whom" and "near here"
from an index instead of a scan of every row, and the order it is built in, each step measured by the bot swarm.
**What does not:** why read models are cells at every zoom, which is decision record 0026; what the swarm measures
and how, which is `docs/plans/bot-swarm.md`; what the numbers mean, which is the experiment each run is read in.

---

## The problem, in one paragraph

Every question a read model is asked about a place or a holder walks every row it has. A snapshot of one cell scans
every structure and every character in the world; a change in what one player can see re-answers up to 64 cells,
so 128 scans of everything; every roll's omens measure the distance to every house; every change to a person's
stats walks every structure for the slots they are in. With ten thousand players that is the CPU the swarm saw the
server spend through its last stage, and the cells were its slowest answer, a p95 of 446 ms (experiment 0021). The
read models were written expecting it: `HousesProjection` says the `startsWith` over every row stands in for an
index. Today's founding offers three of fourteen seats, so about 700 houses share each one at ten thousand players;
that is the game's own crowding, and the swarm measures it as it is.

## What changes

A cell is a quadkey, and a cell's rows are those whose quadkey starts with it. Kept in a sorted map by quadkey, a
cell's rows are one range of it - from the cell to the cell followed by the first character past `3` - read without
touching any other row, at every zoom. Beside it, a map by holder for "held by", and by person for "in whose slots".
The ports in `application` do not change; only how the projections and the reactions inside them answer.

## Rules that must hold

No events are added or changed.

| Rule | Held by | When |
|---|---|---|
| an index answers exactly what a scan of every row would, for every cell at every zoom, every holder, every person | each projection's spec, over generated worlds: the indexed answer against a plain scan of the same rows | at the instant of every update: the index is written in the same handler as the row |
| a row is in an index once, under its current quadkey or holder | the same specs, after rows move, change hands and go | at the instant of every update |

A reader on another thread may ask between the row being written and its index entry: a character between two
cells is briefly in neither or both. That is no different from today, where a reader may see a row change under it,
and the gateway already answers a cell again when what it shows changes.

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | **Structures from an index.** `StructuresProjection` answers a cell from a sorted index by quadkey and `heldBy` from an index by holder; a spec holds both to a plain scan over generated worlds. A swarm run, and its line. | 👀 In the game, the structures still stand on the map where they did, and the Holdings tab still lists the house's own. 👀 The performance page: a fourth run beside the three. |
| 2 | **Characters from an index.** `CharactersProjection` answers a cell from its spans indexed by quadkey, still choosing the span standing on the day asked; held to a scan the same way. A swarm run. | 👀 In the game, key figures still stand where they were, and the timeline still moves them. 👀 The performance page: a fifth run. |
| 3 | **Houses near, and the reactions' scans.** `HousesProjection.near` reads the cells round a place instead of every house; `StandingEffects` finds a person's slots, and `QuestObjectives` a house's structures, from an index. A swarm run. | 👀 A roll's omens still name the houses and rivers nearby. The checks. 👀 The performance page: a sixth run. |
| 4 | **The reading.** An experiment record of what each index bought, and what bends next; `ARCHITECTURE.md`'s scale principles say read models answer from indexes. | Read the record: what each step bought, and what is next past it. |
