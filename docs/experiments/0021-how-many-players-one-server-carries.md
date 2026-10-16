# 0021. How many players one server carries

- Status: closed
- Started: 2026-10-16
- Closed: 2026-10-16

## Hypothesis

**One Villages game server on a development machine carries ten thousand simultaneous players**, each playing the
player's own loop, with the slowest twentieth of every round trip under 500 ms, as `ARCHITECTURE.md`'s scale
principles were designed for. It is wrong if any stage up to ten thousand bends: a p95 over 500 ms, more than one in a
hundred trips or bots failing, or the server falling over.

## Setup

The bot swarm of `docs/plans/bot-swarm.md`: one game server started from the app's own jar on a port of its own, its
world in memory, its instruments closed, its heap held to 8 GB and Tomcat let take 20,000 connections; bots over the
JDK's WebSocket client saying hello, taking a seat, following the nine cells round it, panning about every 20 s and
rolling about every 60 s. A warm-up of 50 for 20 s, then 100, 1,000, 2,500, 5,000 and 10,000, each held 60 s.
Measured from outside: the bots' round trips, and `jcmd` for the server's heap after a collection, its threads and
its CPU; `--histogram` for what the heap holds by class.

The machine: an Intel i5-13500, 20 threads, 32 GB, Windows 11. **The bots run on the same machine** and take some of
its CPU, so every figure here is a floor for what the server alone would carry.

## What we will look at

The stage that bends and why; the heap per player; what fills it, from the class histogram.

## Observations

**The first full run** (`9aa0c27`, the first line of `docs/experiments/performance/runs.jsonl`):

| players | welcome p95 ms | answer p95 ms | cells p95 ms | heap after GC | threads |
|---|---|---|---|---|---|
| 100 | 15 | 25 | 4 | 462 MB | 118 |
| 1,000 | 114 | 206 | 4 | 4,176 MB | 321 |
| 2,500 | - | - | - | 8,187 MB, **out of memory** | 46 |

It carried 1,000 and fell over at 2,500. The heap grew about **4 MB a player**, before any player had done much.

**What filled it**, from `--histogram` at 1,000 players: 2.1 GB of `char[]`, about 2,800 arrays of about 750 KB,
and 2.1 GB of G1's filler, the unused tails of the regions large arrays are given. The world itself - every house,
structure, event and read model - was a few tens of megabytes. The arrays are each connection's text buffer:
`WebSocketConfig` raised the largest text frame to 1 MiB on 2026-10-15, so that an inspect page can save a catalogue
whole (decision record 0097), and Tomcat allocates a buffer that size for every connection when it opens, 2 MB of
characters, which G1 places in regions of its own and wastes about as much again around.

**The proof**, a run of a build with the default 8 KB buffer, not committed and not kept in the history:

| players | welcome p95 ms | answer p95 ms | cells p95 ms | heap after GC | threads | server CPU over 30 s |
|---|---|---|---|---|---|---|
| 1,000 | 94 | 133 | 12 | 178 MB | 319 | 28 s |
| 2,500 | 72 | 115 | 5 | 432 MB | 369 | 38 s |
| 5,000 | 63 | 81 | 23 | 1,017 MB | 500 | 66 s |
| 10,000 | 213 | **526** | 715 | 3,028 MB | 1,410 | 275 s |

It carried **5,000** and bent at 10,000 on the answer to a command, with the cells close behind; nothing was lost
and nothing failed. At 1,000 players its heap was 23 times smaller.

**What remains at 10,000**, from its histogram: 10.8 million entries of one map, about 1.3 GB, the fog's memo of
the faces it has worked out (`gateway/Fog.kt`, `faces`), kept per connection by structure, day and stamp and never
forgotten. Bots crowd the gazetteer's seats, so each sees about a thousand structures; a world spread out would see
fewer, but the memo grows with every day as well. The threads climb to 1,410, the gateway's sends (decision record
0077), and the server used about nine cores through the last stage.

## Result

**Refuted**, for today's code: it carries **1,000** players and falls over at 2,500, on memory, not on time. The
surprise is where the memory goes: not the event-sourced world, which is small, but a buffer every connection is
given in case it is an inspect page saving a catalogue - a cost a feature added yesterday, which no test could see.

With that buffer back at its default, the same server carries **5,000** on this machine with the bots beside it, and
bends at 10,000 on time: CPU, the gateway's threads, and the cells. That is the honest figure for the design as it
stands: **about five thousand players on one server like this one, perhaps ten thousand on a machine of its own**,
before anything has been made to scale.

What the event store costs is not what limits it. A player writes a few events a minute - ten thousand rolling once
a minute is about 700 events a second, which one MongoDB takes in its stride - and each house's stream is decided
alone (scale principle 1). What one server runs out of is the read side: what each connection holds, and what each
change costs to send to everyone who can see it.

## Decision

Keep the swarm, and run it after any step that could change what a player costs; the performance page shows the run
it is beside. Fix the buffer before anything else (follow-up 1). Change `ARCHITECTURE.md`'s seventh principle from
a number to prove to the number proved.

The path past one server, in the order it pays:

1. **What a connection holds**: the text buffer, which only an inspect page needs, and the fog's memo, which needs a
   bound. Five times the players for a day's work.
2. **What a change costs**: the read models answering a cell by scanning every row (code-debt review D2, the cells'
   715 ms at 10,000), the gateway's thread a send (0077, virtual threads next), and coalescing by cell rather than by
   connection.
3. **What a start costs**: every follower replaying the whole store and remembering every event id (D1). Unseen
   here, because each run starts from an empty world; a run against a stored world of ten thousand houses will show
   it.
4. **More than one server**: gateways that hold only connections and their cells, each bound to the broker by the
   cells its sessions hold, which the routing keys already carry (0094); read models split by region, by quadkey
   prefix; and the event store split by stream, which needs nothing new, since every decision is one stream's.
   Event sourcing is what makes this cheap: the write side has no global aggregate to shard, only the read side to
   partition.

## After: what a connection holds (M17)

The two fixes the reading named, each followed by a full run, the third and fourth lines of
`docs/experiments/performance/runs.jsonl`:

| | carried | heap at 5,000 | heap at 10,000 | p95 answer at 10,000 |
|---|---|---|---|---|
| the first run, `9aa0c27` | 1,000 | - | - | - |
| a big message in pieces, every socket at 8 KB, `82d4042` | 5,000, then the bots' own 2 GB ran out | 1,177 MB | - | - |
| the fog remembers one face a structure, `e22a1c7` | **10,000, without bending** | 1,049 MB | 2,507 MB | 336 ms |

**Ten thousand players on one development machine**, the number `ARCHITECTURE.md` set out to prove, with the bots
beside the server: every round trip's slowest twentieth under 500 ms (welcome 265, answer 336, cells 446), 14 of
about 2.4 million trips failing - seven rolls a house could not afford, seven answers past five seconds - and nobody
lost.

The fog's memo is bounded now, and no longer grows with every day; at this load it saved about half a gigabyte, not
the 1.3 GB it held, because what it holds is one face for each structure a connection has seen, and the bots crowd
the gazetteer's few seats so that each sees about 740 of them. Bots that settle as players would (follow-up 4) are
what will say how much a spread-out world holds.

What bends next, from the last stage: CPU, nine cores' worth of the server's through the last minute, and the cells,
at 446 ms the slowest of the three - the read models' scans (follow-up below) and the gateway's thread a send (0077).

## Follow-ups

1. Done in M17: a catalogue arrives in pieces, and the swarm carried 5,000.
2. Done in M17: the fog's face memo is bounded, and the swarm carried 10,000.
3. A swarm run against a stored world, to measure what a start costs (D1).
5. Past 10,000: the cells answered by scanning every row (D2) and the gateway's thread a send (0077), which the
   last stage's CPU and cell times point at.
4. Bots that settle where a player would, not on the gazetteer's few seats, so cells are not crowded beyond life.
