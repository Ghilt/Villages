# 0023. A send without a thread

- Status: closed
- Started: 2026-10-17
- Closed: 2026-10-17

## Hypothesis

**The gateway's sends on virtual threads carry ten thousand players on fewer resources than a platform thread a
send.** Experiment 0022 found the server running 982 threads at ten thousand, one a send (decision record 0077), and
0077 named virtual threads as the next step. It is wrong if the swarm carries fewer, or answers slower.

## Setup

`gatewaySending` made a virtual thread a send (`Executors.newThreadPerTaskExecutor`) instead of a cached pool of
platform threads, and a session's sends serialised by a `ReentrantLock` rather than `synchronized`, which on JDK 21
pins a virtual thread to its carrier for as long as it blocks. The toolchain is JDK 21. The swarm as in 0021.

## Observations

The full run on `d9fadf7`, the sixth line of `docs/experiments/performance/runs.jsonl`: of the warm-up's 50 bots, 11
were never welcomed; of the next 50, none was. Every bot after about the fortieth was answered nothing at all, and the
server logged no error and spent almost no CPU. A thread dump showed no sending thread at work. A run of 20 bots was
answered in full.

## Result

**Refuted, on JDK 21.** A server that stops sending to everyone past a fixed number of connections, with no error, is
its carrier threads used up: the machine has 20, and each virtual thread blocked inside Tomcat's own blocking write,
which waits under a monitor, pins one. JDK 21 cannot unmount a virtual thread from a monitor; JDK 24 can (JEP 491).
The checks were green throughout - no test opens forty sockets at once - and only the swarm saw it.

## Decision

The sends are back on platform threads, with a comment saying why. The `ReentrantLock` stays: it changes nothing on
platform threads and is what virtual threads need. Decision record 0077 is amended to say so.

## After: on Java 25

Adam's word of 2026-10-17: a newer JDK is fine and preferred. The toolchain moved to 25, the long-term release after
21, a step of its own (decision record 0001), and the swarm run on it with the sends still on platform threads, as a
baseline, before they were made virtual threads again:

| at 10,000 players, Java 25 | platform threads, `d88e6ba` | virtual threads, `2c2d04d` |
|---|---|---|
| carried | 10,000 | 10,000 |
| p95 welcome / answer / cells | 68 / 262 / 313 ms | 65 / 284 / 278 ms |
| server CPU over the stage | 230 s | 225 s |
| platform threads | 998 | 285 |
| bots lost | 38, failing to connect | none |

**Confirmed, on Java 25**: the server carries ten thousand on virtual-thread sends, and its platform threads stop
growing with its players - 282 at a thousand, 285 at ten thousand - where a thread a send made 998. What it costs and how
fast it answers are about the same; the gain is a thousand stacks it no longer keeps, and a ceiling it no longer has.
Virtual threads are not in `jcmd Thread.print`, which is what the swarm counts, so the threads column now counts the
server's platform threads only.

`SocketCrowdTest` opens two hundred sockets at once against the booted app and holds every one to being welcomed and
offered a seat: the checks now find what only the swarm found on 21. Its first draft gave each of its clients the tests'
1 MiB frame buffer, ran its own JVM out of memory and left it unable to exit - the same buffer experiment 0021 took off
the server - and uses the container's own now.

## Follow-ups

1. Done: the toolchain on Java 25, and sends on virtual threads, measured.
2. Done: `SocketCrowdTest`, a crowd at once in the checks.
