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

## Follow-ups

1. Virtual-thread sends again on JDK 24 or later, the toolchain moved first as a step of its own, measured by the swarm.
2. A test that opens a few hundred sockets at once against the booted app, so that a wedge like this one is found by the
   checks and not only by a swarm run.
