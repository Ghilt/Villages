# 0022. What a cell costs

- Status: closed
- Started: 2026-10-17
- Closed: 2026-10-17

## Hypothesis

**Answering a cell from an index rather than a walk of every row takes a measurable share of the server's CPU off
ten thousand players.** The read models scanned every structure and character for each cell asked about, and every
house for each roll's omens; experiment 0021 found the server spending nine cores at ten thousand, with the cells its
slowest answer. It is wrong if the CPU of the last stage, and the cells' p95, do not fall.

## Setup

`docs/plans/indexed-read-models.md`: a sorted index by quadkey for structures, characters and houses, so a cell is one
range of it; an index by holder for "held by", by person for "in whose slots", by house for a quest's "holds"; and the
houses near a place read from the cells round it. Each index held to a plain scan by a spec over generated worlds. The
swarm as in experiment 0021, run after each step that it can see.

What the swarm cannot see: its bots take in no key figures and walk no quests, so the characters' index (step 2), a
person's slots and a quest's holdings (step 3) change nothing it measures. Those are held by their specs alone. What it
does exercise is every cell a player follows and every roll's omens.

## Observations

The runs, from `docs/experiments/performance/runs.jsonl`:

| run | carried | 5,000: p95 welcome / answer / cells, server CPU | 10,000: p95 welcome / answer / cells, server CPU |
|---|---|---|---|
| before, `e22a1c7` | 10,000 | 128 / 70 / 35 ms, 102 s | 265 / 336 / 446 ms, 378 s |
| structures indexed, `56fe999` | 5,000, bent at 10,000 | 29 / 59 / 10 ms, 75 s | 721 / 571 / 695 ms, 272 s |
| houses near indexed too, `0c9ecfb` | 10,000 | 14 / 27 / 11 ms, 75 s | 173 / 304 / 334 ms, 233 s |

**The run between bent at ten thousand**, on a slower welcome, while using less CPU than the run before it, and taking
twice as long for the bots to arrive. It was the machine, not the server: two Chrome windows, Spotify, Discord, Steam and
about a dozen Gradle and Kotlin daemons of other sessions' trees were running beside it. At ten thousand the server sits
close enough to the bend that one run can fall either side of it, so a single run there is weak evidence either way;
five thousand, well inside the line, and the server's own CPU, which the machine's other load does not add to, are the
fairer measures.

## Result

**Confirmed.** At ten thousand players the server spent **38% less CPU** over the last stage (233 s, from 378), the
cells' p95 fell from 446 ms to 334, and the second five thousand arrived in 2.4 s rather than 6.2. At five thousand its
CPU fell by a quarter (75 s, from 102) and every p95 is under 30 ms. The heap at ten thousand is a little smaller too,
2.2 GB from 2.5, since a scan made a list of every row on every question.

Where the CPU goes now: the answers to commands are the slowest of the three at ten thousand, a p95 of 304 ms - each
roll, its omens and its hand, and the house's events sent to everyone who can see it - and the gateway's threads, 982
at the last stage, one a send (decision record 0077).

## Decision

Keep the indexes. A read model answers a question about a place, a holder or a person from an index kept as its rows
change, and a spec holds each index to a scan of every row; `ARCHITECTURE.md` says so among its scale principles.

## Follow-ups

1. The gateway's thread a send, the next thing the threads point at: virtual threads, which 0077 named as next.
2. What a command costs: the p95 answer at ten thousand, where a roll's work and its fan-out to everyone in view meet.
3. Swarm runs that average more than one run at the edge, or a quieter machine, so that a bend at ten thousand is the
   server's and not the room's.
4. Bots that take in key figures and walk quests, so that the indexes the swarm cannot see today are measured too.
