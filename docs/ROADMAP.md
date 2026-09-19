# Roadmap

> **What belongs here:** what is being built now, what is meant to be built later, and the ideas that are
> not commitments. **What does not:** why any of it is wanted (`VISION.md`, `SETTING.md`, `MECHANICS.md`),
> how it will be built (`BUILDING-A-MECHANIC.md`), or what has already landed, which is the git history.

Three lists, and nothing else. **Now** is what is on the table this session. **Later** is wanted and not
started. **Future ideas** are things worth doing one day that nobody is promising.

This is a menu rather than a queue. The order is a suggestion; Adam picks the next step after each commit
from options offered then, and reordering costs nothing. See decision record 0016. Anything speculative
stays in Future ideas until it has a hypothesis in the experiment journal.

Rebuilt 2026-09-19, when the documents were reviewed claim by claim. The old six lists had drifted into a
record of what was done, which the git history already keeps.

## What stands today

The map is ours: a hand-painted master, cut into tiles, painted in the browser at any zoom, lying on a desk
when the camera pulls back past the world. A player arriving with no house is offered three seats on a
parchment, takes one, and the house is founded from the same decision that records the taking — castle,
ground about it, selectable, with an inspector on the left. Every event carries its two times, its place and
significance, and its provenance. Two browsers see each other's houses live. Everything is in memory: there
is no MongoDB and no RabbitMQ on the machine yet.

## Now

Nothing here is started, and the first four wait on the same thing.

- **0.4** Local infrastructure: MongoDB replica set and RabbitMQ in Compose
- **0.8** Testcontainers smoke test on MongoDB and RabbitMQ
- **1.6** The bridge from the store to the broker
- **0.13** End-to-end smoke test
- **0.14** One check script for the whole repository
- **1.15** The connection badge, the last piece of inspecting a house

Blocked on the machine: Docker Desktop with the WSL2 backend, needed by the first three. Everything runs in
memory until it exists, which is why nothing survives a restart.

## Later

Wanted, not started, and each needs a hypothesis in `docs/experiments/` before any code.

- **A resource system.** A set of different things that model and simulate the world around the house.
  Interaction between player and world, and player and player, needs to feel consistent. Tangibility comes
  from the shared map. This is also what a **choice roll** is meant to cost, so the two are entangled.
- **The fate engine**, and the choice roll built on it: a real roll from the house's state rather than a
  founding choice handed out on arrival. See `MECHANICS.md` and `ARCHITECTURE.md`.
- **Character dialogue**: people talking to each other, and the mechanic storylines are carried in. See
  `MECHANICS.md`; what it asks of the client is in `ARCHITECTURE.md`, and one of its questions - the DOM or
  a Pixi surface - wants deciding before much of it is written.
- **A responsive interface.** The layout is decided now - the stage folds into two bays below 600 pixels
  on its shorter side, a pane occupies a bay, and any pane can be minimised (decision record 0040) - and
  what remains is bringing the rest over. The parchment is the one still written against the window rather
  than the stage, so its breakpoint never fires. Touch is untouched: hover lifts a parchment and the map is
  driven by drag and wheel.
- **The inspect window**, beyond a house and an area: what it says about a subject once there is more than
  a name and a treasury to say, where its links come from, and whether it is a card or a paper on the desk.
  See `MECHANICS.md`.
- **The house status**, beyond one number. It is waiting on the resource system more than on anything else,
  and on somebody naming the second of the five empty places in its bar. See `MECHANICS.md`.
- **House leanings**: what identity is made of, and how the world reflects it.
- **Holdings on the map beyond the seat.**
- **Neighbours**: awareness of nearby houses, and the first thing two houses can do to each other.
- **The workbench**: the desk the map lies on becomes a place, with the house's papers on it and the map a
  quarter of it, hovered and scrolled into. The same camera; see experiment 0003.
- **Accounts** behind the identity port.
- **World persistence**, after which the event store is never wiped and event changes need upcasters.
- **Aliveness and scale**: a bot swarm to ten thousand connections on one machine, aggregation of sprites at
  low zoom, a custom stylised map style checked in, hardened reconnection and clock correction. The scale
  the architecture is designed for is not in doubt; proving it is simply not next.

## Future ideas

Not commitments. Nobody is waiting on any of these.

- **A ticking resource.** Some resource shown as a ticking income, which is what the rate shape in decision
  0006 exists for. It needs the resource system to mean anything first.
- **The banner drawn** from its own tinctures and charges instead of a plain shield. A luxury feature: it
  would look good and no part of the game is waiting for it.
