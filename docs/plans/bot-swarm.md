# The bot swarm

**What belongs here:** how the bot swarm gets built - the bot, the run that ramps it against one server, what is
measured and where the numbers go, and the order it is built in. **What does not:** what the numbers mean for the
design, which is the experiment record each run is read in; how to run it, which is `RUNNING.md` and `TESTING.md`
once it exists; why the server is shaped as it is, which is `ARCHITECTURE.md`. When a part of it is decided, that part
becomes a decision record and leaves.

---

## The problem, in one paragraph

`ARCHITECTURE.md`'s seventh scale principle says every scale claim is checked by the bot swarm, and
`backend/load-bots` is a seven-line placeholder. Nobody knows how many players one game server carries, and the
code-debt review of 2026-10-16 found two designs that grow with history - every follower of the feed replays the whole
store and remembers every event id, and every cell is answered by scanning every row - whose cost is a guess until
something measures it. Adam's ask, of 2026-10-16: measure it, keep every run so that what a feature costs shows, and
read the result: how many players one event-sourced server like this carries, and how it would be scaled past that.

## What a run is

One program, run by hand, never by the checks:

1. It starts **one** game server to measure: the app's own jar, on a port the operating system picks so that it can
   be nobody else's, with its world in memory, the instruments closed so that it is the player's server, and
   Tomcat's connection limit raised past 10,000 so that the first limit met is ours. Startup is timed from the
   process starting to its port answering.
2. It ramps **bots** at it in stages of 100, 1,000, 2,500, 5,000 and 10,000, and holds each stage for 60 seconds
   after its last bot is in. First comes a **warm-up** of 50 for 20 seconds, measured and shown but never judged:
   a server is cold once, as it starts, and the first short run bent at ten players on a welcome of 745 ms that was
   only the JVM compiling its first calls; warm, a hundred were welcomed in 22 ms.
3. A bot is one simulated player on one WebSocket, playing the player's own loop: `hello` with a token of its own,
   a seat taken from its `yourChoice` with `takeAction`, the cells round its seat followed, a pan every 20 seconds
   (unsubscribe, subscribe), a roll and its action every 60 seconds, each with jitter so that they do not move in step.
4. A stage **bends** when the slowest twentieth of round trips takes more than 500 ms, or more than 1% of its bots
   fail. The run stops at the first stage that bends, and says which and why.
5. It always stops the server it started, however it ends.

## What is measured

From outside the server, so that the game server's code is not changed to be measured:

| Number | How |
|---|---|
| hello → welcome, command → accepted, subscribe → snapshot | each bot times its own round trips; p50, p95, p99 a stage |
| bots failed | refused, dropped, or a round trip past 5 s |
| server startup | process start to port answering |
| heap after a collection | `jcmd <pid> GC.run`, then `GC.heap_info` |
| threads | `jcmd <pid> Thread.print`, counted |
| server CPU | `ProcessHandle.info().totalCpuDuration()`, across the stage |

The bots run on the same machine as the server and take some of its CPU; the reading says so beside every figure.

## Where the numbers go

- **`docs/experiments/performance/runs.jsonl`**, one line a run, appended once when the run ends: the commit, the
  branch, the date, the machine, the settings and every stage's numbers; a run that is interrupted is written with
  `"aborted": true` and why. Committed, so that the history travels to main with the work it measured.
- **`/admin/inspect-performance`**, the inspect page that charts the history: players carried and the round trips run
  by run, along the commits, so that a step that made the server slower can be seen.
- **An experiment record** for the first baseline: where it bent, what gave way, how many players one server carries,
  and the path past that.

## Rules that must hold

No events are added: the swarm is a client and a page, not a mechanic.

| Rule | Held by | When |
|---|---|---|
| `load-bots` speaks the protocol and nothing else | its build file depends on `:protocol` only; `LayerRulesSpec` keeps the Bots layer off everything else | at compile |
| a run never touches another tree's port, store or virtual host, nor this tree's game server | the port is one the operating system picks; the world is in memory; no broker | at start |
| the server a run starts is stopped, however the run ends | the runner's `finally` and a shutdown hook; a test with a stand-in process that throws mid-run | at the end of a run |
| one line a run, written once | the history writer appends only at the end, aborted or not; a test | at the end of a run |
| every bot is a player of its own | each takes a fresh token; a second hello with a token would take over the first | at hello |

## Steps

| # | Step | Verification requests |
|---|---|---|
| 1 | **One bot.** `load-bots` gets the JDK's WebSocket client and a `Bot` that plays hello, seat, follow, pan and roll over the protocol's own codec, tested against a stand-in socket; `./gradlew :load-bots:bot` runs one against this tree's running server. | 👀 With the game open, run the one bot: a new house is founded on the map and it rolls once a minute; the event page shows its `rolled` and `took action`. The checks. |
| 2 | **The run.** The swarm starts the server to measure, ramps the stages, times the round trips, reads `jcmd`, stops at the bend and prints a table; `./gradlew :load-bots:swarm`, with `--stages` for a short run. `TESTING.md` and `RUNNING.md` say how. | 👀 Run a short ramp, `--stages 100,500`: a table of both stages is printed and no game server is left running afterwards. The checks. |
| 3 | **The history.** Each run appends its line to `runs.jsonl`; an interrupted run is written as aborted. The first full ramp's line is committed. | Read the first line in `docs/experiments/performance/runs.jsonl`: the stages it reached and where it bent. The checks. |
| 4 | **The page.** `/admin/inspect-performance` charts the history, named on the inspect index. | 👀 At `/admin/inspect-performance`: the first run charted, players carried and the three round trips; the chart reads at a glance. The checks. |
| 5 | **The reading.** An experiment record with the baseline, what gave way first and why, the capacity of one server, and the path past it; `ARCHITECTURE.md`'s seventh principle given its number, and `ROADMAP.md` moved on. | Read the record: whether the capacity figure and the scaling path stand up. |
